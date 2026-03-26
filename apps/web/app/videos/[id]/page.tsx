import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { gateway, GatewayError } from '@/lib/gateway';
import type { Video } from '@/lib/types';
import VideoDetail from './VideoDetail';

export const metadata: Metadata = {
  title: 'Video — MediaPro',
};

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login');

  let decoded: { userId?: unknown; email?: unknown };
  try {
    const [, p] = token.split('.');
    decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch {
    redirect('/login');
  }
  if (!decoded!.userId || !decoded!.email) redirect('/login');
  const email = decoded!.email as string;

  let video: Video;
  try {
    video = await gateway.getVideo(id);
  } catch (err) {
    if (err instanceof GatewayError) {
      if (err.status === 401) redirect('/login?error=session_expired');
      if (err.status === 404) notFound();
    }
    throw err;
  }

  // Transcript fetched server-side — it's static once written, no need to poll.
  // 404 means pipeline hasn't completed yet; that's fine.
  let initialTranscript: string | null = null;
  try {
    const t = await gateway.getTranscript(id);
    initialTranscript = t.content;
  } catch (err) {
    // 404 = not yet generated; swallow and render without transcript.
    // 5xx = gateway/gRPC problem; also swallow — transcript is optional.
    // Re-throw only unexpected non-GatewayErrors (network failures, etc.).
    if (!(err instanceof GatewayError)) throw err;
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <header className="h-11 border-b border-zinc-800/70 px-6 flex items-center justify-between shrink-0">
        <Link
          href="/dashboard"
          className="font-mono text-[13px] tracking-tight text-white hover:text-zinc-300 transition-colors duration-100"
        >
          MediaPro
        </Link>
        <div className="flex items-center gap-5">
          <span className="font-mono text-[11px] text-zinc-400 hidden sm:block">{email}</span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="font-mono text-[11px] text-zinc-400 hover:text-white transition-colors duration-100 cursor-pointer px-2 py-3"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pt-8 pb-6 max-w-5xl w-full mx-auto">
        <VideoDetail
          initialVideo={video}
          initialTranscript={initialTranscript}
        />
      </main>
    </div>
  );
}
