'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import type { Video, VideoFile } from '@/lib/types';
import { STATUS, TERMINAL, COMPLETED, FAILED, StatusBadge } from '@/lib/videoStatus';
import MetaRow from '@/app/components/MetaRow';

const POLL_MS = 3000;

// FileFormat proto enum → display label + streamable priority (lower = prefer)
const FORMAT: Record<number, { label: string; streamPriority: number }> = {
  1: { label: 'raw',    streamPriority: 99 },
  2: { label: '480p',   streamPriority: 2  },
  3: { label: '720p',   streamPriority: 1  },
  4: { label: '1080p',  streamPriority: 0  },
  5: { label: 'thumb',  streamPriority: 99 },
  6: { label: 'poster', streamPriority: 99 },
};

// ─── Helpers ───

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(s: number): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Segment { start: number; end: number; text: string; }
interface StreamFile { s3Key: string; label: string; }

function toVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

// Builds a WebVTT blob URL. Uses real Groq segment timestamps when available
// (accurate per-line sync), falls back to a single cue covering the full duration.
function buildVttUrl(text: string, durationSeconds: number, segmentsJson?: string | null): string {
  if (segmentsJson) {
    try {
      const segments: Segment[] = JSON.parse(segmentsJson);
      if (segments.length > 0) {
        const cues = segments
          .map(seg => `${toVttTime(seg.start)} --> ${toVttTime(seg.end)}\n${seg.text.trim()}`)
          .join('\n\n');
        return URL.createObjectURL(new Blob([`WEBVTT\n\n${cues}`], { type: 'text/vtt' }));
      }
    } catch { /* fall through to single-cue */ }
  }
  const end = toVttTime(durationSeconds || 86400);
  return URL.createObjectURL(new Blob([`WEBVTT\n\n00:00:00.000 --> ${end}\n${text}`], { type: 'text/vtt' }));
}

// ─── Sub-components ───

function ProcessingState({ video }: { video: Video }) {
  const cfg = STATUS[video.status] ?? STATUS[0];
  return (
    <div className="py-12">
      <span className={`font-mono text-[13px] ${cfg.text} flex items-center gap-2`}>
        <span aria-hidden="true" className={`w-2 h-2 rounded-full ${cfg.dot} motion-safe:animate-pulse`} />
        {cfg.label}
      </span>
      <p className="font-mono text-[11px] text-zinc-500 mt-2 max-w-xs">
        The processing pipeline is running. This page will update automatically.
      </p>
    </div>
  );
}

// ─── Video player ───

