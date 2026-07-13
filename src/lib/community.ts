import { prisma } from './prisma';
import type { StatPlay } from './stats';

export interface FamiliarityInfo {
  userCount: number;
  totalUsers: number;
}

/**
 * How many distinct Spinlog users (out of everyone using this instance)
 * have logged each artist at least once. This is the reliable half of the
 * "obscure vs. mainstream" picture — MusicBrainz has no play-count or
 * popularity data at all, so this is drawn from your own app's data
 * instead, which is honest and, for a friend-group app, arguably more
 * useful than a global number anyway.
 */
export async function computeCommunityFamiliarity(
  artistNames: string[]
): Promise<Map<string, FamiliarityInfo>> {
  const result = new Map<string, FamiliarityInfo>();
  if (artistNames.length === 0) return result;

  const totalUsers = await prisma.user.count();

  const rows = await prisma.play.findMany({
    where: { artistName: { in: artistNames } },
    select: { artistName: true, userId: true },
    distinct: ['artistName', 'userId'],
  });

  const counts = new Map<string, number>();
  for (const r of rows as { artistName: string; userId: string }[]) {
    counts.set(r.artistName, (counts.get(r.artistName) || 0) + 1);
  }

  for (const name of artistNames) {
    result.set(name, { userCount: counts.get(name) || 0, totalUsers });
  }
  return result;
}

export function familiarityLabel(info: FamiliarityInfo): string {
  if (info.totalUsers <= 1) return 'Just you so far';
  const pct = info.userCount / info.totalUsers;
  if (info.userCount <= 1) return 'Only you, in your group';
  if (pct < 0.34) return 'A deep cut in your group';
  if (pct < 0.67) return 'Known to some of your group';
  return 'A group favorite';
}

export interface LemmingEntry {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  playedAt: Date;
  wikidataSitelinks: number;
  roast: string;
}

const ROAST_TEMPLATES: ((artist: string, sitelinks: number) => string)[] = [
  (artist, sitelinks) =>
    `${sitelinks} different Wikipedia languages have written about ${artist}. You still hit play.`,
  (artist) => `Congratulations — you and several hundred million strangers agree ${artist} is good.`,
  (artist) => `${artist} is playing in every grocery store on Earth right now. Including, apparently, your headphones.`,
  () => `Breaking: local music nerd caught enjoying something popular.`,
  (artist) => `${artist}? Bold choice for someone with "genre tag collector" energy.`,
  () => `This one's basically the default ringtone of humanity at this point.`,
  (artist) => `Somewhere, a Billboard executive is thanking you personally for streaming ${artist}.`,
  (artist) => `${artist} has more Wikipedia pages than your favorite band has fans. And you chose this.`,
];

/**
 * Ranks recently played tracks by how globally mainstream their artist is
 * (using the same Wikidata sitelink signal as the "Obscure or mainstream?"
 * section), then attaches a rotating joke — built for a friend group where
 * getting caught listening to a real hit is the punchline. Tracks whose
 * artist has no fame data yet (not yet looked up, or genuinely no
 * Wikipedia presence) are excluded rather than guessed at.
 */
export function buildLemmingLeaderboard(
  plays: StatPlay[],
  fameByArtist: Map<string, number | null>,
  limit = 5
): LemmingEntry[] {
  const byTrack = new Map<string, { trackName: string; artistName: string; albumArt: string | null; playedAt: Date }>();
  for (const p of plays) {
    const key = `${p.trackName}::${p.artistName}`;
    const existing = byTrack.get(key);
    if (!existing || p.playedAt > existing.playedAt) {
      byTrack.set(key, {
        trackName: p.trackName,
        artistName: p.artistName,
        albumArt: p.albumArt,
        playedAt: p.playedAt,
      });
    }
  }

  const ranked = [...byTrack.values()]
    .map((t) => ({ ...t, sitelinks: fameByArtist.get(t.artistName) }))
    .filter((t): t is typeof t & { sitelinks: number } => typeof t.sitelinks === 'number' && t.sitelinks > 0)
    .sort((a, b) => b.sitelinks - a.sitelinks)
    .slice(0, limit);

  return ranked.map((t, i) => ({
    trackName: t.trackName,
    artistName: t.artistName,
    albumArt: t.albumArt,
    playedAt: t.playedAt,
    wikidataSitelinks: t.sitelinks,
    roast: ROAST_TEMPLATES[i % ROAST_TEMPLATES.length](t.artistName, t.sitelinks),
  }));
}

export interface SimilarTrackResult {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  spotifyUri: string | null;
  sharedTags: string[];
  loggedByCount: number;
}

