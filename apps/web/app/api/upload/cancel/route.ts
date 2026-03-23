import { NextRequest, NextResponse } from 'next/server';
import { gateway } from '@/lib/gateway';

// Best-effort cleanup for interrupted uploads. Called when the client cancels
// mid-upload or encounters an error after createVideo already ran. If the
// gateway doesn't support DELETE /videos/:id yet, the error is silently ignored
// here — the worker will mark the record FAILED when it can't find the S3 object.
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { videoId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { videoId } = body;
  if (!videoId) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await gateway.deleteVideo(videoId);
  } catch {
    // Intentionally swallowed — this is best-effort. If DELETE is unsupported
    // or the record doesn't exist, the response is still 200 to the client.
  }

  return NextResponse.json({ ok: true });
}