function VideoPlayer({
  videoId,
  streamFiles,
  transcript,
  segmentsJson,
  duration,
}: {
  videoId: string;
  streamFiles: StreamFile[];
  transcript: string | null;
  segmentsJson: string | null;
  duration: number;
}) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string>(streamFiles[0]?.s3Key ?? '');
  const [error, setError] = useState(false);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Build VTT caption blob — uses real segment timestamps when available
  useEffect(() => {
    if (!transcript) return;
    const url = buildVttUrl(transcript, duration, segmentsJson);
    setVttUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [transcript, segmentsJson, duration]);

  // Prefetch presigned URLs for all quality levels on mount.
  // Promise.allSettled so a single slow/failed fetch doesn't block the rest.
  useEffect(() => {
    let cancelled = false;
    setError(false);
    Promise.allSettled(
      streamFiles.map(async f => {
        const r = await fetch(
          `/api/videos/${encodeURIComponent(videoId)}/stream-url?key=${encodeURIComponent(f.s3Key)}`,
          { cache: 'no-store' },
        );
        if (!r.ok) throw new Error(`${r.status}`);
        const data: { url: string } = await r.json();
        return [f.s3Key, data.url] as [string, string];
      }),
    ).then(results => {
      if (cancelled) return;
      const entries = results
        .filter((r): r is PromiseFulfilledResult<[string, string]> => r.status === 'fulfilled')
        .map(r => r.value);
      if (entries.length === 0) {
        setError(true);
        setStatusMsg('Failed to load video.');
      } else {
        setUrlMap(Object.fromEntries(entries));
        setStatusMsg('Video player ready.');
      }
    });
    return () => { cancelled = true; };
  }, [videoId, streamFiles]);

  const src = urlMap[selectedKey];
  const hasMultiple = streamFiles.length > 1;

  return (
    <>
      {/* M1: announce player state to screen readers */}
      <span role="status" aria-live="polite" className="sr-only">{statusMsg}</span>

      {error && (
        <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 rounded-sm flex items-center justify-center">
          <p className="font-mono text-[11px] text-zinc-500">Failed to load stream URL.</p>
        </div>
      )}

      {!src && !error && (
        <div className={`w-full aspect-video bg-zinc-900 border border-zinc-800 flex items-center justify-center ${hasMultiple ? 'rounded-t-sm border-b-0' : 'rounded-sm'}`}>
          <span className="font-mono text-[11px] text-zinc-500 motion-safe:animate-pulse">loading…</span>
        </div>
      )}

      {src && (
        <video
          key={src}
          controls
          className={`w-full aspect-video bg-black ${hasMultiple ? 'rounded-t-sm' : 'rounded-sm'}`}
          preload="metadata"
        >
          <source src={src} />
          {/* H2: caption track from transcript content (single-cue VTT) */}
          {vttUrl && <track kind="subtitles" src={vttUrl} label="Transcript" default />}
          Your browser does not support video playback.
        </video>
      )}

      {/* Quality selector — only shown when multiple encodings are available */}
      {hasMultiple && !error && (
        <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-b-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">quality</span>
          <select
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            disabled={Object.keys(urlMap).length === 0}
            className="font-mono text-[11px] text-zinc-300 bg-zinc-950 border border-zinc-700 rounded-sm px-2 py-0.5 focus:outline-none focus:border-zinc-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Video quality"
          >
            {streamFiles.map(f => (
              <option key={f.s3Key} value={f.s3Key}>{f.label}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

// ─── Main component ───

export default function VideoDetail({
  initialVideo,
  initialTranscript,
  initialSegmentsJson,
}: {
  initialVideo: Video;
  initialTranscript: string | null;
  initialSegmentsJson: string | null;
}) {
  const router = useRouter();
  const [video, setVideo] = useState<Video>(initialVideo);
  const [transcript, setTranscript] = useState<string | null>(initialTranscript);
  const [segmentsJson, setSegmentsJson] = useState<string | null>(initialSegmentsJson);
  const [tick, setTick] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const transcriptFetchedRef = useRef(initialTranscript !== null);

  // Status polling — same tick-bump pattern as VideoList
  useEffect(() => {
    if (video.status === COMPLETED) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          router.push('/login?error=session_expired');
          return;
        }
        if (res.ok) {
          const fresh = (await res.json()) as Video;
          setVideo(fresh);
          return;
        }
      } catch { /* fall through */ }
      setTick(t => t + 1);
    }, POLL_MS);

    return () => clearTimeout(timer);
  }, [video, tick, router]);

  // Once status reaches COMPLETED, fetch transcript if we don't have it yet
  const fetchTranscript = useCallback(async () => {
    if (transcriptFetchedRef.current) return;
    transcriptFetchedRef.current = true;
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/transcript`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { content: string | null; segmentsJson?: string | null };
        setTranscript(data.content);
        setSegmentsJson(data.segmentsJson ?? null);
      }
    } catch { /* transcript is optional — ignore errors */ }
  }, [video.id]);

  useEffect(() => {
    if (video.status === COMPLETED) fetchTranscript();
  }, [video.status, fetchTranscript]);

  // All streamable encodings sorted highest quality first (1080p → 720p → 480p)
  const streamFiles = useMemo<StreamFile[]>(() =>
    video.files
      .map(f => ({ ...f, priority: FORMAT[f.format]?.streamPriority ?? 99 }))
      .filter(f => f.priority < 99)
      .sort((a, b) => a.priority - b.priority)
      .map(f => ({ s3Key: f.s3Key, label: FORMAT[f.format]!.label })),
    [video.files],
  );

  async function handleDownload(f: VideoFile) {
    if (downloadingIds.has(f.id)) return;
    setDownloadingIds(prev => new Set(prev).add(f.id));
    try {
      const label = FORMAT[f.format]?.label ?? 'video';
      const filename = `${video.title}-${label}.mp4`;
      const res = await fetch(
        `/api/videos/${encodeURIComponent(video.id)}/stream-url?key=${encodeURIComponent(f.s3Key)}&download=true&filename=${encodeURIComponent(filename)}`,
        { cache: 'no-store' },
      );
      if (res.status === 401) { router.push('/login?error=session_expired'); return; }
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingIds(prev => { const next = new Set(prev); next.delete(f.id); return next; });
    }
  }

  const isCompleted = video.status === COMPLETED;
  const isFailed = video.status === FAILED;
  const isInProgress = !TERMINAL.has(video.status);

  return (
    <div>
      {/* Screen-reader polling announcement */}
      <span role="status" aria-live="polite" className="sr-only">
        {isPolling ? `Video status: ${STATUS[video.status]?.label ?? 'unknown'}` : ''}
      </span>

      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[15px] font-medium text-white truncate">{video.title}</h1>
          <StatusBadge status={video.status} />
          {/* Fixed-size polling dot slot */}
          <span className="w-1.5 h-1.5 flex items-center justify-center shrink-0">
            {isPolling && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-sky-500 motion-safe:animate-pulse" />
            )}
          </span>
        </div>
        {/* M2: expanded touch target via negative margin offset */}
        <Link
          href="/dashboard"
          className="font-mono text-[11px] text-zinc-400 hover:text-white transition-colors duration-100 shrink-0 ml-4 py-3 px-2 -my-3 -mx-2"
        >
          ← back
        </Link>
      </div>

      {/* ── Video player (COMPLETED + streamable files exist) ── */}
      {isCompleted && streamFiles.length > 0 && (
        <div className="mb-6">
          <VideoPlayer
            videoId={video.id}
            streamFiles={streamFiles}
            transcript={transcript}
            segmentsJson={segmentsJson}
            duration={video.duration}
          />
        </div>
      )}

      {/* ── Processing / In-progress state ── */}
      {isInProgress && <ProcessingState video={video} />}

      {/* ── Error state ── */}
      {isFailed && (
        <div className="py-6 mb-6 border-b border-zinc-800/50">
          <p className="font-mono text-[13px] text-red-400 mb-1">pipeline failed.</p>
          {video.errorMessage && (
            <p className="font-mono text-[11px] text-zinc-500 wrap-break-word">{video.errorMessage}</p>
          )}
          <Link
            href="/upload"
            className="mt-4 inline-block font-mono text-[11px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 px-3 py-2 rounded-sm transition-colors duration-100"
          >
            upload another
          </Link>
        </div>
      )}

      {/* ── Metadata ── */}
      <div className="border border-zinc-800/70 rounded-sm mb-6">
        <div className="px-4">
          <MetaRow label="ID" value={video.id} />
          {video.originalResolution && (
            <MetaRow label="Resolution" value={video.originalResolution} />
          )}
          {video.duration > 0 && (
            <MetaRow label="Duration" value={formatDuration(video.duration)} />
          )}
          <MetaRow label="Uploaded" value={formatDate(video.createdAt)} />
          {video.completedAt && (
            <MetaRow label="Completed" value={formatDate(video.completedAt)} />
          )}
        </div>
      </div>

      {/* ── File list (only when files exist) ── */}
      {video.files.length > 0 && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Files</p>
          <div className="border border-zinc-800/70 rounded-sm">
            {video.files.map((f, i) => {
              const fmt = FORMAT[f.format];
              const isDownloadable = fmt !== undefined && fmt.streamPriority < 99;
              return (
                <div
                  key={f.id}
                  className={`flex items-center justify-between px-4 py-2.5 ${i < video.files.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                >
                  <span className="font-mono text-[12px] text-zinc-300">
                    {fmt?.label ?? `format-${f.format}`}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-zinc-500">
                      {formatBytes(Number(f.fileSize))}
                    </span>
                    {isDownloadable && (
                      <button
                        onClick={() => handleDownload(f)}
                        disabled={downloadingIds.has(f.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors duration-100 disabled:opacity-40 flex items-center"
                        aria-label={`Download ${fmt.label}`}
                      >
                        {downloadingIds.has(f.id)
                          ? <span className="font-mono text-[10px]">…</span>
                          : <Download size={13} />
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Transcript ── */}
      {transcript && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Transcript</p>
          <div className="border border-zinc-800/70 rounded-sm px-4 py-3 max-h-64 overflow-y-auto">
            <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
              {transcript}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
