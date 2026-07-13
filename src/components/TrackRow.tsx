import Link from 'next/link';

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MANUAL_SOURCE_LABELS: Record<string, string> = {
  apple_music: 'Apple Music',
  youtube_music: 'YouTube Music',
  pandora: 'Pandora',
  vinyl: 'vinyl',
  live: 'live show',
  other: 'logged',
};

export default function TrackRow({
  trackName,
  artistName,
  albumArt,
  playedAt,
  source,
  manualSource,
  listenerName,
  showListenLinks,
  rating,
  disliked,
  seenLive,
  seenLiveConcertId,
  weatherIcon,
  weatherTemp,
  ownedFormat,
  ownedMediaId,
  profileUsername,
  genreTags,
  funFact,
}: {
  trackName: string;
  artistName: string;
  albumArt?: string | null;
  playedAt: Date;
  source: 'spotify' | 'manual' | string;
  manualSource?: string | null;
  listenerName?: string;
  showListenLinks?: boolean;
  rating?: number;
  disliked?: boolean;
  seenLive?: boolean;
  seenLiveConcertId?: string | null;
  weatherIcon?: string;
  weatherTemp?: string;
  ownedFormat?: string | null;
  ownedMediaId?: string | null;
  profileUsername?: string;
  genreTags?: string[];
  funFact?: string;
}) {
  const badgeLabel =
    source === 'manual'
      ? MANUAL_SOURCE_LABELS[manualSource || 'other'] || 'logged'
      : source === 'library'
      ? 'liked'
      : source === 'lastfm'
      ? manualSource === 'loved'
        ? 'Last.fm ❤️'
        : 'Last.fm'
      : 'spotify';

  const query = encodeURIComponent(`${trackName} ${artistName}`);

  // Two glow tiers: a true top rating (10/10) gets the warm gold pulse,
  // a strong-but-not-perfect rating (8-9) gets a dimmer teal pulse — so
  // "great" and "favorite" read as visually distinct at a glance.
  const glowClass = rating === 10 ? 'rating-glow' : rating !== undefined && rating >= 8 ? 'rating-glow-mid' : '';

  const seenLiveBadge = seenLive && (
    <span
      className="text-[10px] font-bold uppercase tracking-wide text-signal bg-signal/10 border border-signal/40 rounded-full px-2 py-0.5 flex-shrink-0 hover:bg-signal/20 transition"
      title="You've seen this played live — click to view the concert"
    >
      🎤 Seen live
    </span>
  );

  const FORMAT_ICON: Record<string, string> = { Vinyl: '💿', CD: '💿', Cassette: '📼', Other: '📀' };
  const ownedBadge = ownedFormat && (
    <span
      className="text-[10px] font-bold uppercase tracking-wide text-brass bg-brass/10 border border-brass/40 rounded-full px-2 py-0.5 flex-shrink-0 hover:bg-brass/20 transition"
      title={`You own this on ${ownedFormat} — click to view`}
    >
      {FORMAT_ICON[ownedFormat] || '📀'} Own it
    </span>
  );

  return (
    <div
      className={`ledger-row flex items-center gap-3 py-3 ${glowClass ? `${glowClass} px-2 -mx-2` : ''} ${
        disliked ? 'disliked-row px-2 -mx-2' : ''
      }`}
    >
      <div className="w-11 h-11 rounded bg-panel2 flex-shrink-0 overflow-hidden">
        {albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={albumArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            ♫
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {listenerName && (
          <div className="text-xs text-signal mb-0.5">{listenerName}</div>
        )}
        <div className="flex items-center gap-2">
          {profileUsername ? (
            <Link
              href={`/u/${profileUsername}/track/${encodeURIComponent(artistName.split(',')[0].trim())}/${encodeURIComponent(trackName)}`}
              className="truncate text-paper font-medium hover:text-brass transition"
            >
              {trackName}
            </Link>
          ) : (
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent(`${trackName} ${artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-paper font-medium hover:text-brass transition"
            >
              {trackName}
            </a>
          )}
          {rating !== undefined && rating > 0 && (
            <span className="text-brass text-xs flex-shrink-0 font-mono">{rating}/10</span>
          )}
          {seenLive &&
            (seenLiveConcertId ? (
              <Link href={`/concerts#concert-${seenLiveConcertId}`}>{seenLiveBadge}</Link>
            ) : (
              seenLiveBadge
            ))}
          {ownedFormat &&
            (ownedMediaId ? (
              <Link href={`/shelf#item-${ownedMediaId}`}>{ownedBadge}</Link>
            ) : (
              ownedBadge
            ))}
          {disliked && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-danger bg-danger/10 border border-danger/40 rounded-full px-2 py-0.5 flex-shrink-0">
              🗑️ Dog Shit
            </span>
          )}
        </div>
        {profileUsername ? (
          <Link
            href={`/u/${profileUsername}/artist/${encodeURIComponent(artistName.split(',')[0].trim())}`}
            className="block truncate text-muted text-sm hover:text-brass transition"
          >
            {artistName}
          </Link>
        ) : (
          <div className="truncate text-muted text-sm">{artistName}</div>
        )}
        {genreTags && genreTags.length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {genreTags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="text-[10px] px-2 py-0.5 rounded-full border border-line/70 text-muted capitalize hover:text-brass hover:border-brass transition leading-none"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
        {funFact && <p className="text-[11px] text-muted italic mt-1">{funFact}</p>}
        {showListenLinks && (
          <div className="flex gap-2 mt-1">
            <a
              href={`https://music.apple.com/search?term=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted hover:text-brass transition"
              title="Search on Apple Music"
            >
              Apple Music
            </a>
            <a
              href={`https://music.youtube.com/search?q=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted hover:text-brass transition"
              title="Search on YouTube Music"
            >
              YouTube Music
            </a>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-mono text-muted flex items-center justify-end gap-1">
          {weatherIcon && <span title={weatherTemp ? `${weatherTemp} that day` : undefined}>{weatherIcon}</span>}
          {weatherTemp && <span>{weatherTemp}</span>}
          <span>{timeAgo(playedAt)}</span>
        </div>
        <div
          className={`text-[10px] uppercase tracking-wide mt-0.5 ${
            source === 'manual'
              ? 'text-brass'
              : source === 'library'
              ? 'text-signal'
              : source === 'lastfm'
              ? 'text-danger'
              : 'text-muted'
          }`}
        >
          {badgeLabel}
        </div>
      </div>
    </div>
  );
}
