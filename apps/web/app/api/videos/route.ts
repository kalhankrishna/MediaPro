import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/videos?userId=${encodeURIComponent(userId)}`, {
      headers: { Cookie: `access_token=${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Gateway error' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
