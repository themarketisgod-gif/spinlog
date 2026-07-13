'use client';

import { useState } from 'react';

interface Friend {
  username: string;
  name: string;
}

export default function CompareTaste({ friends }: { friends: Friend[] }) {
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<{ score: number; sharedArtists: string[]; otherName: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare(username: string) {
    setSelected(username);
    setResult(null);
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compatibility?with=${encodeURIComponent(username)}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (friends.length === 0) return null;

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mt-4">
      <p className="text-xs uppercase tracking-widest text-muted font-mono mb-3">
        Compare taste
      </p>
      <select
        value={selected}
        onChange={(e) => compare(e.target.value)}
        className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper w-full focus:outline-none focus:border-brass"
      >
        <option value="">Pick a friend…</option>
        {friends.map((f) => (
          <option key={f.username} value={f.username}>
            {f.name}
          </option>
        ))}
      </select>

      {loading && <p className="text-muted text-xs mt-3">Comparing…</p>}

      {result && !loading && (
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display italic text-3xl text-brass">{result.score}%</span>
            <span className="text-muted text-sm">match with {result.otherName}</span>
          </div>
          {result.sharedArtists.length > 0 ? (
            <p className="text-muted text-xs mt-2">
              Shared artists: {result.sharedArtists.slice(0, 8).join(', ')}
              {result.sharedArtists.length > 8 ? '…' : ''}
            </p>
          ) : (
            <p className="text-muted text-xs mt-2">No overlapping top artists yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
