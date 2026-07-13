import Link from 'next/link';
import type { RediscoveryItem } from '@/lib/stats';

function timeAgo(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function RediscoveryList({ items, profileUsername }: { items: RediscoveryItem[]; profileUsername?: string }) {
  if (items.length === 0) return null;

  return (
    <div>
      {items.map((item) => (
        <div key={`${item.trackName}::${item.artistName}`} className="ledger-row flex items-center gap-3 py-2.5">
          <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
            {item.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.albumArt} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent(`${item.trackName} ${item.artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-paper text-sm hover:text-brass transition"
            >
              {item.trackName}
            </a>
            {profileUsername ? (
              <Link
                href={`/u/${profileUsername}/artist/${encodeURIComponent(item.artistName.split(',')[0].trim())}`}
                className="block truncate text-muted text-xs hover:text-brass transition"
              >
                {item.artistName}
              </Link>
            ) : (
              <div className="truncate text-muted text-xs">{item.artistName}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-mono text-xs text-muted">{item.totalPlays}× before</div>
            <div className="text-xs text-muted">{timeAgo(item.lastPlayed)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
