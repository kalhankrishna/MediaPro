import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const key = request.nextUrl.searchParams.get('key');
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  const qs = new URLSearchParams({ key });
  const download = request.nextUrl.searchParams.get('download');
  const filename = request.nextUrl.searchParams.get('filename');
  if (download) qs.set('download', download);
  if (filename) qs.set('filename', filename);

  let res: Response;
  try {
    res = await fetch(
      `${GATEWAY_URL}/videos/${encodeURIComponent(id)}/stream-url?${qs}`,
      {
        headers: { Cookie: `access_token=${accessToken}` },
        cache: 'no-store',
      },
    );
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }

  if (!res.ok) return NextResponse.json({ error: 'Gateway error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
