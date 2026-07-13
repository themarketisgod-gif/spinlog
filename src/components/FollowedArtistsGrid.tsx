import type { FollowedArtist } from '@/lib/spotify';

export default function FollowedArtistsGrid({ artists }: { artists: FollowedArtist[] }) {
  if (artists.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
      {artists.map((a) => (
        <a
          key={a.name}
          href={a.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group text-center"
        >
          <div className="w-full aspect-square rounded-full bg-panel2 overflow-hidden mb-1.5">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-lg">
                ♪
              </div>
            )}
          </div>
          <div className="text-xs text-paper truncate group-hover:text-brass transition-colors">
            {a.name}
          </div>
        </a>
      ))}
    </div>
  );
}
