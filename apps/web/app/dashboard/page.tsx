import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { gateway, GatewayError } from '@/lib/gateway';
import type { Video } from '@/lib/types';
import VideoList from './VideoList';

export const metadata: Metadata = {
  title: 'Dashboard — MediaPro',
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login');

  // Decode JWT payload — no verification needed, gateway validates on every request.
  // Wrapped in try/catch: a corrupted cookie would otherwise crash the Server Component.
  let userId: string;
  let email: string;
  try {
    const [, p] = token.split('.');
    const decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!decoded?.userId || !decoded?.email) redirect('/login');
    ({ userId, email } = decoded);
  } catch {
    redirect('/login');
  }

  let initialVideos: Video[] = [];
  try {
    const { videos } = await gateway.listVideos(userId!);
    initialVideos = videos;
  } catch (err) {
    if (err instanceof GatewayError && err.status === 401) {
      redirect('/login?error=session_expired');
    }
    // Other errors: render with empty list, client will retry via polling
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Top bar */}
      <header className="h-11 border-b border-zinc-800/70 px-6 flex items-center justify-between shrink-0">
        <Link
          href="/dashboard"
          className="font-mono text-[13px] tracking-tight text-white hover:text-zinc-300 transition-colors duration-100"
        >
          MediaPro
        </Link>
        <div className="flex items-center gap-5">
          <span className="font-mono text-[11px] text-zinc-400 hidden sm:block">{email!}</span>
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

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 pt-8 pb-6 max-w-5xl w-full mx-auto">
        <VideoList initialVideos={initialVideos} userId={userId!} />
      </main>
    </div>
  );
}
