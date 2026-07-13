'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LastfmImportForm() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function run(mode: 'scrobbles' | 'loved') {
    if (!username.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/import-lastfm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Something went wrong');
        setStatus('error');
        return;
      }
      // Saves it for later — used to build direct "view on Last.fm" links
      // next to imported plays, since Last.fm's API can't delete a
      // scrobble; that's only possible from their website.
      fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastfmUsername: username.trim() }),
      }).catch(() => {});
      setMessage(`Imported ${data.added} of ${data.checked} tracks checked.`);
      setStatus('idle');
      router.refresh();
    } catch {
      setMessage('Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Your Last.fm username"
        className="w-full max-w-xs bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => run('scrobbles')}
          disabled={status === 'loading' || !username.trim()}
          className="text-xs px-4 py-2 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
        >
          {status === 'loading' ? 'Importing…' : 'Import scrobble history'}
        </button>
        <button
          onClick={() => run('loved')}
          disabled={status === 'loading' || !username.trim()}
          className="text-xs px-4 py-2 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
        >
          {status === 'loading' ? 'Importing…' : 'Import loved tracks'}
        </button>
      </div>
      {message && (
        <p className={`text-xs mt-2 ${status === 'error' ? 'text-danger' : 'text-signal'}`}>{message}</p>
      )}
      <p className="text-muted text-xs mt-2 max-w-md">
        Pulls up to 1,000 tracks per import. Your Last.fm history needs to be
        public (the default) for this to work — no login to Last.fm required.
      </p>
    </div>
  );
}
