import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchTrackInfoFromLastfm } from '@/lib/lastfm';
import { getArtistMetadata } from '@/lib/musicbrainz';
import RatingStars from '@/components/RatingStars';
import MoodPicker from '@/components/MoodPicker';
import TagInput from '@/components/TagInput';
import NoteEditor from '@/components/NoteEditor';
import PlayByNameButton from '@/components/PlayByNameButton';
import DeletePlayButton from '@/components/DeletePlayButton';
import { getWeatherRange, getHourlyWeatherRange, isDaytime, weatherIcon as getWeatherIcon, formatTemp, localHourKey } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export default async function TrackPage({
  params,
}: {
  params: { username: string; artist: string; track: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id as string | undefined;

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) notFound();
  const isOwnProfile = viewerId === user.id;

  const artistName = decodeURIComponent(params.artist);
  const trackName = decodeURIComponent(params.track);

  const plays = await prisma.$queryRaw<
    {
      id: string;
      trackName: string;
      artistName: string;
      albumArt: string | null;
      albumName: string | null;
      playedAt: Date;
      source: string;
      manualSource: string | null;
      mood: string | null;
    }[]
  >`
    SELECT "id", "trackName", "artistName", "albumArt", "albumName", "playedAt", "source", "manualSource", "mood"
    FROM "Play"
    WHERE "userId" = ${user.id}
      AND "trackName" = ${trackName}
      AND (
        (cardinality("artistNames") > 0 AND "artistNames"[1] = ${artistName})
        OR (cardinality("artistNames") = 0 AND trim(split_part("artistName", ',', 1)) = ${artistName})
      )
    ORDER BY "playedAt" DESC
    LIMIT 2000
  `;

  const featuredOnAlbums = [...new Set(plays.map((p) => p.albumName).filter((a): a is string => !!a))].slice(0, 10) as string[];

  if (plays.length === 0) notFound();

  const totalPlays = plays.length;
  const firstPlayed = plays[plays.length - 1].playedAt;
  const lastPlayed = plays[0].playedAt;
  const albumArt = plays.find((p) => p.albumArt)?.albumArt || null;

  const [rating, concerts, physicalMediaTrack, lastfmInfo, metadata] = await Promise.all([
    isOwnProfile
      ? prisma.rating.findUnique({ where: { userId_trackName_artistName: { userId: user.id, trackName, artistName } } }).catch(() => null)
      : Promise.resolve(null),
    prisma.concert.findMany({ where: { userId: user.id, artistName }, include: { songs: true } }),
    prisma.physicalMediaTrack.findFirst({
      where: { trackName, physicalMedia: { userId: user.id, artistName } },
      include: { physicalMedia: true },
    }),
    fetchTrackInfoFromLastfm(trackName, artistName),
    getArtistMetadata([artistName], 1).then((m) => m.get(artistName)),
  ]);

  const seenLive = concerts.some(
    (c) => c.songs.length === 0 || c.songs.some((s) => s.trackName.toLowerCase() === trackName.toLowerCase())
  );
  const seenLiveConcertId = concerts[0]?.id || null;
  const owned = !!physicalMediaTrack;

  const tags = await prisma.tag.findMany({
    where: { userId: user.id, targetType: 'track', trackName, artistName },
  });

  // Per-scrobble weather — own profile only, same privacy reasoning as
  // the weather/mood correlation elsewhere (it's derived from a location
  // the user set for themselves, so it shouldn't leak even indirectly to
  // other viewers). Uses real hourly temperature/condition data, not just
  // the day's high, so it's actually accurate to when the track played —
  // sunrise/sunset still comes from the daily endpoint since that's the
  // only place Open-Meteo provides it, for the sun-vs-moon distinction.
  const weatherByPlayId = new Map<string, { icon: string; temp: string }>();
  if (isOwnProfile && user.locationLat !== null && user.locationLon !== null && plays.length > 0) {
    const dates = plays.map((p) => p.playedAt.toISOString().slice(0, 10)).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const [dailyWeather, hourlyWeather] = await Promise.all([
      getWeatherRange(user.locationLat, user.locationLon, startDate, endDate),
      getHourlyWeatherRange(user.locationLat, user.locationLon, startDate, endDate),
    ]);

    for (const p of plays) {
      const dateKey = p.playedAt.toISOString().slice(0, 10);
      const day = dailyWeather.get(dateKey);
      if (!day) continue;

      const hourKey = localHourKey(p.playedAt, user.timezone);
      const hourly = hourlyWeather.get(hourKey);
      const daytime = isDaytime(p.playedAt, day.sunrise, day.sunset);

      weatherByPlayId.set(p.id, {
        icon: getWeatherIcon(hourly?.weatherCode ?? day.weatherCode, daytime),
        temp: formatTemp(hourly?.tempC ?? day.tempMaxC, (user.tempUnit as 'F' | 'C') || 'F'),
      });
    }
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-lg bg-panel2 flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl">
          {albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={albumArt} alt="" className="w-full h-full object-cover" />
          ) : (
            '♫'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display italic text-2xl text-paper">{trackName}</h1>
            {seenLive && (
              <Link
                href={seenLiveConcertId ? `/concerts#concert-${seenLiveConcertId}` : '#'}
                className="text-[10px] font-bold uppercase tracking-wide text-signal bg-signal/10 border border-signal/40 rounded-full px-2 py-0.5 hover:bg-signal/20 transition"
              >
                🎤 Seen live
              </Link>
            )}
            {owned && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-brass bg-brass/10 border border-brass/40 rounded-full px-2 py-0.5">
                💿 Own it
              </span>
            )}
          </div>
          <Link href={`/u/${user.username}/artist/${encodeURIComponent(artistName)}`} className="text-muted text-sm mt-1 hover:text-brass transition inline-block">
            {artistName}
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent(`${trackName} ${artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-signal hover:underline"
            >
              Open in Spotify →
            </a>
            <a
              href={`https://music.youtube.com/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-brass hover:underline transition"
            >
              YouTube Music →
            </a>
            <a
              href={`https://music.apple.com/search?term=${encodeURIComponent(`${trackName} ${artistName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-brass hover:underline transition"
            >
              Apple Music →
            </a>
            <a
              href={lastfmInfo?.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-danger hover:underline"
            >
              View on Last.fm →
            </a>
            <a
              href={`https://genius.com/search?q=${encodeURIComponent(`${artistName} ${trackName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-brass hover:underline transition"
              title="Lyrics can't be reproduced here (copyright), but this jumps straight to a search for them"
            >
              Search lyrics →
            </a>
            {isOwnProfile && <PlayByNameButton trackName={trackName} artistName={artistName} />}
          </div>
        </div>
      </div>

      {featuredOnAlbums.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">Featured on</p>
          <div className="flex flex-wrap gap-2">
            {featuredOnAlbums.map((album) => (
              <span key={album} className="text-xs px-2.5 py-1 rounded-full border border-line text-muted">
                {album}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-8 mt-8">
        <div>
          <div className="font-display italic text-2xl text-paper">{totalPlays}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wide">Your scrobbles</div>
        </div>
        <div>
          <div className="font-display italic text-lg text-paper">
            {firstPlayed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wide">First scrobbled</div>
        </div>
        <div>
          <div className="font-display italic text-lg text-paper">
            {lastPlayed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wide">Last scrobbled</div>
        </div>
        {lastfmInfo && lastfmInfo.playcount > 0 && (
          <div>
            <div className="font-display italic text-2xl text-paper">{lastfmInfo.playcount.toLocaleString()}</div>
            <div className="text-xs text-muted mt-1 uppercase tracking-wide">Global scrobbles (Last.fm)</div>
          </div>
        )}
      </div>

      {((lastfmInfo?.tags?.length ?? 0) > 0 || (metadata?.tags?.length ?? 0) > 0) && (
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {(lastfmInfo?.tags?.length ? lastfmInfo.tags : metadata?.tags || []).slice(0, 6).map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="text-xs px-2.5 py-1 rounded-full border border-line text-muted capitalize hover:text-brass hover:border-brass transition"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-8 bg-panel border border-line rounded-lg p-4 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <RatingStars
              trackName={trackName}
              artistName={artistName}
              albumArt={albumArt}
              initialRating={rating?.rating || 0}
              initialDisliked={rating?.disliked || false}
              showTitle
            />
            <TagInput artistName={artistName} trackName={trackName} existingTags={tags.map((t) => t.tag)} />
          </div>
          <div className="pt-4 border-t border-line">
            <NoteEditor
              trackName={trackName}
              artistName={artistName}
              albumArt={albumArt}
              initialNote={rating?.note || null}
            />
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Scrobble history ({totalPlays})
        </h2>
        <div className="mt-3 divide-y divide-line">
          {plays.slice(0, 100).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-paper text-sm">
                  {p.playedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-muted text-xs">
                  {p.playedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wide flex-shrink-0 ${
                    p.source === 'manual' ? 'text-brass' : p.source === 'library' ? 'text-signal' : p.source === 'lastfm' ? 'text-danger' : 'text-muted'
                  }`}
                >
                  {p.source === 'manual' ? p.manualSource || 'logged' : p.source}
                </span>
                {weatherByPlayId.get(p.id) && (
                  <span className="text-xs text-muted flex items-center gap-1 flex-shrink-0">
                    <span>{weatherByPlayId.get(p.id)!.icon}</span>
                    <span>{weatherByPlayId.get(p.id)!.temp}</span>
                  </span>
                )}
              </div>
              {isOwnProfile && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <MoodPicker playId={p.id} initialMood={p.mood} />
                  <DeletePlayButton playId={p.id} />
                </div>
              )}
            </div>
          ))}
          {totalPlays > 100 && (
            <p className="text-muted text-xs pt-3">Showing the 100 most recent of {totalPlays} scrobbles.</p>
          )}
        </div>
      </section>

      <div className="mt-8">
        <Link href={`/u/${user.username}`} className="text-xs text-muted hover:text-brass transition">
          ← Back to {user.name || user.username}&apos;s profile
        </Link>
      </div>
    </div>
  );
}
