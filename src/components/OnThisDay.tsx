import Link from 'next/link';
import type { OnThisDayGroup } from '@/lib/community';

export default function OnThisDay({ groups, profileUsername }: { groups: OnThisDayGroup[]; profileUsername?: string }) {
  if (groups.length === 0) {
    return (
      <p className="text-muted text-sm py-2">
        Nothing yet — check back once your history spans more than a year.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.year}>
          <p className="font-mono text-xs text-brass mb-1.5">{g.year}</p>
          <ul className="space-y-1">
            {g.tracks.map((t) => (
              <li key={`${t.trackName}::${t.artistName}`} className="text-sm">
                <a
                  href={`https://open.spotify.com/search/${encodeURIComponent(`${t.trackName} ${t.artistName}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper hover:text-brass transition"
                >
                  {t.trackName}
                </a>{' '}
                <span className="text-muted">
                  —{' '}
                  {profileUsername ? (
                    <Link
                      href={`/u/${profileUsername}/artist/${encodeURIComponent(t.artistName.split(',')[0].trim())}`}
                      className="hover:text-brass transition"
                    >
                      {t.artistName}
                    </Link>
                  ) : (
                    t.artistName
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
