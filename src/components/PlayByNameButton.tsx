'use client';

import { useState } from 'react';

export default function PlayByNameButton({ trackName, artistName }: { trackName: string; artistName: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  async function play() {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/play-track-by-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not play');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <span className="relative">
      <button
        onClick={play}
        disabled={status === 'loading'}
        title="Play on Spotify"
        className="text-xs text-muted hover:text-brass transition disabled:opacity-50"
      >
        ▶
      </button>
      {status === 'error' && (
        <span className="absolute right-0 top-full mt-1 text-[10px] text-danger whitespace-nowrap z-10 bg-panel border border-line rounded px-2 py-1">
          {error}
        </span>
      )}
    </span>
  );
}
