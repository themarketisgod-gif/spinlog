'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function sync() {
    setState('loading');
    setMessage('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setState('error');
        setMessage(data?.error || `Sync failed (status ${res.status})`);
        return;
      }

      setState('done');
      setMessage(data.added > 0 ? `${data.added} new scrobble${data.added !== 1 ? 's' : ''}` : 'Up to date — nothing new');
      router.refresh();
      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 4000);
    } catch {
      setState('error');
      setMessage('Network error — could not reach the server.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sync}
        disabled={state === 'loading'}
        className="text-xs px-4 py-1.5 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
      >
        {state === 'loading' ? 'Syncing…' : state === 'done' ? 'Synced ✓' : state === 'error' ? 'Sync failed' : 'Sync Spotify'}
      </button>
      {message && (
        <p className={`text-xs max-w-xs text-right ${state === 'error' ? 'text-danger' : 'text-signal'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
