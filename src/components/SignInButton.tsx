'use client';

import { signIn } from 'next-auth/react';

export default function SignInButton() {
  return (
    <button
      onClick={() => signIn('spotify')}
      className="px-5 py-2.5 rounded-full bg-brass text-ink font-medium text-sm hover:brightness-110 transition"
    >
      Sign in with Spotify
    </button>
  );
}
