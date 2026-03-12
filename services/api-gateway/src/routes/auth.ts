import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  signAccessToken,
  generateRefreshToken,
  generatePKCE,
  generateState,
  sha256,
} from '../lib/auth.js';
import {
  upsertUser,
  getUserById,
  createRefreshToken,
  getRefreshTokenByHash,
  deleteRefreshToken,
} from '../lib/authService.js';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL!;
const FRONTEND_URL = process.env.FRONTEND_URL!;
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
};

// ─── GET /auth/github ───
// Generates PKCE + state, stores in signed cookie, redirects to GitHub

router.get('/github', (req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  res.cookie('pkce', JSON.stringify({ verifier, state }), {
    ...COOKIE_BASE,
    signed: true,
    maxAge: 10 * 60 * 1000, // 10 min — generous for slow connections
  });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: 'user:email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ─── GET /auth/github/callback ───
// Validates state, exchanges code, upserts user, issues cookies, redirects to frontend

router.get('/github/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  // Validate PKCE cookie
  const pkceCookie = req.signedCookies?.pkce;
  if (!pkceCookie) {
    res.status(400).json({ error: 'Missing PKCE cookie — try logging in again' });
    return;
  }

  const { verifier, state: storedState } = JSON.parse(pkceCookie) as {
    verifier: string;
    state: string;
  };

  if (state !== storedState) {
    res.status(400).json({ error: 'State mismatch — possible CSRF' });
    return;
  }

  // Clear PKCE cookie immediately
  res.clearCookie('pkce', { ...COOKIE_BASE, signed: true });

  // ── Exchange code + verifier for GitHub access token ──

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_CALLBACK_URL,
      code_verifier: verifier,
    }),
  });

  const tokenData = await tokenRes.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenData.access_token) {
    res.status(401).json({
      error: tokenData.error_description ?? tokenData.error ?? 'GitHub token exchange failed',
    });
    return;
  }

  // ── Fetch GitHub profile ──

  const ghToken = tokenData.access_token;

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${ghToken}`, 'User-Agent': 'MediaPro' },
  });
  const ghUser = await userRes.json() as {
    id: number;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
  };

  // GitHub may hide email — fetch from /user/emails if needed
  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${ghToken}`, 'User-Agent': 'MediaPro' },
    });
    const emails = await emailsRes.json() as {
      email: string;
      primary: boolean;
      verified: boolean;
    }[];
    email = emails.find(e => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
  }

  if (!email) {
    res.status(400).json({ error: 'No email found on GitHub account' });
    return;
  }

  // ── Upsert user ──

  const { user } = await upsertUser({
    email,
    name: ghUser.name ?? undefined,
    avatarUrl: ghUser.avatar_url ?? undefined,
    provider: 'github',
    providerAccountId: String(ghUser.id),
  });

  if (!user) {
    res.status(500).json({ error: 'User upsert failed' });
    return;
  }

  // ── Issue tokens ──

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refresh = generateRefreshToken();

  await createRefreshToken({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
  });

  res.cookie('access_token', accessToken, {
    ...COOKIE_BASE,
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie('refresh_token', refresh.raw, {
    ...COOKIE_BASE,
    path: '/auth', // only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.redirect(FRONTEND_URL);
}));

// ─── POST /auth/refresh ───
// Rotates refresh token, issues new access + refresh cookies

router.post('/refresh', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.refresh_token;

  if (!rawToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  const lookupHash = sha256(rawToken);

  // Look up in DB
  let tokenRecord;
  try {
    tokenRecord = await getRefreshTokenByHash({ tokenHash: lookupHash });
  } catch {
    res.clearCookie('access_token', COOKIE_BASE);
    res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/auth' });
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Check expiry
  if (!tokenRecord.expiresAt || tokenRecord.expiresAt < new Date()) {
    await deleteRefreshToken({ tokenHash: lookupHash }).catch(() => {});
    res.clearCookie('access_token', COOKIE_BASE);
    res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/auth' });
    res.status(401).json({ error: 'Refresh token expired' });
    return;
  }

  // Rotate: delete old token
  await deleteRefreshToken({ tokenHash: lookupHash });

  // Fetch user for fresh JWT payload
  const { user } = await getUserById({ userId: tokenRecord.userId });

  if (!user) {
    res.clearCookie('access_token', COOKIE_BASE);
    res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/auth' });
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // Issue new tokens
  const newAccessToken = signAccessToken({ userId: user.id, email: user.email });
  const newRefresh = generateRefreshToken();

  await createRefreshToken({
    userId: user.id,
    tokenHash: newRefresh.hash,
    expiresAt: newRefresh.expiresAt,
  });

  res.cookie('access_token', newAccessToken, {
    ...COOKIE_BASE,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refresh_token', newRefresh.raw, {
    ...COOKIE_BASE,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ user: { id: user.id, email: user.email, name: user.name } });
}));

// ─── POST /auth/logout ───
// Invalidates refresh token in DB, clears both cookies

router.post('/logout', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.refresh_token;

  if (rawToken) {
    const lookupHash = sha256(rawToken);
    await deleteRefreshToken({ tokenHash: lookupHash }).catch(() => {});
  }

  res.clearCookie('access_token', COOKIE_BASE);
  res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/auth' });
  res.json({ message: 'Logged out' });
}));

export default router;