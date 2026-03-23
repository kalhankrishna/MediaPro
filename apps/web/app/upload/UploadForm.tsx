'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ───

type Phase = 'idle' | 'selected' | 'uploading' | 'confirming' | 'done' | 'error';

interface FileMeta {
  file: File;
  title: string;
  duration: number;
  resolution: string;
}

// ─── Helpers ───

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
}

function extractVideoMeta(file: File): Promise<{ duration: number; resolution: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? Math.round(video.duration) : 0;
      const resolution =
        video.videoWidth && video.videoHeight
          ? `${video.videoWidth}x${video.videoHeight}`
          : '';
      URL.revokeObjectURL(url);
      resolve({ duration, resolution });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0, resolution: '' });
    };
    video.src = url;
  });
}

// Returns the XHR so the caller can abort() it mid-upload.
function startS3Upload(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): { xhr: XMLHttpRequest; promise: Promise<void> } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
  return { xhr, promise };
}

const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];

function getContentType(file: File): string {
  if (file.type && ACCEPTED.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', webm: 'video/webm',
  };
  return map[ext] ?? 'video/mp4';
}

// ─── Sub-components ───

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">{label}</span>
      <span className="font-mono text-[12px] text-zinc-300 truncate max-w-[60%] text-right ml-4">{value}</span>
    </div>
  );
}

// ─── Main component ───

