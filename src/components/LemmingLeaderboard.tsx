import Link from 'next/link';
import type { LemmingEntry } from '@/lib/community';

export default function LemmingLeaderboard({ entries, profileUsername }: { entries: LemmingEntry[]; profileUsername?: string }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={`${e.trackName}::${e.artistName}`} className="flex items-start gap-3 bg-panel border border-line rounded-lg p-3">
          <span className="font-display italic text-2xl text-brass w-8 flex-shrink-0">{i + 1}</span>
          <div className="w-11 h-11 rounded bg-panel2 flex-shrink-0 overflow-hidden">
            {e.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.albumArt} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent(`${e.trackName} ${e.artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-paper text-sm font-medium truncate hover:text-brass transition"
            >
              {e.trackName}
            </a>
            <div className="text-muted text-xs truncate mb-1.5">
              {profileUsername ? (
                <Link
                  href={`/u/${profileUsername}/artist/${encodeURIComponent(e.artistName.split(',')[0].trim())}`}
                  className="hover:text-brass transition"
                >
                  {e.artistName}
                </Link>
              ) : (
                e.artistName
              )}{' '}
              · known in {e.wikidataSitelinks} Wikipedia languages
            </div>
            <p className="text-signal text-xs italic">{e.roast}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
