'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function GenreList({ genres }: { genres: { genre: string; count: number }[] }) {
  const [expanded, setExpanded] = useState(false);
  if (genres.length === 0) return null;

  const COMPACT_COUNT = 8;
  const shown = expanded ? genres : genres.slice(0, COMPACT_COUNT);
  const max = Math.max(...genres.map((g) => g.count));
  const hasMore = genres.length > COMPACT_COUNT;

  return (
    <div>
      <div className="space-y-2.5">
        {shown.map((g) => (
          <div key={g.genre}>
            <div className="flex items-center justify-between text-xs mb-1">
              <Link href={`/tags/${encodeURIComponent(g.genre)}`} className="text-paper capitalize hover:text-brass transition">
                {g.genre}
              </Link>
              <span className="text-muted font-mono">{g.count}×</span>
            </div>
            <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
              <div
                className="h-full bg-brass rounded-full"
                style={{ width: `${Math.max(4, (g.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted hover:text-brass transition mt-3"
        >
          {expanded ? 'Show top genres only' : `Show all ${genres.length} genres (more specific)`}
        </button>
      )}
    </div>
  );
}