export default function UploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // Tracks the video record created on the server — used to clean up if the
  // upload is cancelled or fails before confirmUpload runs.
  const videoIdRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-redirect after success
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(() => router.push('/dashboard'), 1800);
    return () => clearTimeout(timer);
  }, [phase, router]);

  const handleFile = useCallback(async (file: File) => {
    const contentType = getContentType(file);
    if (!ACCEPTED.includes(contentType)) {
      setErrorMsg('Unsupported file type. Accepted: mp4, mov, avi, mkv, webm.');
      setPhase('error');
      return;
    }
    const { duration, resolution } = await extractVideoMeta(file);
    setMeta({ file, title: titleFromFilename(file.name), duration, resolution });
    setPhase('selected');
  }, []);

  // Drag events — counter handles child element re-entries
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const onDropZoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!meta || phase !== 'selected') return;
    setPhase('uploading');
    setProgress(0);

    try {
      const contentType = getContentType(meta.file);

      // 1. Create video record + get presigned URL
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: meta.title.trim() || titleFromFilename(meta.file.name),
          originalResolution: meta.resolution,
          duration: meta.duration,
          contentType,
        }),
      });

      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${initRes.status}`);
      }

      const { videoId, uploadUrl } = await initRes.json() as { videoId: string; uploadUrl: string };
      videoIdRef.current = videoId;

      // 2. Upload directly to S3
      const { xhr, promise } = startS3Upload(uploadUrl, meta.file, contentType, setProgress);
      xhrRef.current = xhr;
      await promise;
      xhrRef.current = null;

      // 3. Confirm
      setPhase('confirming');
      const confirmRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm upload with server');
      }

      videoIdRef.current = null; // confirmed — no longer needs cleanup
      setPhase('done');
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') {
        // handleCancelUpload already called the cancel API — just reset UI
        reset();
        return;
      }
      // Error after createVideo ran — attempt best-effort cleanup
      const orphanedId = videoIdRef.current;
      if (orphanedId) {
        videoIdRef.current = null;
        fetch('/api/upload/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: orphanedId }),
        }).catch(() => {});
      }
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      setPhase('error');
    }
  }, [meta, phase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setMeta(null);
    setProgress(0);
    setErrorMsg('');
    setPhase('idle');
    dragCounterRef.current = 0;
    setIsDragging(false);
    videoIdRef.current = null;
  }, []);

  const handleCancelUpload = useCallback(() => {
    // Grab and clear the videoId before abort so the catch block in handleUpload
    // doesn't also try to clean it up (it checks === 'cancelled').
    const videoId = videoIdRef.current;
    videoIdRef.current = null;
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (videoId) {
      fetch('/api/upload/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      }).catch(() => {});
    }
    // reset() is called via the 'cancelled' error path in handleUpload
  }, []);

  const srStatus = (() => {
    if (phase === 'uploading') return `Uploading${meta ? ` ${meta.file.name}` : ''}… ${progress}%`;
    if (phase === 'confirming') return 'Upload complete. Confirming with server…';
    if (phase === 'done') return 'Upload successful. Redirecting to dashboard.';
    if (phase === 'error') return `Upload failed: ${errorMsg}`;
    return '';
  })();

  // ─── Render ───

  return (
    <div>
      <span role="status" aria-live="polite" className="sr-only">{srStatus}</span>

      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[15px] font-medium text-white">Upload</h1>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] text-zinc-400 hover:text-white transition-colors duration-100 focus-visible:outline-none focus-visible:text-white"
        >
          ← back
        </Link>
      </div>

      {/* ── Idle / Drop zone ── */}
      {phase === 'idle' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload video file — click or drag and drop"
          onKeyDown={onDropZoneKeyDown}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            'border border-dashed rounded-sm cursor-pointer select-none',
            'flex flex-col items-center justify-center gap-2',
            'py-20 px-8 transition-colors duration-100',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500',
            'active:bg-zinc-900/40',
            isDragging
              ? 'border-zinc-600 bg-zinc-900/30'
              : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/20',
          ].join(' ')}
        >
          <p className="font-mono text-[13px] text-zinc-400">
            {isDragging ? 'drop to select' : 'drop a video file here'}
          </p>
          <p className="font-mono text-[11px] text-zinc-400">
            or{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="hover:text-white underline underline-offset-2 transition-colors duration-100 cursor-pointer"
            >
              browse
            </button>
          </p>
          <p className="font-mono text-[10px] text-zinc-500 mt-1">
            mp4 · mov · avi · mkv · webm
          </p>
        </div>
      )}

      {/* ── File selected ── */}
      {phase === 'selected' && meta && (
        <div>
          {/* Title input */}
          <div className="mb-5">
            <label
              htmlFor="video-title"
              className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5"
            >
              Title
            </label>
            <input
              id="video-title"
              type="text"
              value={meta.title}
              autoFocus
              onChange={(e) => setMeta(m => m ? { ...m, title: e.target.value } : m)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-sm px-3 py-2 text-[13px] text-white placeholder-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 transition-colors duration-100 font-sans"
              placeholder="Video title"
              maxLength={255}
            />
          </div>

          {/* File metadata */}
          <div className="border border-zinc-800/70 rounded-sm mb-5">
            <div className="px-4">
              <MetaRow label="File" value={meta.file.name} />
              <MetaRow label="Size" value={formatBytes(meta.file.size)} />
              <MetaRow label="Type" value={getContentType(meta.file)} />
              {meta.resolution && <MetaRow label="Resolution" value={meta.resolution} />}
              {meta.duration > 0 && <MetaRow label="Duration" value={formatDuration(meta.duration)} />}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleUpload}
              disabled={phase !== 'selected'}
              className="font-mono text-[12px] text-white border border-zinc-700 hover:border-zinc-500 active:border-zinc-400 active:text-zinc-200 px-4 py-2 rounded-sm transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              upload
            </button>
            <button
              type="button"
              onClick={reset}
              className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 active:text-zinc-200 transition-colors duration-100 cursor-pointer px-2 py-2.5 min-h-11 inline-flex items-center focus-visible:outline-none focus-visible:text-zinc-300"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Uploading ── */}
      {phase === 'uploading' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[12px] text-zinc-400">uploading…</p>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[12px] text-sky-400">{progress}%</span>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 active:text-zinc-200 transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:text-zinc-300"
              >
                cancel
              </button>
            </div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
            className="h-px bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-sky-500 transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          {meta && (
            <p className="font-mono text-[11px] text-zinc-500 mt-3 truncate">{meta.file.name}</p>
          )}
        </div>
      )}

      {/* ── Confirming ── */}
      {phase === 'confirming' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[12px] text-zinc-400">confirming…</p>
            <span className="font-mono text-[12px] text-sky-400">100%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
            className="h-px bg-zinc-800 rounded-full overflow-hidden"
          >
            <div className="h-full bg-sky-500 w-full" />
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="py-8">
          <p className="font-mono text-[13px] text-emerald-400 mb-1">uploaded.</p>
          <p className="font-mono text-[11px] text-zinc-500">
            Processing will begin shortly. Redirecting to{' '}
            <Link href="/dashboard" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
              dashboard
            </Link>
            …
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="py-8">
          <p className="font-mono text-[13px] text-red-400 mb-1">upload failed.</p>
          <p className="font-mono text-[11px] text-zinc-500 mb-4 wrap-break-word">{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] text-zinc-400 hover:text-white active:text-zinc-200 border border-zinc-800 hover:border-zinc-700 active:border-zinc-600 px-3 py-2 rounded-sm transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            try again
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
        className="sr-only"
        onChange={onInputChange}
        aria-label="Select video file"
      />
    </div>
  );
}
