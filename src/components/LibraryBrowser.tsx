'use client';

import { useMemo, useState } from 'react';

interface ArtistEntry {
  name: string;
  count: number;
  firstPlayed: string;
  lastPlayed: string;
}

export default function LibraryBrowser({ artists }: { artists: ArtistEntry[] }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'recent'>('name');

  const filtered = useMemo(() => {
    let list = artists;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'count') sorted.sort((a, b) => b.count - a.count);
    else if (sortBy === 'recent') sorted.sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime());
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [artists, query, sortBy]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists…"
          className="flex-1 min-w-[180px] bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
        />
        <div className="flex gap-1.5">
          {(['name', 'count', 'recent'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                sortBy === opt ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
              }`}
            >
              {opt === 'name' ? 'A–Z' : opt === 'count' ? 'Most played' : 'Recently played'}
            </button>
          ))}
        </div>
      </div>

      <div>
        {filtered.length === 0 && <p className="text-muted text-sm py-6">No artists match.</p>}
        {filtered.map((a) => (
          <div key={a.name} className="ledger-row flex items-center justify-between py-2.5">
            <span className="text-paper text-sm truncate">{a.name}</span>
            <span className="font-mono text-xs text-muted flex-shrink-0">{a.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}
