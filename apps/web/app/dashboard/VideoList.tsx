'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Video } from '@/lib/types';
import { STATUS, TERMINAL, StatusBadge } from '@/lib/videoStatus';

const POLL_MS = 3000;

// ─── Helpers ───

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'now';
}

// ─── Sub-components ───

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-zinc-400">No videos yet.</p>
      <p className="mt-1 text-sm text-zinc-500">
        <Link href="/upload" className="text-zinc-300 hover:text-white transition-colors">
          Upload one
        </Link>{' '}
        to start the pipeline.
      </p>
    </div>
  );
}

// ─── Main component ───

export default function VideoList({
  initialVideos,
  userId,
}: {
  initialVideos: Video[];
  userId: string;
}) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [isPolling, setIsPolling] = useState(false);
  const [tick, setTick] = useState(0); // bumped on fetch error to keep polling alive
  const router = useRouter();

  useEffect(() => {
    const hasInProgress = videos.some(v => !TERMINAL.has(v.status));

    if (!hasInProgress) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/videos?userId=${encodeURIComponent(userId)}`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          router.push('/login?error=session_expired');
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { videos: Video[] };
          setVideos(data.videos);
          return;
        }
      } catch { /* fall through */ }
      setTick(t => t + 1);
    }, POLL_MS);

    return () => clearTimeout(timer);
  }, [videos, tick, userId, router]);

  return (
    <div>
      {/* Polling status for screen readers */}
      <span role="status" aria-live="polite" className="sr-only">
        {isPolling ? 'Refreshing video statuses…' : ''}
      </span>

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-medium text-white">Videos</h1>
          <span className="font-mono text-[11px] text-zinc-500">{videos.length}</span>
          {/* Fixed-size slot so layout doesn't shift when polling starts/stops */}
          <span className="w-1.5 h-1.5 flex items-center justify-center">
            {isPolling && (
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"
              />
            )}
          </span>
        </div>
        <Link
          href="/upload"
          className="font-mono text-[11px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 sm:py-1.5 rounded transition-colors duration-100"
        >
          + upload
        </Link>
      </div>

      {/* Table */}
      {videos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-zinc-800/70 rounded-sm overflow-hidden">
          {/* Column headers — desktop only */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_80px_56px_40px] gap-x-4 px-4 py-2 border-b border-zinc-800/70 bg-zinc-900/30">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Title</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Resolution</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Dur</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Age</span>
          </div>

          {/* Rows */}
          {videos.map((video, i) => (
            <div key={video.id} className={i < videos.length - 1 ? 'border-b border-zinc-800/50' : ''}>
              {/* Desktop row: full 5-column grid */}
              <div className="hidden sm:grid grid-cols-[1fr_120px_80px_56px_40px] gap-x-4 px-4 py-3 items-center hover:bg-zinc-900/40 transition-colors duration-75">
                <Link
                  href={`/videos/${video.id}`}
                  className="text-[13px] text-zinc-200 hover:text-white transition-colors truncate pr-2"
                >
                  {video.title}
                </Link>
                <StatusBadge status={video.status} />
                <span className="font-mono text-[11px] text-zinc-400 truncate">
                  {video.originalResolution || '—'}
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {formatDuration(video.duration)}
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {formatAge(video.createdAt)}
                </span>
              </div>

              {/* Mobile row: 2-line layout */}
              <div className="sm:hidden px-4 py-3 hover:bg-zinc-900/40 transition-colors duration-75">
                <Link
                  href={`/videos/${video.id}`}
                  className="block text-[13px] text-zinc-200 hover:text-white transition-colors truncate mb-1.5"
                >
                  {video.title}
                </Link>
                <div className="flex items-center gap-3">
                  <StatusBadge status={video.status} />
                  <span className="font-mono text-[11px] text-zinc-400">{formatDuration(video.duration)}</span>
                  <span className="font-mono text-[11px] text-zinc-400">{formatAge(video.createdAt)}</span>
                </div>
              </div>

              {/* Error message sub-row */}
              {video.status === 4 && video.errorMessage && (
                <div className="px-4 pb-3">
                  <p className="font-mono text-[11px] text-red-500/70 truncate">
                    {video.errorMessage}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
