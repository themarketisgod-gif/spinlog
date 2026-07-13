'use client';

import { useEffect, useState } from 'react';

const ROTATE_MS = 3 * 60 * 1000; // every 3 minutes

export default function MusicianFacts({ artistName, facts }: { artistName: string; facts: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (facts.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % facts.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [facts.length]);

  if (facts.length === 0) return null;

  return (
    <div className="bg-panel border border-line rounded-lg px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-1.5">
        🎵 Did you know — {artistName}
      </p>
      <p className="text-paper text-sm italic">{facts[index]}</p>
      {facts.length > 1 && (
        <div className="flex gap-1 mt-2">
          {facts.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-4 rounded-full transition ${i === index ? 'bg-brass' : 'bg-panel2'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
