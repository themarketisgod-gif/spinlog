'use client';

import { useEffect, useState } from 'react';

interface SavedAlbum {
  name: string;
  artistName: string;
  image: string | null;
  spotifyUrl: string;
}

export default function AlbumsGrid() {
  const [albums, setAlbums] = useState<SavedAlbum[] | null>(null);

  useEffect(() => {
    fetch('/api/albums')
      .then((r) => r.json())
      .then((data) => setAlbums(data.albums || []))
      .catch(() => setAlbums([]));
  }, []);

  if (!albums || albums.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
      {albums.map((a) => (
        <a
          key={a.spotifyUrl}
          href={a.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <div className="w-full aspect-square rounded bg-panel2 overflow-hidden mb-1.5">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">♫</div>
            )}
          </div>
          <div className="text-xs text-paper truncate group-hover:text-brass transition-colors">
            {a.name}
          </div>
          <div className="text-xs text-muted truncate">{a.artistName}</div>
        </a>
      ))}
    </div>
  );
}
