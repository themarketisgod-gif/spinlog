'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TagInput({
  artistName,
  trackName,
  existingTags,
}: {
  artistName: string;
  trackName: string;
  existingTags: string[];
}) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(existingTags);
  const router = useRouter();

  async function addTag() {
    const value = input.trim();
    if (!value) return;
    setInput('');
    setTags((t) => [...new Set([...t, value.toLowerCase()])]);
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'track', artistName, trackName, tag: value }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((t) => (
        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-line text-muted">
          {t}
        </span>
      ))}
      {open ? (
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          onBlur={() => setOpen(false)}
          placeholder="tag…"
          className="text-[10px] w-16 bg-panel2 border border-line rounded-full px-2 py-0.5 text-paper focus:outline-none focus:border-brass"
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] px-2 py-0.5 rounded-full border border-line text-muted hover:text-brass transition"
        >
          + tag
        </button>
      )}
    </div>
  );
}
