'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportLikedButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [added, setAdded] = useState<number | null>(null);
  const router = useRouter();

  async function run() {
    setState('loading');
    try {
      const res = await fetch('/api/import-liked', { method: 'POST' });
      const data = await res.json();
      setAdded(data.added ?? 0);
      setState('done');
      router.refresh();
    } catch {
      setState('idle');
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="text-xs px-4 py-1.5 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
      >
        {state === 'loading'
          ? 'Importing…'
          : state === 'done'
          ? `Imported ${added} track${added === 1 ? '' : 's'}`
          : 'Import liked songs'}
      </button>
      {state === 'idle' && (
        <p className="text-muted text-xs mt-2 max-w-sm">
          Pulls up to 500 songs from your Spotify Likes as historical scrobbles,
          timestamped to when you saved them.
        </p>
      )}
    </div>
  );
}
