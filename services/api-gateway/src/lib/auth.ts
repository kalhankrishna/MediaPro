import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const jwtOptions = { expiresIn: JWT_EXPIRES_IN } as SignOptions;
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '7', 10);

// ─── JWT ───

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, jwtOptions);
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ─── Refresh Token ───

export function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash, expiresAt };
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ─── PKCE ───

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// ─── CSRF State ───

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}