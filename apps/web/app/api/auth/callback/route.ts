import { NextRequest, NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
};

export function GET(request: NextRequest): NextResponse {
  const { searchParams } = request.nextUrl;
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));

  response.cookies.set('access_token', accessToken, {
    ...COOKIE_BASE,
    maxAge: 15 * 60,
  });

  response.cookies.set('refresh_token', refreshToken, {
    ...COOKIE_BASE,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
