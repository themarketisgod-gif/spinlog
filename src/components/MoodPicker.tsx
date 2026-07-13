'use client';

import { useState } from 'react';

const MOODS: { value: string; emoji: string }[] = [
  { value: 'happy', emoji: '😊' },
  { value: 'sad', emoji: '😢' },
  { value: 'hype', emoji: '⚡' },
  { value: 'chill', emoji: '😌' },
  { value: 'heartbroken', emoji: '💔' },
  { value: 'angry', emoji: '😠' },
  { value: 'focus', emoji: '🎯' },
  { value: 'love', emoji: '🥰' },
];

export default function MoodPicker({ playId, initialMood }: { playId: string; initialMood?: string | null }) {
  const [mood, setMood] = useState<string | null>(initialMood || null);
  const [open, setOpen] = useState(false);

  async function pick(value: string) {
    const next = value === mood ? null : value;
    setMood(next);
    setOpen(false);
    await fetch('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playId, mood: next }),
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted hover:text-brass transition"
        title="How did this feel?"
      >
        {mood ? MOODS.find((m) => m.value === mood)?.emoji : '+ mood'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-panel border border-line rounded-lg p-1.5 flex gap-1 z-10">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => pick(m.value)}
              className={`text-base w-7 h-7 rounded hover:bg-panel2 transition ${mood === m.value ? 'bg-panel2' : ''}`}
              title={m.value}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
