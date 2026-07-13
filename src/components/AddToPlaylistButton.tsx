'use client';

import { useState } from 'react';

interface Playlist {
  id: string;
  name: string;
}

export default function AddToPlaylistButton({
  trackName,
  artistName,
  playlists,
}: {
  trackName: string;
  artistName: string;
  playlists: Playlist[];
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  async function add(playlistId: string) {
    setAdding(true);
    setMessage('');
    try {
      const res = await fetch('/api/add-track-to-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName, playlistId }),
      });
      const data = await res.json();
      setMessage(res.ok ? 'Added ✓' : data.error || 'Could not add.');
      if (res.ok) setTimeout(() => setOpen(false), 1200);
    } finally {
      setAdding(false);
    }
  }

  if (playlists.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-2.5 py-1 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
      >
        + Playlist
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-panel border border-line rounded-lg p-2 z-10 w-48 max-h-56 overflow-y-auto">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={adding}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-panel2 text-paper truncate disabled:opacity-50"
            >
              {p.name}
            </button>
          ))}
          {message && <p className="text-signal text-[10px] px-2 pt-1">{message}</p>}
        </div>
      )}
    </div>
  );
}
