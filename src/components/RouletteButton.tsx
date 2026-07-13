'use client';

import { useState } from 'react';

interface RouletteTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string | null;
}

export default function RouletteButton({ tracks }: { tracks: RouletteTrack[] }) {
  const [picked, setPicked] = useState<RouletteTrack | null>(null);

  function spin() {
    if (tracks.length === 0) return;
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    setPicked(track);
  }

  return (
    <div>
      <button
        onClick={spin}
        disabled={tracks.length === 0}
        className="text-xs px-4 py-1.5 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition disabled:opacity-50"
      >
        🎲 Shuffle my past
      </button>
      {picked && (
        <div className="flex items-center gap-3 mt-3 bg-panel border border-line rounded-lg p-3 max-w-sm">
          <div className="w-10 h-10 rounded bg-panel2 flex-shrink-0 overflow-hidden">
            {picked.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.albumArt} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-paper text-sm truncate">{picked.trackName}</div>
            <div className="text-muted text-xs truncate">{picked.artistName}</div>
          </div>
          {picked.spotifyUri && (
            <a
              href={`https://open.spotify.com/track/${picked.spotifyUri.split(':').pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brass flex-shrink-0"
            >
              Open →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
