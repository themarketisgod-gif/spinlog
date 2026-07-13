import type { SpotifyPlaylist } from '@/lib/spotify';

export default function PlaylistsGrid({ playlists }: { playlists: SpotifyPlaylist[] }) {
  if (playlists.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-3">
      {playlists.map((p) => (
        <a
          key={p.name}
          href={p.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 ledger-row py-2.5 group"
        >
          <div className="w-10 h-10 rounded bg-panel2 flex-shrink-0 overflow-hidden">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                ♫
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-paper text-sm group-hover:text-brass transition-colors">
              {p.name}
            </div>
            <div className="text-muted text-xs font-mono">{p.trackCount} tracks</div>
          </div>
        </a>
      ))}
    </div>
  );
}
