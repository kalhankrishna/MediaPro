import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const STACK = [
  'gRPC', 'ts-proto', 'BullMQ', 'ioredis',
  'pgvector', 'Prisma 7', 'AWS S3',
  'Groq Whisper', 'Voyage AI', 'MCP', 'Next.js 16',
];

export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.get('access_token')) redirect('/dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-background text-white">

      {/* Main content — vertically centred */}
      <main className="flex-1 flex flex-col justify-center items-center px-8 sm:px-16 lg:px-24 py-12 sm:py-0">
        <div className="w-full max-w-xl text-center sm:text-left">

          {/* Category label — sets context before the wordmark */}
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-zinc-500 mb-8 sm:mb-12">
            Distributed Video Infrastructure
          </p>

          {/* Wordmark */}
          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tight leading-none text-white mb-3 sm:mb-4">
            MediaPro
          </h1>

          {/* Pipeline — tagline for the wordmark; tight to h1, generous below */}
          <p className="font-mono text-xs sm:text-sm text-zinc-500 mb-10 sm:mb-12 tracking-wide leading-relaxed">
            RAW → 480p · 720p · 1080p → transcript → embeddings → /search
          </p>

          {/* Description */}
          <p className="text-zinc-400 text-[15px] leading-7 mb-8 max-w-sm">
            Video processing pipeline with gRPC microservices,
            BullMQ workers, semantic search, and an MCP server
            for agentic access.
          </p>

          {/* CTA */}
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-5 py-3 bg-white text-zinc-950 text-sm font-medium rounded hover:bg-zinc-100 transition-colors duration-150"
          >
            Sign in with GitHub
            <span className="text-zinc-600">→</span>
          </Link>
        </div>
      </main>

      {/* Stack strip — pinned to bottom */}
      <footer className="px-8 sm:px-16 lg:px-24 py-5 sm:py-7 border-t border-zinc-900">
        <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2">
          {STACK.map((tech) => (
            <span key={tech} className="font-mono text-[11px] text-zinc-500">
              {tech}
            </span>
          ))}
        </div>
      </footer>

    </div>
  );
}
