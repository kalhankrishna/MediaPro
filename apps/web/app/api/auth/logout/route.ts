import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;

  // Best-effort: invalidate refresh token on gateway. Don't block logout if gateway is down.
  if (accessToken) {
    try {
      await fetch(`${GATEWAY_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `access_token=${accessToken}` },
      });
    } catch { /* gateway unreachable — still clear local cookie */ }
  }

  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('access_token');
  return response;
}
