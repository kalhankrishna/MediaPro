import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/api-keys`, {
      headers: { Cookie: `access_token=${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }

  if (!res.ok) return NextResponse.json({ error: 'Gateway error' }, { status: res.status });
  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${accessToken}`,
      },
      body: JSON.stringify({ name: body.name.trim() }),
    });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }

  if (!res.ok) return NextResponse.json({ error: 'Gateway error' }, { status: res.status });
  return NextResponse.json(await res.json(), { status: 201 });
}
