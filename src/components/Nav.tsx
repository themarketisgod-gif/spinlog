'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Nav() {
  const { data: session, status } = useSession();
  const username = (session?.user as any)?.username as string | undefined;

  return (
    <header className="border-b border-line">
      <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="font-display italic text-xl tracking-tight text-paper">
          spin<span className="text-brass">log</span>
        </Link>

        {status === 'authenticated' ? (
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/feed" className="text-muted hover:text-paper transition-colors">
              Feed
            </Link>
            <Link href="/leaderboard" className="text-muted hover:text-paper transition-colors">
              Leaderboard
            </Link>
            <Link href="/discover" className="text-muted hover:text-paper transition-colors">
              Discover
            </Link>
            <Link href="/concerts" className="text-muted hover:text-paper transition-colors">
              Concerts
            </Link>
            <Link href="/shelf" className="text-muted hover:text-paper transition-colors">
              Shelf
            </Link>
            <Link href="/log" className="text-muted hover:text-paper transition-colors">
              Log a scrobble
            </Link>
            <Link
              href={`/u/${username}`}
              className="text-muted hover:text-paper transition-colors"
            >
              My profile
            </Link>
            <Link href="/settings" className="text-muted hover:text-paper transition-colors">
              Settings
            </Link>
            <button
              onClick={() => signOut()}
              className="text-muted hover:text-danger transition-colors"
            >
              Sign out
            </button>
          </nav>
        ) : status === 'unauthenticated' ? (
          <button
            onClick={() => signIn('spotify')}
            className="text-sm px-4 py-1.5 rounded-full bg-brass text-ink font-medium hover:brightness-110 transition"
          >
            Sign in
          </button>
        ) : null}
      </div>
    </header>
  );
}
