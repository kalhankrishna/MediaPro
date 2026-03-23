import { NextRequest, NextResponse } from 'next/server';
import { gateway, GatewayError } from '@/lib/gateway';

const ACCEPTED_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {
    userId?: string;
    title?: string;
    originalResolution?: string;
    duration?: number;
    contentType?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { userId, title, originalResolution, duration, contentType } = body;

  if (!userId || !title || !contentType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
  }

  let videoId: string;
  try {
    ({ videoId } = await gateway.createVideo({
      userId,
      title,
      originalResolution: originalResolution ?? '',
      duration: duration ?? 0,
    }));
  } catch (err) {
    if (err instanceof GatewayError) {
      if (err.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }

  try {
    const { url: uploadUrl } = await gateway.getUploadUrl(videoId, contentType);
    return NextResponse.json({ videoId, uploadUrl });
  } catch (err) {
    // getUploadUrl failed after the video record was already created — clean up
    // to avoid an orphaned record the worker can't process.
    await gateway.deleteVideo(videoId).catch(() => {});

    if (err instanceof GatewayError) {
      if (err.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 503 });
  }
}
