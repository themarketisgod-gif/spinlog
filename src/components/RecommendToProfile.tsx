'use client';

import { useEffect, useState } from 'react';

interface SearchResult {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string;
}

export default function RecommendToProfile({ toUsername, displayName }: { toUsername: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  async function send(track: SearchResult) {
    await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUsername, ...track }),
    });
    setSent(track.trackName);
    setQuery('');
    setResults([]);
    setOpen(false);
    setTimeout(() => setSent(null), 3000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-4 py-1.5 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
      >
        🎁 Recommend a song to {displayName}
      </button>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-3 max-w-sm">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search a track to recommend…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
      />
      {results.length > 0 && (
        <div className="mt-2 space-y-1">
          {results.map((r) => (
            <button
              key={r.spotifyUri}
              onMouseDown={() => send(r)}
              className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-panel2 transition"
            >
              <div className="min-w-0">
                <div className="text-paper text-xs truncate">{r.trackName}</div>
                <div className="text-muted text-xs truncate">{r.artistName}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {sent && <p className="text-signal text-xs mt-2">Sent &quot;{sent}&quot; to {displayName}.</p>}
    </div>
  );
}
