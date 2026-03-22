import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export function GET(): NextResponse {
  return NextResponse.redirect(`${GATEWAY_URL}/auth/github`);
}
