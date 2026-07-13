'use client';

import { useState } from 'react';

export default function ExportPlaylistButton({ range }: { range: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [error, setError] = useState('');

  async function run() {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/export-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setState('error');
        return;
      }
      setPlaylistUrl(data.playlistUrl);
      setState('done');
    } catch {
      setError('Something went wrong');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <a
        href={playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-4 py-1.5 rounded-full bg-signal text-ink font-medium"
      >
        Open playlist in Spotify →
      </a>
    );
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="text-xs px-4 py-1.5 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
      >
        {state === 'loading' ? 'Creating…' : 'Export top tracks to Spotify'}
      </button>
      {state === 'error' && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}
