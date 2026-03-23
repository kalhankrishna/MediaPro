import { NextRequest, NextResponse } from 'next/server';
import { gateway, GatewayError } from '@/lib/gateway';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { videoId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { videoId } = body;

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    await gateway.confirmUpload(videoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GatewayError) {
      if (err.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }
}
