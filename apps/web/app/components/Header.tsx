'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'dashboard', href: '/dashboard' },
  { label: 'search',    href: '/search'    },
  { label: 'api keys',  href: '/api-keys'  },
] as const;

export default function Header({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="h-11 border-b border-zinc-800/70 px-6 flex items-center justify-between shrink-0">
      <Link
        href="/dashboard"
        className="font-mono text-[13px] tracking-tight text-white hover:text-zinc-300 transition-colors duration-100"
      >
        MediaPro
      </Link>

      <div className="flex items-center gap-5">
        {/* Nav — hidden on mobile, shown at sm+ */}
        <nav className="hidden sm:flex items-center gap-4" aria-label="Main navigation">
          {NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`font-mono text-[11px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm ${
                pathname === href
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

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
  );
}
