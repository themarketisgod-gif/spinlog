'use client';

import { useState } from 'react';

interface SimilarTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string | null;
  sharedTags: string[];
  loggedByCount: number;
}

export default function DiscoverForm({ playlists }: { playlists: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimilarTrack[] | null>(null);
  const [error, setError] = useState('');
  const [seedTags, setSeedTags] = useState<string[]>([]);

  async function run() {
    if (!selected) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/similar-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setResults(data.results || []);
      setSeedTags(data.seedTags || []);
      if ((data.results || []).length === 0 && data.reason) setError(data.reason);
    } finally {
      setLoading(false);
    }
  }

  if (playlists.length === 0) {
    return (
      <p className="text-muted text-sm">
        No Spotify playlists found on your account to use as a seed.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper focus:outline-none focus:border-brass"
        >
          <option value="">Pick a playlist…</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!selected || loading}
          className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Matching…' : 'Find matches'}
        </button>
      </div>

      {seedTags.length > 0 && (
        <p className="text-muted text-xs mt-3">Matched on: {seedTags.join(', ')}</p>
      )}

      {error && <p className="text-danger text-xs mt-3">{error}</p>}

      {results && results.length > 0 && (
        <div className="mt-5 space-y-3">
          {results.map((r) => (
            <div key={`${r.trackName}::${r.artistName}`} className="ledger-row flex items-center gap-3 py-2.5">
              <div className="w-10 h-10 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                {r.albumArt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-paper text-sm truncate">{r.trackName}</div>
                <div className="text-muted text-xs truncate">
                  {r.artistName} · shared: {r.sharedTags.join(', ')}
                </div>
              </div>
              <span className="text-xs text-muted flex-shrink-0">
                {r.loggedByCount} {r.loggedByCount === 1 ? 'person' : 'people'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
