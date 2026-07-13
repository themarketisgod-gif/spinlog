import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getArtistMetadata, fameLabel } from '@/lib/musicbrainz';
import { computeCommunityFamiliarity, familiarityLabel } from '@/lib/community';
import { fetchArtistTopTracksFromLastfm, fetchSimilarArtistsFromLastfm } from '@/lib/lastfm';
import { getValidAccessToken, fetchUserPlaylists, searchTracks } from '@/lib/spotify';
import TrackRow from '@/components/TrackRow';
import SimilarTracksPanel from '@/components/SimilarTracksPanel';
import AddToPlaylistButton from '@/components/AddToPlaylistButton';
import PlayByNameButton from '@/components/PlayByNameButton';
import BandMembers from '@/components/BandMembers';

export const dynamic = 'force-dynamic';

export default async function ArtistPage({
  params,
}: {
  params: { username: string; artist: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id as string | undefined;

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) notFound();
  const isOwnProfile = viewerId === user.id;

  const artistName = decodeURIComponent(params.artist);

  // Matches this exact artist OR any play where it's the primary credit
  // in a multi-artist line (e.g. "Nicki Minaj, Drake, Lil Wayne" when
  // viewing Nicki Minaj's page). Done as a targeted SQL query rather than
  // loading the user's whole history into memory and filtering in JS —
  // exactly the pattern that caused an out-of-memory crash elsewhere in
  // this app for a large account, so it's deliberately avoided here too.
  const plays = await prisma.$queryRaw<
    {
      id: string;
      trackName: string;
      artistName: string;
      albumArt: string | null;
      playedAt: Date;
      source: string;
      manualSource: string | null;
      primaryArtistId: string | null;
    }[]
  >`
    SELECT "id", "trackName", "artistName", "albumArt", "playedAt", "source", "manualSource", "primaryArtistId"
    FROM "Play"
    WHERE "userId" = ${user.id}
      AND (
        (cardinality("artistNames") > 0 AND "artistNames"[1] = ${artistName})
        OR (cardinality("artistNames") = 0 AND trim(split_part("artistName", ',', 1)) = ${artistName})
      )
    ORDER BY "playedAt" DESC
    LIMIT 5000
  `;

  if (plays.length === 0) notFound();

  const totalPlays = plays.length;
  const firstPlayed = plays[plays.length - 1].playedAt;
  const lastPlayed = plays[0].playedAt;
  const uniqueTracks = new Set(plays.map((p) => p.trackName)).size;

  const trackCounts = new Map<string, { count: number }>();
  for (const p of plays) {
    const existing = trackCounts.get(p.trackName);
    if (existing) existing.count += 1;
    else trackCounts.set(p.trackName, { count: 1 });
  }
  const topTracks = [...trackCounts.entries()]
    .map(([trackName, data]) => ({ trackName, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const primaryArtistId = plays.find((p) => p.primaryArtistId)?.primaryArtistId || null;
  let albumArt = plays.find((p) => p.albumArt)?.albumArt || null;

  // Last.fm's CSV/JSON export format has no image data at all — for
  // artists logged that way, there's genuinely nothing stored locally to
  // show. Fall back to a quick Spotify search using the viewer's own
  // token, since that's the only Spotify access available on someone
  // else's profile page.
  if (!albumArt && viewerId && topTracks[0]) {
    try {
      const viewerToken = await getValidAccessToken(viewerId);
      if (viewerToken) {
        const results = await searchTracks(viewerToken, `${topTracks[0].trackName} ${artistName}`);
        albumArt = results[0]?.albumArt || null;
      }
    } catch {
      // best-effort only — the generic icon is a fine fallback
    }
  }

  const [metadata, familiarity, concerts, physicalMedia, lastfmTopTracks, viewerPlaylists, similarArtists] = await Promise.all([
    getArtistMetadata([artistName], 3).then((m) => m.get(artistName)),
    computeCommunityFamiliarity([artistName]).then((m) => m.get(artistName)),
    prisma.concert.findMany({ where: { userId: user.id, artistName } }),
    prisma.physicalMedia.findMany({ where: { userId: user.id, artistName } }),
    fetchArtistTopTracksFromLastfm(artistName, 15),
    viewerId
      ? getValidAccessToken(viewerId).then((token) => (token ? fetchUserPlaylists(token) : []))
      : Promise.resolve([]),
    fetchSimilarArtistsFromLastfm(artistName, 8),
  ]);

  let viewerLoggedArtists = new Set<string>();
  let viewerUsername: string | null = null;
  if (viewerId && similarArtists.length > 0) {
    const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { username: true } });
    viewerUsername = viewer?.username || null;
    const rows = await prisma.play.findMany({
      where: { userId: viewerId, artistName: { in: similarArtists.map((a) => a.name) } },
      distinct: ['artistName'],
      select: { artistName: true },
    });
    viewerLoggedArtists = new Set(rows.map((r) => r.artistName));
  }

  const listenedTrackNames = new Set(plays.map((p) => p.trackName.toLowerCase()));

  const seenLive = concerts.length > 0;
  const owned = physicalMedia.length > 0;

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
            <h1 className="font-display italic text-2xl text-paper">{artistName}</h1>
            {seenLive && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-signal bg-signal/10 border border-signal/40 rounded-full px-2 py-0.5">
                🎤 Seen live
              </span>
            )}
            {owned && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-brass bg-brass/10 border border-brass/40 rounded-full px-2 py-0.5">
                💿 Own it
              </span>
            )}
          </div>
          <p className="text-muted text-sm mt-1">
            On {user.name || user.username}
            {"'s"} profile
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {primaryArtistId && (
              <a
                href={`https://open.spotify.com/artist/${primaryArtistId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-signal hover:underline"
              >
                Open in Spotify →
              </a>
            )}
            <a
              href={`https://www.last.fm/music/${encodeURIComponent(artistName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-danger hover:underline"
            >
              View on Last.fm →
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 mt-8">
        <div>
          <div className="font-display italic text-2xl text-paper">{totalPlays}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wide">Total scrobbles</div>
        </div>
        <div>
          <div className="font-display italic text-2xl text-paper">{uniqueTracks}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wide">Unique tracks</div>
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
      </div>

      {(metadata?.tags?.length || familiarity || metadata?.wikidataSitelinks || metadata?.areaName || metadata?.formedYear) && (
        <div className="flex items-center gap-3 flex-wrap mt-4 text-xs">
          {metadata?.tags?.slice(0, 5).map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="px-2.5 py-1 rounded-full border border-line text-muted capitalize hover:text-brass hover:border-brass transition"
            >
              {tag}
            </Link>
          ))}
          {familiarity && <span className="text-muted">{familiarityLabel(familiarity)}</span>}
          {metadata?.wikidataSitelinks !== null && metadata?.wikidataSitelinks !== undefined && (
            <span className="text-brass">{fameLabel(metadata.wikidataSitelinks)}</span>
          )}
          {metadata?.areaName && <span className="text-muted">🌍 {metadata.areaName}</span>}
          {metadata?.formedYear && <span className="text-muted">Formed {metadata.formedYear}</span>}
        </div>
      )}

      {(metadata?.formedYear || metadata?.areaName || (metadata?.tags?.length ?? 0) > 0) && (
        <p className="text-paper text-sm mt-4 max-w-lg">
          {[
            metadata?.formedYear && metadata?.areaName
              ? `Formed in ${metadata.formedYear} in ${metadata.areaName}.`
              : metadata?.formedYear
              ? `Formed in ${metadata.formedYear}.`
              : metadata?.areaName
              ? `From ${metadata.areaName}.`
              : null,
            metadata?.tags && metadata.tags.length > 0
              ? `Known for ${metadata.tags.slice(0, 2).join(' and ')}.`
              : null,
            metadata?.members && metadata.members.length > 0
              ? `${metadata.members.length} member${metadata.members.length !== 1 ? 's' : ''} on file.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}

      {isOwnProfile && (
        <div className="mt-6">
          <SimilarTracksPanel artistName={artistName} canPlay={isOwnProfile} />
        </div>
      )}

      {similarArtists.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
            Similar artists (via Last.fm)
          </h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {similarArtists.map((a) => {
              const logged = viewerLoggedArtists.has(a.name);
              return logged && viewerUsername ? (
                <Link
                  key={a.name}
                  href={`/u/${viewerUsername}/artist/${encodeURIComponent(a.name)}`}
                  className="text-xs px-3 py-1.5 rounded-full border border-signal/40 text-signal hover:bg-signal/10 transition"
                >
                  {a.name}
                </Link>
              ) : (
                <a
                  key={a.name}
                  href={`https://open.spotify.com/search/${encodeURIComponent(a.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
                >
                  {a.name}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {metadata?.members && metadata.members.length > 0 && (
        <div className="mt-10">
          <BandMembers members={metadata.members} />
        </div>
      )}

      {lastfmTopTracks.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
            Most popular (via Last.fm)
          </h2>
          <p className="text-muted text-xs mt-2 mb-3 max-w-lg">
            Spotify removed both its "Artist's Top Tracks" endpoint and
            track popularity scores in its February 2026 API changes, so
            this uses Last.fm's real global scrobble counts instead — a
            different source, but the same idea: which songs are actually
            most listened-to.
          </p>
          <ol>
            {lastfmTopTracks.map((t, i) => {
              const heard = listenedTrackNames.has(t.trackName.toLowerCase());
              return (
                <li key={t.trackName} className="ledger-row flex items-center justify-between gap-2 py-2.5">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-brass w-4 flex-shrink-0">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-paper text-sm">{t.trackName}</span>
                      <span className="block text-muted text-xs">
                        {t.playcount.toLocaleString()} plays · {t.listeners.toLocaleString()} listeners
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {heard ? (
                      <span className="text-[10px] text-signal uppercase tracking-wide">✓ Heard it</span>
                    ) : (
                      <span className="text-[10px] text-muted uppercase tracking-wide">Not yet</span>
                    )}
                    {isOwnProfile && <PlayByNameButton trackName={t.trackName} artistName={artistName} />}
                    {viewerPlaylists.length > 0 && (
                      <AddToPlaylistButton trackName={t.trackName} artistName={artistName} playlists={viewerPlaylists} />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Top tracks by {artistName}
        </h2>
        <ol className="mt-3">
          {topTracks.map((t, i) => (
            <li key={t.trackName} className="ledger-row flex items-center justify-between py-2.5 gap-2">
              <span className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-brass w-4 flex-shrink-0">{i + 1}</span>
                <a
                  href={`https://open.spotify.com/search/${encodeURIComponent(`${t.trackName} ${artistName}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper text-sm truncate hover:text-brass transition"
                >
                  {t.trackName}
                </a>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {isOwnProfile && <PlayByNameButton trackName={t.trackName} artistName={artistName} />}
                <span className="font-mono text-xs text-muted">{t.count}×</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Recent plays
        </h2>
        <div className="mt-3">
          {plays.slice(0, 20).map((p) => (
            <TrackRow
              key={p.id}
              trackName={p.trackName}
              artistName={p.artistName}
              albumArt={p.albumArt}
              playedAt={p.playedAt}
              source={p.source}
              manualSource={p.manualSource}
              profileUsername={user.username}
            />
          ))}
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
