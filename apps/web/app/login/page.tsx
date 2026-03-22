import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Sign in — MediaPro',
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'GitHub authentication failed. Please try again.',
  session_expired: 'Session expired. Please start the sign-in flow again.',
  csrf: 'Security check failed. Please try again.',
  no_email: 'No verified email found on your GitHub account.',
  server_error: 'Something went wrong on our end. Please try again shortly.',
};

const STACK_TAGS = ['gRPC', 'BullMQ', 'pgvector', 'MCP'];

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  if (cookieStore.get('access_token')) {
    redirect('/dashboard');
  }

  const { error } = await props.searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? 'Authentication failed. Please try again.')
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        <h1 className="text-2xl font-bold tracking-tight text-white">MediaPro</h1>
        <p className="mt-1 text-sm text-zinc-400">Distributed video processing infrastructure.</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STACK_TAGS.map((tag) => (
            <span
              key={tag}
              className="font-mono text-xs text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 border-t border-zinc-800" />

        <a
          href="/api/auth/github"
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
        >
          <GitHubIcon />
          Continue with GitHub
        </a>

        {errorMessage && (
          <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
        )}

        <p className="mt-12 text-xs text-zinc-600">
          Portfolio project ·{' '}
          <a
            href="https://github.com/kalhankrishna/MediaPro"
            className="hover:text-zinc-400 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source
          </a>
        </p>

      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