/**
 * Content-based recommendation using MusicBrainz genre tags as the feature
 * vector, matched against tracks already logged somewhere in Spinlog
 * (yours or a friend's). This can only ever surface things someone in the
 * app has actually played — it doesn't reach into Spotify's full catalog,
 * since the recommendation/related-artist endpoints that would allow that
 * were deprecated by Spotify in 2024. It's also limited to candidate
 * artists whose genre tags are already cached, to keep a request fast
 * rather than triggering a wave of live MusicBrainz lookups — coverage
 * grows naturally over time as more profiles get viewed.
 */
export async function findSimilarTracks(
  seedTags: string[],
  excludeArtistNames: Set<string>,
  limit = 8
): Promise<SimilarTrackResult[]> {
  if (seedTags.length === 0) return [];
  const seedTagSet = new Set(seedTags.map((t) => t.toLowerCase()));

  const plays = await prisma.play.findMany({
    where: {
      artistName: { notIn: [...excludeArtistNames] },
      spotifyUri: { not: null },
    },
    select: { trackName: true, artistName: true, albumArt: true, spotifyUri: true, userId: true },
    take: 5000,
  });

  const candidateArtists = [...new Set((plays as { artistName: string }[]).map((p) => p.artistName))];
  const cache = await prisma.artistMetadataCache.findMany({
    where: { artistName: { in: candidateArtists } },
  });
  const tagsByArtist = new Map<string, string[]>(
    (cache as { artistName: string; tags: string[] }[]).map((c) => [
      c.artistName,
      c.tags.map((t) => t.toLowerCase()),
    ])
  );

  interface Accum {
    trackName: string;
    artistName: string;
    albumArt: string | null;
    spotifyUri: string | null;
    userIds: Set<string>;
    tags: string[];
  }
  const trackMap = new Map<string, Accum>();

  for (const p of plays as { trackName: string; artistName: string; albumArt: string | null; spotifyUri: string | null; userId: string }[]) {
    const tags = tagsByArtist.get(p.artistName);
    if (!tags || tags.length === 0) continue;
    const overlap = tags.filter((t) => seedTagSet.has(t));
    if (overlap.length === 0) continue;

    const key = `${p.trackName}::${p.artistName}`;
    const existing = trackMap.get(key);
    if (existing) {
      existing.userIds.add(p.userId);
    } else {
      trackMap.set(key, {
        trackName: p.trackName,
        artistName: p.artistName,
        albumArt: p.albumArt,
        spotifyUri: p.spotifyUri,
        userIds: new Set([p.userId]),
        tags: overlap,
      });
    }
  }

  return [...trackMap.values()]
    .sort((a, b) => b.tags.length - a.tags.length || b.userIds.size - a.userIds.size)
    .slice(0, limit)
    .map((t) => ({
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      spotifyUri: t.spotifyUri,
      sharedTags: t.tags,
      loggedByCount: t.userIds.size,
    }));
}

export interface OnThisDayGroup {
  year: number;
  tracks: { trackName: string; artistName: string }[];
}

/**
 * Queries the database directly for plays matching today's month/day
 * across all past years — deliberately NOT using the memory-capped
 * recent-plays dataset the rest of the stats use, since "on this day"
 * needs reach back across someone's whole history (which the cap, by
 * design, doesn't cover for a large account) rather than just their most
 * recent plays.
 */
export async function fetchOnThisDay(userId: string, now: Date = new Date()): Promise<OnThisDayGroup[]> {
  const month = now.getMonth() + 1; // SQL EXTRACT is 1-indexed
  const day = now.getDate();
  const thisYear = now.getFullYear();

  const rows = await prisma.$queryRaw<{ trackName: string; artistName: string; playedAt: Date }[]>`
    SELECT "trackName", "artistName", "playedAt"
    FROM "Play"
    WHERE "userId" = ${userId}
      AND EXTRACT(MONTH FROM "playedAt") = ${month}
      AND EXTRACT(DAY FROM "playedAt") = ${day}
      AND EXTRACT(YEAR FROM "playedAt") != ${thisYear}
    ORDER BY "playedAt" DESC
    LIMIT 500
  `;

  const byYear = new Map<number, Set<string>>();
  for (const p of rows) {
    const year = p.playedAt.getFullYear();
    const key = `${p.trackName}::${p.artistName}`;
    if (!byYear.has(year)) byYear.set(year, new Set());
    byYear.get(year)!.add(key);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, keys]) => ({
      year,
      tracks: [...keys].slice(0, 5).map((k) => {
        const [trackName, artistName] = k.split('::');
        return { trackName, artistName };
      }),
    }));
}
