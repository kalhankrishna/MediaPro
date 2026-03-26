'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── Types ───

interface Source {
  videoId: string;
  transcriptId: string;
  chunkText: string;
  similarity: number;
}

interface SearchResult {
  answer: string;
  sources: Source[];
}

type Phase = 'idle' | 'searching' | 'results' | 'no-content' | 'error';

// ─── Relevance enum ───
// Similarity scores are cosine similarity values in [0, 1].
// Ranges derived from typical pgvector cosine similarity distributions.

const RELEVANCE = [
  { label: 'exact',   min: 0.85, dot: 'bg-emerald-500', text: 'text-emerald-400' }, // success
  { label: 'strong',  min: 0.70, dot: 'bg-sky-500',     text: 'text-sky-400'     }, // accent
  { label: 'partial', min: 0.55, dot: 'bg-zinc-400',    text: 'text-zinc-400'    }, // neutral
  { label: 'weak',    min: 0,    dot: 'bg-red-500',     text: 'text-red-400'     }, // warning — poor match
] as const;

function getRelevance(similarity: number) {
  return RELEVANCE.find(r => similarity >= r.min) ?? RELEVANCE[RELEVANCE.length - 1];
}

// ─── Sub-components ───

function RelevanceBadge({ similarity }: { similarity: number }) {
  const r = getRelevance(similarity);
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${r.text}`}>
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
      {r.label}
    </span>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <Link
      href={`/videos/${source.videoId}`}
      title={source.chunkText}
      className="block border border-zinc-800/70 rounded-sm px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900/30 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400 transition-colors duration-100">
          excerpt
        </span>
        <RelevanceBadge similarity={source.similarity} />
      </div>
      <p className="text-[13px] text-zinc-300 leading-relaxed line-clamp-3 font-sans">
        {source.chunkText}
      </p>
    </Link>
  );
}

// ─── Main component ───

export default function SearchForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || phase === 'searching') return;

    setPhase('searching');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        cache: 'no-store',
      });

      if (res.status === 401) {
        router.push('/login?error=session_expired');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as SearchResult;

      if (data.sources.length === 0) {
        setPhase('no-content');
        return;
      }

      setResult(data);
      setPhase('results');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Search failed');
      setPhase('error');
    }
  }, [query, phase, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const reset = () => {
    setQuery('');
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
    inputRef.current?.focus();
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[15px] font-medium text-white">Search</h1>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] text-zinc-400 hover:text-white transition-colors duration-100 py-3 px-2 -my-3 -mx-2"
        >
          ← back
        </Link>
      </div>

      {/* Search input — label is sr-only to keep visual design clean */}
      <div className="flex items-center gap-3 mb-8">
        <label htmlFor="search-query" className="sr-only">Search transcripts</label>
        <input
          ref={inputRef}
          id="search-query"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="search across all transcripts…"
          disabled={phase === 'searching'}
          autoFocus
          className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-sm px-3 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors duration-100 font-sans disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={!query.trim() || phase === 'searching'}
          className="font-mono text-[12px] text-white border border-zinc-700 hover:border-zinc-500 px-4 py-3 rounded-sm transition-colors duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {phase === 'searching' ? 'searching…' : 'search'}
        </button>
      </div>

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <p className="font-mono text-[11px] text-zinc-500">
          queries are matched against transcript embeddings using cosine similarity
        </p>
      )}

      {/* ── Searching ── */}
      {phase === 'searching' && (
        <div className="py-8">
          <p className="font-mono text-[12px] text-zinc-400 motion-safe:animate-pulse">
            searching…
          </p>
        </div>
      )}

      {/* ── No content ── */}
      {phase === 'no-content' && (
        <div className="py-8">
          <p className="font-mono text-[13px] text-zinc-400 mb-1">no transcribed videos yet.</p>
          <p className="font-mono text-[11px] text-zinc-500">
            <Link href="/upload" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
              Upload a video
            </Link>
            {' '}to start the processing pipeline.
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="py-8">
          <p className="font-mono text-[13px] text-red-400 mb-1">search failed.</p>
          <p className="font-mono text-[11px] text-zinc-500 mb-4">{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 px-3 py-2 rounded-sm transition-colors duration-100 cursor-pointer"
          >
            try again
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && result && (
        <div>
          {/* Answer */}
          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Answer</p>
            <div className="border border-zinc-800/70 rounded-sm px-4 py-3">
              <p className="text-[13px] text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap">
                {result.answer}
              </p>
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Sources
              </p>
              <span className="font-mono text-[11px] text-zinc-500">{result.sources.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {result.sources.map((source, i) => (
                <SourceCard key={`${source.videoId}-${i}`} source={source} />
              ))}
            </div>
          </div>

          {/* New search */}
          <button
            type="button"
            onClick={reset}
            className="mt-6 font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-100 cursor-pointer py-3 px-2 -mb-3 -mx-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
          >
            ← new search
          </button>
        </div>
      )}

      {/* Screen-reader status */}
      <span role="status" aria-live="polite" className="sr-only">
        {phase === 'searching' ? 'Searching…' : ''}
        {phase === 'results' ? `Found ${result?.sources.length ?? 0} sources.` : ''}
        {phase === 'no-content' ? 'No transcribed videos found.' : ''}
        {phase === 'error' ? `Search failed: ${errorMsg}` : ''}
      </span>
    </div>
  );
}
