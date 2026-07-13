'use client';

import { useState } from 'react';
import PlayButton from '@/components/PlayButton';

interface SimilarTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string | null;
  sharedTags: string[];
  loggedByCount: number;
}

export default function SimilarTracksPanel({ artistName, canPlay }: { artistName: string; canPlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimilarTrack[] | null>(null);
  const [reason, setReason] = useState('');

  async function find() {
    setOpen(true);
    if (results) return; // already fetched
    setLoading(true);
    try {
      const res = await fetch(`/api/similar?artistName=${encodeURIComponent(artistName)}`);
      const data = await res.json();
      setResults(data.results || []);
      setReason(data.reason || '');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={find} className="text-xs text-muted hover:text-brass transition">
        Find similar →
      </button>

      {open && (
        <div className="mt-2 bg-panel border border-line rounded-lg p-3">
          {loading && <p className="text-muted text-xs">Matching by genre tags…</p>}
          {!loading && results && results.length === 0 && (
            <p className="text-muted text-xs">
              {reason || 'Nothing in the group matches yet.'}
            </p>
          )}
          {!loading && results && results.length > 0 && (
            <div className="space-y-2.5">
              {results.map((r) => (
                <div key={`${r.trackName}::${r.artistName}`} className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                    {r.albumArt && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-paper text-xs truncate">{r.trackName}</div>
                    <div className="text-muted text-xs truncate">
                      {r.artistName} · shared: {r.sharedTags.join(', ')}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted flex-shrink-0">
                    {r.loggedByCount} {r.loggedByCount === 1 ? 'person' : 'people'}
                  </span>
                  {canPlay && r.spotifyUri && (
                    <span className="flex-shrink-0">
                      <PlayButton spotifyUri={r.spotifyUri} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
