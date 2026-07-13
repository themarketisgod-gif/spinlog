'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Recommendation {
  id: string;
  trackName: string;
  artistName: string;
  albumArt: string | null;
  message: string | null;
  fromUser: { name: string | null; username: string };
}

export default function RecommendationsInbox() {
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/recommendations')
      .then((r) => r.json())
      .then((data) => setRecs(data.recommendations || []))
      .catch(() => setRecs([]));
  }, []);

  async function act(id: string, action: 'log' | 'dismiss') {
    setRecs((prev) => prev?.filter((r) => r.id !== id) ?? null);
    await fetch('/api/recommendations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (action === 'log') router.refresh();
  }

  if (!recs || recs.length === 0) return null;

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mb-8">
      <p className="text-xs uppercase tracking-widest text-muted font-mono mb-3">
        Recommended to you
      </p>
      <div className="space-y-3">
        {recs.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-panel2 flex-shrink-0 overflow-hidden">
              {r.albumArt && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-paper text-sm truncate">{r.trackName}</div>
              <div className="text-muted text-xs truncate">
                {r.artistName} · from {r.fromUser.name || r.fromUser.username}
              </div>
            </div>
            <button
              onClick={() => act(r.id, 'log')}
              className="text-xs px-3 py-1.5 rounded-full bg-brass text-ink font-medium flex-shrink-0"
            >
              Log it
            </button>
            <button
              onClick={() => act(r.id, 'dismiss')}
              className="text-xs px-2 py-1.5 text-muted hover:text-danger flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
