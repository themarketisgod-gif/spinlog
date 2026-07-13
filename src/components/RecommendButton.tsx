'use client';

import { useState } from 'react';

interface Friend {
  username: string;
  name: string;
}

interface Track {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string | null;
}

export default function RecommendButton({ friends, track }: { friends: Friend[]; track: Track }) {
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send(username: string) {
    setOpen(false);
    try {
      await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUsername: username, ...track }),
      });
      setSentTo(username);
      setTimeout(() => setSentTo(null), 2500);
    } catch {
      // silent fail — non-critical action
    }
  }

  return (
    <div className="relative flex-shrink-0 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-2.5 py-1 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
        title="Recommend this to a friend"
      >
        🎁
      </button>
      {sentTo && (
        <span className="absolute right-0 top-full mt-1 text-[10px] text-signal whitespace-nowrap">
          Sent to {sentTo}
        </span>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-panel border border-line rounded-lg py-1 z-10 min-w-[140px]">
          {friends.map((f) => (
            <button
              key={f.username}
              onClick={() => send(f.username)}
              className="block w-full text-left px-3 py-1.5 text-xs text-paper hover:bg-panel2 transition"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
