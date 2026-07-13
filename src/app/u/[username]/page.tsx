import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterByRange,
  computeTopArtists,
  primaryArtistName,
  computeTopTracks,
  computeTopAlbums,
  computeTotalListenTime,
  formatDuration,
  computeHourlyHistogram,
  computeHourlyHistogramTZ,
  computeWeekdayHistogram,
  computeMonthlyTopArtist,
  computeLongestStreak,
  computeDiscoveryRate,
  computeDiversityScore,
  computeBadges,
  computeGenreBreakdownByName,
  computeDecadeBreakdown,
  computeRediscoveries,
  computeExplorationDepth,
  computeSessionStats,
  computeSkipEstimate,
  computeMilestones,
  computePreviousRangePlays,
  computeTrendDeltas,
  computeCollaborations,
  generateRoast,
  computeCompatibility,
  computeAveragePlaysPerDay,
  computeLongestDrySpell,
  computeRepeatRate,
  computeWeekendSplit,
  computeSourceBreakdown,
  computeDurationExtremes,
  computeTimeOfDayArchetype,
  computeAverageReleaseYear,
  computePersonalityType,
  computeMostRepeatedRecent,
  generateRepetitionCallout,
  computeMoodBreakdown,
  computeWeatherMoodCorrelation,
  computeSleepAnalysis,
  type StatPlay,
  type DateRange,
} from '@/lib/stats';
import { getValidAccessToken, fetchFollowedArtists, fetchUserPlaylists, fetchArtistGenres } from '@/lib/spotify';
import { getArtistMetadata, fameLabel } from '@/lib/musicbrainz';
import { computeCommunityFamiliarity, familiarityLabel, buildLemmingLeaderboard, fetchOnThisDay } from '@/lib/community';
import { getWeatherRange } from '@/lib/weather';
import LemmingLeaderboard from '@/components/LemmingLeaderboard';
import PersonalityCard from '@/components/PersonalityCard';
import ProfileTabs from '@/components/ProfileTabs';
import Dashboard from '@/components/Dashboard';
import ProfileBanner from '@/components/ProfileBanner';
import MusicianFacts from '@/components/MusicianFacts';
import { buildArtistFacts } from '@/lib/facts';
import PageJump from '@/components/PageJump';
import TopCountSelector from '@/components/TopCountSelector';
import ReorderableSections, { type LayoutSection } from '@/components/ReorderableSections';
import TapeCounter from '@/components/TapeCounter';
import TrackRow from '@/components/TrackRow';
import ActivityBars from '@/components/ActivityBars';
import HourlyHeatmap from '@/components/HourlyHeatmap';
import WeekdayBars from '@/components/WeekdayBars';
import MonthlyRecapList from '@/components/MonthlyRecapList';
import RangeSelector from '@/components/RangeSelector';
import BadgeRow from '@/components/BadgeRow';
import GenreList from '@/components/GenreList';
import RediscoveryList from '@/components/RediscoveryList';
import OnThisDay from '@/components/OnThisDay';
import PlaybackWidget from '@/components/PlaybackWidget';
import EmbeddedPlayer from '@/components/EmbeddedPlayer';
import AlbumsGrid from '@/components/AlbumsGrid';
import ExportPlaylistButton from '@/components/ExportPlaylistButton';
import TagCloud from '@/components/TagCloud';
import RecommendToProfile from '@/components/RecommendToProfile';
import RouletteButton from '@/components/RouletteButton';
import PlayButton from '@/components/PlayButton';
import SimilarTracksPanel from '@/components/SimilarTracksPanel';
import BuildForFriendButton from '@/components/BuildForFriendButton';
import FollowButton from '@/components/FollowButton';
import SyncButton from '@/components/SyncButton';
import NowPlayingBadge from '@/components/NowPlayingBadge';
import ImportLikedButton from '@/components/ImportLikedButton';
import FollowedArtistsGrid from '@/components/FollowedArtistsGrid';
import PlaylistsGrid from '@/components/PlaylistsGrid';

export const dynamic = 'force-dynamic';
// This page can trigger several throttled external API calls (MusicBrainz,
// Wikidata, Discogs) when it hits artists that aren't cached yet — give it
// more room than the platform default before it's cut off mid-request.
export const maxDuration = 60;

// Stats are computed over at most this many of your most recent plays.
// Without a cap, a large imported history (e.g. tens of thousands of
// Last.fm scrobbles) can make this page's memory usage exceed Vercel's
// limit and crash the whole request — every play still stays in the
// database and counts toward Concerts/Shelf tagging and CSV export, this
// only limits how much gets loaded for the on-page stats themselves.
const MAX_STATS_PLAYS = 8000;

/** Mirrors filterByRange's cutoff logic, for accurate DB-side counts. */
function rangeCutoff(range: DateRange): Date | null {
  if (range === 'all') return null;
  const now = Date.now();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export async function generateMetadata({ params }: { params: { username: string } }) {
  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) return {};
  const displayName = user.name || user.username;
  return {
    title: `${displayName} on Spinlog`,
    openGraph: {
      title: `${displayName} on Spinlog`,
      description: user.bio || `Check out ${displayName}'s listening stats.`,
      images: [`/api/recap/${user.username}`],
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { range?: string; page?: string; topCount?: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id as string | undefined;

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) notFound();

  const isOwnProfile = viewerId === user.id;
  const layoutPreferences = (user.layoutPreferences as Record<string, string[]> | null) || null;
  const range = (searchParams.range as DateRange) || 'all';
  const PLAYS_PER_PAGE = 15;
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);

  const [recentPlays, isFollowing, allPlaysRaw, ratings, topRated, mostDisliked, tags, lovedTracks, onThisDay, concerts, physicalMedia] = await Promise.all([
    prisma.play.findMany({
      where: { userId: user.id },
      orderBy: { playedAt: 'desc' },
      skip: (page - 1) * PLAYS_PER_PAGE,
      take: PLAYS_PER_PAGE,
    }),
    viewerId
      ? prisma.friendship.findUnique({
          where: { followerId_followedId: { followerId: viewerId, followedId: user.id } },
        })
      : null,
    prisma.play.findMany({
      where: { userId: user.id },
      orderBy: { playedAt: 'desc' },
      take: MAX_STATS_PLAYS,
      select: {
        artistName: true,
        trackName: true,
        albumName: true,
        albumArt: true,
        playedAt: true,
        durationMs: true,
        source: true,
        primaryArtistId: true,
        releaseYear: true,
        artistNames: true,
        spotifyUri: true,
        manualSource: true,
        mood: true,
      },
    }),
    isOwnProfile
      ? prisma.rating.findMany({ where: { userId: user.id } })
      : Promise.resolve([] as { trackName: string; artistName: string; rating: number; disliked: boolean }[]),
    prisma.rating.findMany({
      where: { userId: user.id, rating: { gte: 8 } },
      orderBy: [{ rating: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    }),
    prisma.rating.findMany({
      where: { userId: user.id, disliked: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.tag.findMany({ where: { userId: user.id } }),
    prisma.play.findMany({
      where: { userId: user.id, OR: [{ source: 'library' }, { manualSource: 'loved' }] },
      orderBy: { playedAt: 'desc' },
      take: 30,
    }),
    fetchOnThisDay(user.id),
    prisma.concert.findMany({ where: { userId: user.id }, include: { songs: true } }),
    prisma.physicalMedia.findMany({ where: { userId: user.id }, include: { tracks: true } }),
  ]);

  const ratingMap = new Map<string, number>(
    ratings.map((r: { trackName: string; artistName: string; rating: number }) => [
      `${r.trackName}::${r.artistName}`,
      r.rating,
    ])
  );
  const dislikedSet = new Set(
    ratings
      .filter((r: { disliked?: boolean }) => r.disliked)
      .map((r: { trackName: string; artistName: string }) => `${r.trackName}::${r.artistName}`)
  );

  const allTimePlays = allPlaysRaw as StatPlay[];

  // Cheap, in-memory only — no new API calls — used to show a quick stat
  // and fact line next to each scrobble in Recent Plays.
  const trackScrobbleCounts = new Map<string, number>();
  for (const p of allTimePlays) {
    const key = `${p.trackName}::${p.artistName}`;
    trackScrobbleCounts.set(key, (trackScrobbleCounts.get(key) || 0) + 1);
  }
  function buildFunFact(trackName: string, artistName: string, primaryArtist: string): string {
    const count = trackScrobbleCounts.get(`${trackName}::${artistName}`) || 1;
    const countPart = `Scrobbled ${count}× total`;
    const meta = artistMetadata.get(primaryArtist);
    if (meta?.formedYear && meta?.areaName) {
      return `${countPart} · Formed ${meta.formedYear} in ${meta.areaName}`;
    }
    if (meta?.tags && meta.tags.length > 0) {
      return `${countPart} · Tagged ${meta.tags[0]}`;
    }
    return countPart;
  }
  const plays = filterByRange(allTimePlays, range);

  // Accurate counts, decoupled from the MAX_STATS_PLAYS-capped dataset
  // above — that cap exists to keep the heavier per-row stat computations
  // (sessions, diversity, decade breakdowns, etc.) from exceeding the
  // platform's memory limit on a very large imported history, but it
  // shouldn't make basic totals lie. These are cheap aggregate queries
  // that never load full rows into memory.
  const cutoff = rangeCutoff(range);
  const [accurateTotalCount, accurateArtistRows, lifetimeTotalCount, lifetimeArtistRows] = await Promise.all([
    prisma.play.count({ where: { userId: user.id, ...(cutoff ? { playedAt: { gte: cutoff } } : {}) } }),
    prisma.play.findMany({
      where: { userId: user.id, ...(cutoff ? { playedAt: { gte: cutoff } } : {}) },
      distinct: ['artistName'],
      select: { artistName: true },
    }),
    prisma.play.count({ where: { userId: user.id } }),
    prisma.play.findMany({
      where: { userId: user.id },
      distinct: ['artistName'],
      select: { artistName: true },
    }),
  ]);

  const manualCount = plays.filter((p) => p.source === 'manual').length;
  const totalPlays = accurateTotalCount;
  const uniqueArtists = accurateArtistRows.length;
  const statsAreSampled = allTimePlays.length >= MAX_STATS_PLAYS && lifetimeTotalCount > MAX_STATS_PLAYS;

  const topCount = [5, 10, 25, 50].includes(parseInt(searchParams.topCount || '', 10))
    ? parseInt(searchParams.topCount!, 10)
    : 5;
  const topArtists = computeTopArtists(plays, topCount);
  const topTracks = computeTopTracks(plays, topCount);
  const topAlbums = computeTopAlbums(plays, topCount);
  const listenTime = computeTotalListenTime(plays);
  const diversity = computeDiversityScore(plays);
  const streak = computeLongestStreak(allTimePlays);
  const hourlyHistogram = computeHourlyHistogram(plays);
  const hourlyHistogramTZ = computeHourlyHistogramTZ(plays, user.timezone);
  const weekdayHistogram = computeWeekdayHistogram(plays);
  const monthlyRecap = computeMonthlyTopArtist(allTimePlays, 6);
  const discoveryRate = computeDiscoveryRate(allTimePlays, 6).map((d) => ({
    label: d.monthLabel,
    count: d.newArtists,
  }));
  const decadeBreakdown = computeDecadeBreakdown(allTimePlays);
  const rediscoveries = computeRediscoveries(allTimePlays);
  const exploration = computeExplorationDepth(allTimePlays);
  const sessionStats = computeSessionStats(allTimePlays);
  const skipEstimate = computeSkipEstimate(allTimePlays);
  const milestones = computeMilestones(allTimePlays);
  const collaborations = computeCollaborations(allTimePlays);
  const avgPlaysPerDay = computeAveragePlaysPerDay(plays);
  const drySpell = computeLongestDrySpell(allTimePlays);
  const repeatRate = computeRepeatRate(allTimePlays);
  const weekendSplit = computeWeekendSplit(plays);
  const sourceBreakdown = computeSourceBreakdown(allPlaysRaw as (StatPlay & { manualSource?: string | null })[]);
  const durationExtremes = computeDurationExtremes(plays);
  const moodBreakdown = computeMoodBreakdown(allTimePlays);
  const mostRepeatedRecent = computeMostRepeatedRecent(allTimePlays, 7);
  const repetitionCallout = generateRepetitionCallout(mostRepeatedRecent);
  const timeArchetype = computeTimeOfDayArchetype(hourlyHistogramTZ);
  const sleepAnalysis = computeSleepAnalysis(allTimePlays, user.timezone);
  const sleepPlaysCount = allTimePlays.filter((p) =>
    sleepAnalysis.allRanges.some((r) => p.playedAt >= r.start && p.playedAt <= r.end)
  ).length;
  const avgReleaseYear = computeAverageReleaseYear(allTimePlays);

  const nightPlaysCount = hourlyHistogram.slice(0, 5).reduce((a, b) => a + b, 0);
  const roast = generateRoast({
    totalPlays,
    topArtistShare: totalPlays > 0 && topArtists[0] ? topArtists[0].count / totalPlays : 0,
    topArtistName: topArtists[0]?.label ?? null,
    diversityScore: diversity.score,
    skipRate: skipEstimate.skipRate,
    nightOwlShare: totalPlays > 0 ? nightPlaysCount / totalPlays : 0,
  });

  const tagCounts = new Map<string, number>();
  const tagsByTrack = new Map<string, string[]>();
  for (const t of tags) {
    tagCounts.set(t.tag, (tagCounts.get(t.tag) || 0) + 1);
    if (t.targetType === 'track') {
      const key = `${t.trackName}::${t.artistName}`;
      if (!tagsByTrack.has(key)) tagsByTrack.set(key, []);
      tagsByTrack.get(key)!.push(t.tag);
    }
  }
  const tagCloud = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const trendDeltas =
    range === 'year' || range === 'all'
      ? []
      : computeTrendDeltas(plays, computePreviousRangePlays(allTimePlays, range));

  const days: { label: string; count: number }[] = [];
  const dayMap = new Map<string, number>();
  for (const p of allTimePlays) {
    const key = p.playedAt.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: d.toLocaleDateString(undefined, { day: 'numeric' }), count: dayMap.get(key) || 0 });
  }

  let followedArtists: Awaited<ReturnType<typeof fetchFollowedArtists>> = [];
  let playlists: Awaited<ReturnType<typeof fetchUserPlaylists>> = [];
  const spotifyGenresByName = new Map<string, string[]>();
  try {
    const accessToken = await getValidAccessToken(user.id);
    if (accessToken) {
      const artistIdByName = new Map<string, string>();
      for (const p of plays) {
        if (p.primaryArtistId && !artistIdByName.has(p.artistName)) {
          artistIdByName.set(p.artistName, p.primaryArtistId);
        }
      }
      const topArtistIds = topArtists
        .map((a) => artistIdByName.get(a.label))
        .filter((id): id is string => !!id);

      const [fa, pl, genresByArtistId] = await Promise.all([
        fetchFollowedArtists(accessToken),
        fetchUserPlaylists(accessToken),
        fetchArtistGenres(accessToken, topArtistIds),
      ]);
      followedArtists = fa;
      playlists = pl;

      for (const [name, id] of artistIdByName.entries()) {
        const g = genresByArtistId.get(id);
        if (g && g.length > 0) spotifyGenresByName.set(name, g);
      }
    }
  } catch {
    // Spotify call failed — sections stay empty, rest of the page still works
  }

  const topArtistNames = topArtists.map((a) => a.label);
  const last30Plays = filterByRange(allTimePlays, '30d');
  const last30ArtistNames = [...new Set(last30Plays.map((p) => p.artistName))];

  // Combined into one deduplicated list and one throttled lookup instead
  // of two separate capped calls — each uncached artist costs a real
  // network round trip to MusicBrainz/Wikidata, so doing this as a single
  // batch roughly halves the worst-case added latency on page load.
  const combinedArtistNames = [...new Set([...topArtistNames, ...last30ArtistNames])];

  const [artistMetadata, familiarityByName] = await Promise.all([
    getArtistMetadata(combinedArtistNames, 5),
    computeCommunityFamiliarity(topArtistNames),
  ]);

  const musicBrainzGenresByName = new Map<string, string[]>();
  for (const [name, data] of artistMetadata.entries()) {
    if (data.tags.length > 0) musicBrainzGenresByName.set(name, data.tags);
  }

  const combinedGenresByName = new Map<string, string[]>([
    ...musicBrainzGenresByName,
    ...spotifyGenresByName,
  ]);
  const genres = computeGenreBreakdownByName(plays, combinedGenresByName, 40);

  const avgFameSitelinks = (() => {
    const values = topArtistNames
      .map((n) => artistMetadata.get(n)?.wikidataSitelinks)
      .filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  })();

  const personalityType = computePersonalityType({
    repeatRate: repeatRate.rate,
    avgReleaseYear,
    avgFameSitelinks,
    diversityScore: diversity.score,
  });

  const fameByArtist = new Map<string, number | null>();
  for (const [name, data] of artistMetadata.entries()) fameByArtist.set(name, data.wikidataSitelinks);
  const lemmingLeaderboard = buildLemmingLeaderboard(last30Plays, fameByArtist, 5);

  const badges = computeBadges({
    totalPlays,
    uniqueArtists,
    longestStreak: streak.longest,
    diversityScore: diversity.score,
    hourlyHistogram,
    topArtistShare: totalPlays > 0 && topArtists[0] ? topArtists[0].count / totalPlays : 0,
  });

  let soulmate: { name: string; username: string; score: number } | null = null;
  let pendingRecs: {
    id: string;
    trackName: string;
    artistName: string;
    albumArt: string | null;
    fromUser: { name: string | null; username: string };
  }[] = [];

  // "Seen live" lookup. If a concert has an actual setlist attached, match
  // song-by-song (precise). If it doesn't — most manual entries won't,
  // since typing a setlist is optional — fall back to tagging any play by
  // that artist, since song-level data simply doesn't exist for that show.
  const seenLiveSongMap = new Map<string, string>(); // "artist::track" -> concertId
  const seenLiveArtistMap = new Map<string, string>(); // "artist" -> concertId, for setlist-less concerts
  for (const c of concerts) {
    const artistKey = c.artistName.toLowerCase();
    if (c.songs.length === 0) {
      if (!seenLiveArtistMap.has(artistKey)) seenLiveArtistMap.set(artistKey, c.id);
    } else {
      for (const s of c.songs) {
        const key = `${artistKey}::${s.trackName.toLowerCase()}`;
        if (!seenLiveSongMap.has(key)) seenLiveSongMap.set(key, c.id);
      }
    }
  }
  function findSeenLiveConcertId(artistName: string, trackName: string): string | null {
    const artistKey = artistName.toLowerCase();
    return (
      seenLiveArtistMap.get(artistKey) ??
      seenLiveSongMap.get(`${artistKey}::${trackName.toLowerCase()}`) ??
      null
    );
  }

  // "Owns this physically" lookup — same shape as the concert matching
  // above. A release with a full tracklist matches song-by-song; one
  // without (e.g. a bulk Discogs collection import, which doesn't fetch
  // each release's tracklist individually) falls back to artist-level.
  const ownedSongMap = new Map<string, { id: string; format: string }>();
  const ownedArtistMap = new Map<string, { id: string; format: string }>();
  // Track-name-only index (no artist required) — covers cases like a
  // skit credited to a "character" on streaming platforms (e.g. Eminem
  // albums crediting skits to the character's name instead of Eminem),
  // where the release's overall artist won't match the play's artist at
  // all. Scoped to this user's own shelf, so the false-positive surface
  // is limited to titles they've personally catalogued, not the whole app.
  const ownedTrackOnlyMap = new Map<string, { id: string; format: string }>();
  for (const m of physicalMedia) {
    const artistKey = m.artistName.toLowerCase();
    if (m.tracks.length === 0) {
      if (!ownedArtistMap.has(artistKey)) ownedArtistMap.set(artistKey, { id: m.id, format: m.format });
    } else {
      for (const t of m.tracks) {
        const trackKey = t.trackName.toLowerCase();
        const key = `${artistKey}::${trackKey}`;
        if (!ownedSongMap.has(key)) ownedSongMap.set(key, { id: m.id, format: m.format });
        if (!ownedTrackOnlyMap.has(trackKey)) ownedTrackOnlyMap.set(trackKey, { id: m.id, format: m.format });
      }
    }
  }
  function findOwnedMedia(artistName: string, trackName: string): { id: string; format: string } | null {
    const artistKey = artistName.toLowerCase();
    const trackKey = trackName.toLowerCase();

    const exact = ownedArtistMap.get(artistKey) ?? ownedSongMap.get(`${artistKey}::${trackKey}`);
    if (exact) return exact;

    // Artist-level fallback (no tracklist on file), but substring-based —
    // catches a play credited as "Eminem, Steve Berman" against a shelf
    // item whose artist is just "Eminem".
    for (const [ownedArtistKey, media] of ownedArtistMap.entries()) {
      if (artistKey.includes(ownedArtistKey) || ownedArtistKey.includes(artistKey)) {
        return media;
      }
    }

    // Exact track title, any owned release (catches the skit-credited-to-
    // a-different-artist case).
    const trackOnly = ownedTrackOnlyMap.get(trackKey);
    if (trackOnly) return trackOnly;

    // Last resort: one title contains the other, to catch formatting
    // differences like Discogs' "Paul" vs. a streaming platform's
    // "Paul - Skit". Skipped for very short titles, where this would be
    // too easy to match by coincidence.
    if (trackKey.length >= 4) {
      for (const [ownedTrackKey, media] of ownedTrackOnlyMap.entries()) {
        if (ownedTrackKey.length >= 4 && (trackKey.includes(ownedTrackKey) || ownedTrackKey.includes(trackKey))) {
          return media;
        }
      }
    }
    return null;
  }

  // Weather/mood correlation — own profile only, since it's derived from a
  // location the user set for themselves in Settings and shouldn't leak
  // even indirectly to other viewers of the profile.
  let weatherMoodCorrelation: ReturnType<typeof computeWeatherMoodCorrelation> = null;
  if (isOwnProfile && user.locationLat !== null && user.locationLon !== null) {
    const moodTaggedPlays = allTimePlays.filter((p) => p.mood);
    if (moodTaggedPlays.length > 0) {
      const dates = moodTaggedPlays.map((p) => p.playedAt.toISOString().slice(0, 10)).sort();
      const weatherByDate = await getWeatherRange(user.locationLat, user.locationLon, dates[0], dates[dates.length - 1]);
      const weatherLookup = new Map(
        [...weatherByDate.entries()].map(([date, day]) => [date, { tempMaxC: day.tempMaxC, precipitationMm: day.precipitationMm }])
      );
      weatherMoodCorrelation = computeWeatherMoodCorrelation(allTimePlays, weatherLookup);
    }
  }

  if (isOwnProfile) {
    const [following, recs] = await Promise.all([
      prisma.friendship.findMany({
        where: { followerId: user.id },
        select: { followed: { select: { id: true, name: true, username: true } } },
      }),
      prisma.recommendation.findMany({
        where: { toUserId: user.id, loggedAt: null, dismissedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { fromUser: { select: { name: true, username: true } } },
      }),
    ]);
    pendingRecs = recs;

    if (following.length > 0) {
      const friendPlaysList = await Promise.all(
        following.map((f: { followed: { id: string; name: string | null; username: string } }) =>
          prisma.play
            .findMany({
              where: { userId: f.followed.id },
              orderBy: { playedAt: 'desc' },
              take: MAX_STATS_PLAYS,
              select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
            })
            .then((plays: StatPlay[]) => ({ friend: f.followed, plays }))
        )
      );

      let best: { name: string; username: string; score: number } | null = null;
      for (const { friend, plays: friendPlays } of friendPlaysList) {
        const { score } = computeCompatibility(allTimePlays, friendPlays);
        if (!best || score > best.score) {
          best = { name: friend.name || friend.username, username: friend.username, score };
        }
      }
      soulmate = best;
    }
  }

  const overviewSections: LayoutSection[] = [
    {
      id: 'stats',
      label: 'Stats',
      node: (
        <div>
          <div id="stats" className="flex flex-wrap gap-8">
            <Stat label="Total scrobbles" value={totalPlays} />
            <Stat label="Unique artists" value={uniqueArtists} />
            <Stat label="Logged by hand" value={manualCount} />
            <Stat label="Longest streak" value={streak.longest} suffix="d" />
          </div>

          {range !== 'all' && (
            <div className="flex flex-wrap gap-8 mt-6">
              <div>
                <div className="font-display italic text-xl text-muted">{lifetimeTotalCount.toLocaleString()}</div>
                <div className="text-xs text-muted mt-1 uppercase tracking-wide">Lifetime scrobbles (all time)</div>
              </div>
              <div>
                <div className="font-display italic text-xl text-muted">{lifetimeArtistRows.length.toLocaleString()}</div>
                <div className="text-xs text-muted mt-1 uppercase tracking-wide">Lifetime unique artists</div>
              </div>
            </div>
          )}

          {statsAreSampled && (
            <p className="text-muted text-xs mt-3 max-w-lg">
              Detailed stats below cover your most recent {MAX_STATS_PLAYS.toLocaleString()} plays, not your full {lifetimeTotalCount.toLocaleString()}.
            </p>
          )}

          <div className="flex flex-wrap gap-8 mt-6">
            <div>
              <div className="font-display italic text-2xl text-paper">
                {listenTime.totalMs > 0 ? formatDuration(listenTime.totalMs) : '—'}
              </div>
              <div className="text-xs text-muted mt-1 uppercase tracking-wide">Time listened</div>
            </div>
            <div>
              <div className="font-display italic text-2xl text-paper">
                {diversity.score || '—'}
                {diversity.score > 0 && <span className="text-sm text-muted"> / 100</span>}
              </div>
              <div className="text-xs text-muted mt-1 uppercase tracking-wide">
                Taste diversity — {diversity.label}
              </div>
            </div>
            <div>
              <div className="font-display italic text-2xl text-paper">
                {exploration.deepCuts}
                <span className="text-sm text-muted"> / {exploration.samplers} sampled</span>
              </div>
              <div className="text-xs text-muted mt-1 uppercase tracking-wide">Deep cuts vs. samples</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'recent-plays',
      label: 'Recent Plays',
      node: (
        <section>
          <SectionLabel>Recent scrobbles</SectionLabel>
          <div className="mt-3">
            {recentPlays.length === 0 && (
              <EmptyNote text={isOwnProfile ? 'Sync Spotify or log a play to get started.' : 'Nothing logged yet.'} />
            )}
            {recentPlays.map((p) => (
              <div key={p.id} className="py-1">
                <TrackRow
                  trackName={p.trackName}
                  artistName={p.artistName}
                  albumArt={p.albumArt}
                  playedAt={p.playedAt}
                  source={p.source}
                  manualSource={p.manualSource}
                  showListenLinks={false}
                  rating={ratingMap.get(`${p.trackName}::${p.artistName}`)}
                  disliked={dislikedSet.has(`${p.trackName}::${p.artistName}`)}
                  seenLive={!!findSeenLiveConcertId(p.artistName, p.trackName)}
                  seenLiveConcertId={findSeenLiveConcertId(p.artistName, p.trackName)}
                  ownedFormat={findOwnedMedia(p.artistName, p.trackName)?.format || null}
                  ownedMediaId={findOwnedMedia(p.artistName, p.trackName)?.id || null}
                  profileUsername={user.username}
                  genreTags={artistMetadata.get(primaryArtistName(p))?.tags}
                  funFact={buildFunFact(p.trackName, p.artistName, primaryArtistName(p))}
                />
              </div>
            ))}
          </div>
          {isOwnProfile && (
            <p className="text-muted text-xs mt-3">
              Click a track to rate, tag, set a mood, or delete a specific scrobble.
            </p>
          )}

          {lifetimeTotalCount > PLAYS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 text-xs">
              {page > 1 ? (
                <Link
                  href={`/u/${user.username}?range=${range}&page=${page - 1}`}
                  className="text-brass hover:underline"
                >
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-3">
                <span className="text-muted">
                  Page {page} of {Math.ceil(lifetimeTotalCount / PLAYS_PER_PAGE).toLocaleString()}
                </span>
                {isOwnProfile && (
                  <PageJump range={range} totalPages={Math.ceil(lifetimeTotalCount / PLAYS_PER_PAGE)} />
                )}
              </span>
              {page * PLAYS_PER_PAGE < lifetimeTotalCount ? (
                <Link
                  href={`/u/${user.username}?range=${range}&page=${page + 1}`}
                  className="text-brass hover:underline"
                >
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>
      ),
    },
    {
      id: 'liked-loved',
      label: 'Liked & Loved',
      node: lovedTracks.length > 0 && (
        <section>
          <SectionLabel>❤️ Liked & loved</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3">
            Spotify liked songs and Last.fm loved tracks — dated whenever
            you originally liked/loved them, which is often not recent, so
            they show up here instead of buried in Recent Plays.
          </p>
          <div>
            {lovedTracks.map((t) => (
              <div key={t.id} className="ledger-row flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                  {t.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.albumArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">♫</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-paper text-sm">{t.trackName}</div>
                  <div className="truncate text-muted text-xs">{t.artistName}</div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wide flex-shrink-0 ${
                    t.source === 'library' ? 'text-signal' : 'text-danger'
                  }`}
                >
                  {t.source === 'library' ? 'Spotify liked' : 'Last.fm loved'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 'last-two-weeks',
      label: 'Last Two Weeks',
      node: (
        <section>
          <SectionLabel>Last two weeks</SectionLabel>
          <div className="mt-3 bg-panel rounded-lg p-4 border border-line">
            <ActivityBars counts={days} />
          </div>
        </section>
      ),
    },
    {
      id: 'top-lists',
      label: 'Top Artists / Tracks / Albums',
      node: (
        <div>
          <div className="flex justify-end">
            <Suspense fallback={null}>
              <TopCountSelector />
            </Suspense>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mt-3">
            <RankedSection title="Top artists" items={topArtists} showFirstPlayed profileUsername={user.username} />
            <RankedSection title="Top tracks" items={topTracks} showSublabel showPlayButton={isOwnProfile} showSimilar={isOwnProfile} profileUsername={user.username} />
            <RankedSection title="Top albums" items={topAlbums} showSublabel profileUsername={user.username} />
          </div>
        </div>
      ),
    },
    {
      id: 'trending',
      label: 'Trending',
      node: (
        <div>
          {trendDeltas.length > 0 && (
            <section>
              <SectionLabel>Trending vs. previous period</SectionLabel>
              <ol className="mt-3">
                {trendDeltas.map((t) => {
                  const moved = t.previousRank === null ? null : t.previousRank - t.currentRank;
                  return (
                    <li key={t.artistName} className="ledger-row flex items-center justify-between py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-xs text-brass w-4">{t.currentRank}</span>
                        <span className="text-paper text-sm">{t.artistName}</span>
                      </span>
                      <span className="font-mono text-xs flex-shrink-0">
                        {t.previousRank === null ? (
                          <span className="text-signal">new</span>
                        ) : moved! > 0 ? (
                          <span className="text-signal">▲ {moved}</span>
                        ) : moved! < 0 ? (
                          <span className="text-danger">▼ {Math.abs(moved!)}</span>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {isOwnProfile && (
            <div className="mt-4">
              <ExportPlaylistButton range={range} />
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'genres',
      label: 'Top Genres',
      node: genres.length > 0 && (
        <section>
          <SectionLabel>Top genres</SectionLabel>
          <div className="mt-3 max-w-md">
            <GenreList genres={genres} />
          </div>
        </section>
      ),
    },
    {
      id: 'ratings',
      label: 'Top Rated / Dog Shit',
      node: (
        <div>
          {topRated.length > 0 && (
            <section>
              <SectionLabel>Top rated</SectionLabel>
              <div className="mt-3">
                {topRated.map((r) => (
                  <div
                    key={r.id}
                    className={`ledger-row flex items-center gap-3 py-2.5 ${
                      r.rating === 10 ? 'rating-glow px-2 -mx-2' : 'rating-glow-mid px-2 -mx-2'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                      {r.albumArt && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://open.spotify.com/search/${encodeURIComponent(`${r.trackName} ${r.artistName}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-paper text-sm hover:text-brass transition"
                      >
                        {r.trackName}
                      </a>
                      <Link
                        href={`/u/${user.username}/artist/${encodeURIComponent(r.artistName.split(',')[0].trim())}`}
                        className="block truncate text-muted text-xs hover:text-brass transition"
                      >
                        {r.artistName}
                      </Link>
                    </div>
                    <div className="text-brass text-xs flex-shrink-0 font-mono">{r.rating}/10</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isOwnProfile && mostDisliked.length > 0 && (
            <section className="mt-10">
              <SectionLabel>🗑️ Dog Shit Top {mostDisliked.length}</SectionLabel>
              <div className="mt-3">
                {mostDisliked.map((r) => (
                  <div key={r.id} className="disliked-row flex items-center gap-3 py-2.5 px-2 -mx-2 mb-1.5">
                    <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                      {r.albumArt && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://open.spotify.com/search/${encodeURIComponent(`${r.trackName} ${r.artistName}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-paper text-sm hover:text-brass transition"
                      >
                        {r.trackName}
                      </a>
                      <Link
                        href={`/u/${user.username}/artist/${encodeURIComponent(r.artistName.split(',')[0].trim())}`}
                        className="block truncate text-muted text-xs hover:text-brass transition"
                      >
                        {r.artistName}
                      </Link>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-danger bg-danger/10 border border-danger/40 rounded-full px-2 py-0.5 flex-shrink-0">
                      🗑️
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ),
    },
    {
      id: 'rediscover',
      label: 'Rediscover',
      node: rediscoveries.length > 0 && (
        <section id="rediscover">
          <SectionLabel>Rediscover these</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-1">
            Tracks you used to play a lot, but haven't in a while.
          </p>
          <RediscoveryList items={rediscoveries} profileUsername={user.username} />
        </section>
      ),
    },
    {
      id: 'on-this-day',
      label: 'On This Day',
      node: (
        <section>
          <SectionLabel>On this day</SectionLabel>
          <div className="mt-3">
            <OnThisDay groups={onThisDay} profileUsername={user.username} />
          </div>
        </section>
      ),
    },
    {
      id: 'spotify-extras',
      label: 'Following / Playlists / Saved Albums',
      node: (
        <div>
          {followedArtists.length > 0 && (
            <section>
              <SectionLabel>Following on Spotify</SectionLabel>
              <FollowedArtistsGrid artists={followedArtists} />
            </section>
          )}
          {playlists.length > 0 && (
            <section className="mt-10">
              <SectionLabel>Playlists</SectionLabel>
              <PlaylistsGrid playlists={playlists} />
            </section>
          )}
          {isOwnProfile && (
            <section className="mt-10">
              <SectionLabel>Saved albums</SectionLabel>
              <div className="mt-3">
                <AlbumsGrid />
              </div>
            </section>
          )}
        </div>
      ),
    },
  ];

  const overviewContent = (
    <ReorderableSections
      tab="overview"
      sections={overviewSections}
      savedOrder={(layoutPreferences?.overview as string[]) || null}
    />
  );

  const nerdDataSections: LayoutSection[] = [
    {
      id: 'clock-weekday',
      label: 'Listening Clock / Day of Week',
      node: (
        <div className="grid md:grid-cols-2 gap-8">
          <section id="listening-clock">
            <SectionLabel>Listening clock</SectionLabel>
            <div className="mt-3 bg-panel rounded-lg p-4 border border-line">
              <HourlyHeatmap hours={hourlyHistogramTZ} />
            </div>
          </section>

          <section>
            <SectionLabel>By day of week</SectionLabel>
            <div className="mt-3 bg-panel rounded-lg p-4 border border-line">
              <WeekdayBars data={weekdayHistogram} />
            </div>
          </section>
        </div>
      ),
    },
    {
      id: 'sessions-skip',
      label: 'Sessions / Skip Rate',
      node: (
        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <SectionLabel>Listening sessions</SectionLabel>
            <p className="text-muted text-xs mt-2 mb-3">
              A session ends after a 30+ minute gap between plays.
            </p>
            <div className="flex flex-wrap gap-6">
              <MiniStat label="Sessions" value={sessionStats.totalSessions} />
              <MiniStat label="Avg tracks/session" value={sessionStats.avgTracksPerSession} />
              <MiniStat label="Avg length" value={sessionStats.avgSessionMinutes} suffix="m" />
              <MiniStat label="Longest" value={sessionStats.longestSessionMinutes} suffix="m" />
            </div>
          </section>

          <section>
            <SectionLabel>Estimated skip rate</SectionLabel>
            <p className="text-muted text-xs mt-2 mb-3">
              Spotify doesn't expose real skip data — this infers a skip when
              the next play starts well before the previous track's known
              length would have finished. Treat it as a rough signal, not a
              fact.
            </p>
            {skipEstimate.comparablePlays >= 10 ? (
              <>
                <div className="font-display italic text-3xl text-paper">
                  {skipEstimate.skipRate}%
                  <span className="text-sm text-muted"> of {skipEstimate.comparablePlays} comparable scrobbles</span>
                </div>
                {skipEstimate.likelySkipped.length > 0 && (
                  <p className="text-muted text-xs mt-2">
                    Likely skipped: {skipEstimate.likelySkipped.map((t) => t.trackName).join(', ')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted text-sm">Not enough Spotify-sourced scrobbles yet to estimate this.</p>
            )}
          </section>
        </div>
      ),
    },
    {
      id: 'even-more-stats',
      label: 'Even More Stats',
      node: (
        <section>
          <SectionLabel>Even more stats</SectionLabel>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mt-4">
            <MiniStat label="Avg plays/day" value={avgPlaysPerDay} />
            <MiniStat label="Repeat-listen rate" value={repeatRate.rate} suffix="%" />
            <MiniStat label="Weekend share" value={weekendSplit.weekendPct} suffix="%" />
          </div>

          {drySpell && drySpell.days >= 2 && (
            <p className="text-muted text-xs mt-4">
              Longest dry spell: <span className="text-paper">{drySpell.days} days</span>, between{' '}
              {drySpell.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} and{' '}
              {drySpell.to.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            {durationExtremes.longest && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-1">Longest track scrobbled</p>
                <p className="text-sm text-paper">
                  {durationExtremes.longest.trackName}{' '}
                  <span className="text-muted">
                    ({Math.floor(durationExtremes.longest.durationMs / 60000)}:
                    {String(Math.floor((durationExtremes.longest.durationMs % 60000) / 1000)).padStart(2, '0')})
                  </span>
                </p>
                <p className="text-xs text-muted">{durationExtremes.longest.artistName}</p>
              </div>
            )}
            {durationExtremes.shortest && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-1">Shortest track scrobbled</p>
                <p className="text-sm text-paper">
                  {durationExtremes.shortest.trackName}{' '}
                  <span className="text-muted">
                    ({Math.floor(durationExtremes.shortest.durationMs / 60000)}:
                    {String(Math.floor((durationExtremes.shortest.durationMs % 60000) / 1000)).padStart(2, '0')})
                  </span>
                </p>
                <p className="text-xs text-muted">{durationExtremes.shortest.artistName}</p>
              </div>
            )}
          </div>

          {sourceBreakdown.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">Where scrobbles came from</p>
              <div className="space-y-2">
                {sourceBreakdown.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-paper">{s.label}</span>
                      <span className="text-muted font-mono">{s.pct}% ({s.count})</span>
                    </div>
                    <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
                      <div className="h-full bg-brass rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ),
    },
    {
      id: 'obscure-mainstream',
      label: 'Obscure or Mainstream?',
      node: (
        <section>
          <SectionLabel>Obscure or mainstream?</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3 max-w-lg">
            "In your group" is exact — drawn from who else in Spinlog has
            logged each artist. "Global fame" is a rough proxy from how many
            Wikipedia language editions have an article on them, since neither
            MusicBrainz nor Spotify's remaining API exposes real popularity
            data anymore.
          </p>
          <div>
            {topArtists.map((a) => {
              const fam = familiarityByName.get(a.label);
              const meta = artistMetadata.get(a.label);
              return (
                <div key={a.key} className="ledger-row flex items-center justify-between py-2.5 gap-3">
                  <Link
                    href={`/u/${user.username}/artist/${encodeURIComponent(a.label)}`}
                    className="text-paper text-sm truncate hover:text-brass transition"
                  >
                    {a.label}
                  </Link>
                  <span className="flex items-center gap-3 flex-shrink-0 text-xs">
                    {fam && <span className="text-muted">{familiarityLabel(fam)}</span>}
                    {meta && meta.wikidataSitelinks !== null && meta.wikidataSitelinks !== undefined && (
                      <span className="text-brass">{fameLabel(meta.wikidataSitelinks)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ),
    },
    {
      id: 'collaborations',
      label: 'Collaborations',
      node: collaborations.topPairs.length > 0 && (
        <section>
          <SectionLabel>Collaborations</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3">
            Recurring artist pairings, from {collaborations.totalCollabPlays} multi-artist plays.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              {collaborations.topPairs.map((pair) => (
                <div key={pair.artists.join('+')} className="ledger-row flex items-center justify-between py-2">
                  <span className="text-paper text-sm truncate">
                    <Link href={`/u/${user.username}/artist/${encodeURIComponent(pair.artists[0])}`} className="hover:text-brass transition">
                      {pair.artists[0]}
                    </Link>{' '}
                    <span className="text-muted">×</span>{' '}
                    <Link href={`/u/${user.username}/artist/${encodeURIComponent(pair.artists[1])}`} className="hover:text-brass transition">
                      {pair.artists[1]}
                    </Link>
                  </span>
                  <span className="font-mono text-xs text-muted flex-shrink-0">{pair.count}×</span>
                </div>
              ))}
            </div>
            {collaborations.topFeaturedArtists.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
                  Shows up as a feature most
                </p>
                {collaborations.topFeaturedArtists.map((a) => (
                  <div key={a.artistName} className="ledger-row flex items-center justify-between py-2">
                    <Link
                      href={`/u/${user.username}/artist/${encodeURIComponent(a.artistName)}`}
                      className="text-paper text-sm truncate hover:text-brass transition"
                    >
                      {a.artistName}
                    </Link>
                    <span className="font-mono text-xs text-muted flex-shrink-0">{a.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ),
    },
    {
      id: 'roulette',
      label: 'Shuffle My Past',
      node: isOwnProfile && (
        <div>
          <RouletteButton
            tracks={allTimePlays.slice(0, 500).map((p) => ({
              trackName: p.trackName,
              artistName: p.artistName,
              albumArt: p.albumArt,
              spotifyUri: p.spotifyUri ?? null,
            }))}
          />
        </div>
      ),
    },
  ];

  const nerdDataContent = (
    <ReorderableSections
      tab="nerd"
      sections={nerdDataSections}
      savedOrder={(layoutPreferences?.nerd as string[]) || null}
    />
  );

  const countryBreakdown = (() => {
    const counts = new Map<string, { areaName: string; count: number }>();
    for (const a of topArtists) {
      const meta = artistMetadata.get(a.label);
      if (!meta?.areaName) continue;
      const key = meta.country || meta.areaName;
      const existing = counts.get(key);
      if (existing) existing.count += a.count;
      else counts.set(key, { areaName: meta.areaName, count: a.count });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  const formedYearArtists = topArtists
    .map((a) => ({ label: a.label, formedYear: artistMetadata.get(a.label)?.formedYear }))
    .filter((a): a is { label: string; formedYear: number } => typeof a.formedYear === 'number');
  const oldestArtist = formedYearArtists.length > 0 ? formedYearArtists.reduce((a, b) => (a.formedYear < b.formedYear ? a : b)) : null;
  const newestArtist = formedYearArtists.length > 0 ? formedYearArtists.reduce((a, b) => (a.formedYear > b.formedYear ? a : b)) : null;

  const historySections: LayoutSection[] = [
    {
      id: 'decades',
      label: 'By Decade',
      node: decadeBreakdown.length > 0 && (
        <section>
          <SectionLabel>By decade</SectionLabel>
          <div className="mt-3 bg-panel rounded-lg p-4 border border-line">
            <ActivityBars counts={decadeBreakdown} />
          </div>
        </section>
      ),
    },
    {
      id: 'monthly-discovery',
      label: 'Monthly Recap / New Artists',
      node: (
        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <SectionLabel>Monthly recap</SectionLabel>
            <div className="mt-3">
              <MonthlyRecapList data={monthlyRecap} profileUsername={user.username} />
            </div>
          </section>

          <section>
            <SectionLabel>New artists discovered</SectionLabel>
            <div className="mt-3 bg-panel rounded-lg p-4 border border-line">
              <ActivityBars counts={discoveryRate} />
            </div>
          </section>
        </div>
      ),
    },
    {
      id: 'tags',
      label: 'Tags',
      node: tagCloud.length > 0 && (
        <section>
          <SectionLabel>Tags</SectionLabel>
          <div className="mt-3">
            <TagCloud tags={tagCloud} />
          </div>
        </section>
      ),
    },
    {
      id: 'milestones',
      label: 'Milestones',
      node: milestones.length > 0 && (
        <section>
          <SectionLabel>Milestones</SectionLabel>
          <div className="mt-3 space-y-2">
            {milestones.map((m) => (
              <div key={m.threshold} className="text-sm">
                <span className="font-mono text-brass">#{m.threshold}</span>{' '}
                <a
                  href={`https://open.spotify.com/search/${encodeURIComponent(`${m.trackName} ${m.artistName}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper hover:text-brass transition"
                >
                  {m.trackName}
                </a>{' '}
                <span className="text-muted">
                  by{' '}
                  <Link
                    href={`/u/${user.username}/artist/${encodeURIComponent(m.artistName.split(',')[0].trim())}`}
                    className="hover:text-brass transition"
                  >
                    {m.artistName}
                  </Link>{' '}
                  — {m.playedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 'sampled-artists',
      label: "Artists You've Only Sampled",
      node: exploration.sampledArtists.length > 0 && (
        <section>
          <SectionLabel>Artists you've only sampled</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3">
            One track logged so far — might be worth digging deeper.
          </p>
          <div className="flex flex-wrap gap-2">
            {exploration.sampledArtists.map((a) => (
              <Link
                key={a.artistName}
                href={`/u/${user.username}/artist/${encodeURIComponent(a.artistName)}`}
                title={a.trackName}
                className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
              >
                {a.artistName}
              </Link>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 'geography-era',
      label: 'Where & When Your Artists Are From',
      node: (countryBreakdown.length > 0 || oldestArtist || newestArtist) && (
        <section>
          <SectionLabel>Where & when your artists are from</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-4 max-w-lg">
            From MusicBrainz's core artist data — where a band is
            credited as being from, and when they formed. Coverage depends
            on how well-documented an artist is on MusicBrainz, so this
            fills in gradually, same as genre tags.
          </p>

          {countryBreakdown.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
                🌍 Where your top artists are from
              </p>
              <div className="space-y-2 max-w-md">
                {countryBreakdown.map((c) => {
                  const max = countryBreakdown[0].count;
                  return (
                    <div key={c.areaName}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-paper">{c.areaName}</span>
                        <span className="text-muted font-mono">{c.count}×</span>
                      </div>
                      <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
                        <div className="h-full bg-brass rounded-full" style={{ width: `${Math.max(4, (c.count / max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(oldestArtist || newestArtist) && (
            <div className="flex flex-wrap gap-8">
              {oldestArtist && (
                <div>
                  <div className="font-display italic text-xl text-paper">{oldestArtist.formedYear}</div>
                  <div className="text-xs text-muted mt-1 uppercase tracking-wide">
                    Oldest band you listen to — {oldestArtist.label}
                  </div>
                </div>
              )}
              {newestArtist && (
                <div>
                  <div className="font-display italic text-xl text-paper">{newestArtist.formedYear}</div>
                  <div className="text-xs text-muted mt-1 uppercase tracking-wide">
                    Newest band you listen to — {newestArtist.label}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      ),
    },
  ];

  const historyContent = (
    <ReorderableSections
      tab="history"
      sections={historySections}
      savedOrder={(layoutPreferences?.history as string[]) || null}
    />
  );

  const personalitySections: LayoutSection[] = [
    {
      id: 'badges',
      label: 'Badges',
      node: badges.length > 0 && (
        <div>
          <BadgeRow badges={badges} />
        </div>
      ),
    },
    {
      id: 'listening-personality',
      label: 'Listening Personality',
      node: (
        <section>
          <SectionLabel>Listening personality</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-4 max-w-lg">
            A 4-axis type in the spirit of Spotify's 2022 Wrapped feature —
            built from data this app actually has (repeat-listen rate,
            average release year, fame data, and taste diversity), not a
            reproduction of Spotify's own private algorithm.
          </p>
          <PersonalityCard type={personalityType} />
        </section>
      ),
    },
    {
      id: 'time-of-day',
      label: 'Time of Day',
      node: (
        <section>
          <SectionLabel>Time of day</SectionLabel>
          <div className="mt-3 bg-panel border border-line rounded-lg p-4">
            <div className="font-display italic text-2xl text-paper">{timeArchetype.label}</div>
            <p className="text-muted text-sm mt-1">{timeArchetype.description}</p>
            {user.timezone === 'UTC' && isOwnProfile && (
              <p className="text-muted text-xs mt-3">
                This is using UTC by default —{' '}
                <Link href="/settings" className="text-brass hover:underline">
                  set your real timezone in Settings
                </Link>{' '}
                for an accurate read.
              </p>
            )}
          </div>
        </section>
      ),
    },
    {
      id: 'bedtime',
      label: 'Bedtime',
      node: isOwnProfile && (
        <section id="bedtime">
          <SectionLabel>Bedtime</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3 max-w-lg">
            A session counts as "possibly fell asleep to this" if it
            started in the evening, ran at least 45 uninterrupted minutes
            across 5+ tracks, and didn't stop until 11pm or later — a
            pattern, not a fact. Leaving music on while doing something
            else late at night looks the same to this.
          </p>
          {sleepAnalysis.estimatedBedtime ? (
            <div className="bg-panel border border-line rounded-lg p-4">
              <div className="font-display italic text-2xl text-paper">{sleepAnalysis.estimatedBedtime}</div>
              <div className="text-xs text-muted mt-1 uppercase tracking-wide">
                Estimated usual bedtime, from {sleepAnalysis.sampleSize} flagged nights
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm">
              Not enough late-night listening sessions yet to estimate this.
            </p>
          )}

          {sleepAnalysis.sleepSessions.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {sleepAnalysis.sleepSessions.map((s, i) => (
                <div key={i} className="ledger-row flex items-center justify-between py-2 text-sm">
                  <span className="text-paper">{s.date}</span>
                  <span className="text-muted text-xs">
                    {s.startLabel} → {s.endLabel} · {s.trackCount} tracks · {s.durationMinutes}m
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ),
    },
    {
      id: 'stuck-on-repeat',
      label: 'Stuck on Repeat',
      node: repetitionCallout && (
        <section>
          <SectionLabel>Stuck on repeat</SectionLabel>
          <div className="mt-3 bg-panel border border-line rounded-lg p-4 italic text-paper text-sm">
            {repetitionCallout}
          </div>
        </section>
      ),
    },
    {
      id: 'mood-breakdown',
      label: 'Mood Breakdown',
      node: moodBreakdown.length > 0 && (
        <section>
          <SectionLabel>Mood breakdown</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3">
            From plays you've manually tagged with how they felt.
          </p>
          <div className="space-y-2 max-w-md">
            {moodBreakdown.map((m) => (
              <div key={m.mood}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-paper">{m.mood}</span>
                  <span className="text-muted font-mono">{m.pct}% ({m.count})</span>
                </div>
                <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
                  <div className="h-full bg-brass rounded-full" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 'weather-mood',
      label: 'Weather & Mood',
      node: isOwnProfile && (
        <section>
          <SectionLabel>Weather & mood</SectionLabel>
          {!user.locationLat ? (
            <p className="text-muted text-sm mt-3">
              Set your location in{' '}
              <Link href="/settings" className="text-brass hover:underline">
                Settings
              </Link>{' '}
              to see whether the weather actually lines up with what you tag
              yourself feeling.
            </p>
          ) : !weatherMoodCorrelation ? (
            <p className="text-muted text-sm mt-3">
              Tag a few more plays with a mood to unlock this — it needs
              your own mood tags to compare against the weather that day.
            </p>
          ) : (
            <div className="mt-3 bg-panel border border-line rounded-lg p-4">
              <p className="text-paper text-sm italic">{weatherMoodCorrelation.sentence}</p>
              <p className="text-muted text-xs mt-2">
                Based on {weatherMoodCorrelation.sampleSize} mood-tagged plays matched to
                historical weather for your set location. Rainy = 1mm+
                precipitation that day.
              </p>
            </div>
          )}
        </section>
      ),
    },
    {
      id: 'roast',
      label: 'The Roast',
      node: (
        <div className="bg-panel border border-line rounded-lg px-4 py-3 italic text-paper text-sm">
          {roast}
        </div>
      ),
    },
    {
      id: 'lemming',
      label: 'Lemming Leaderboard',
      node: lemmingLeaderboard.length > 0 && (
        <section>
          <SectionLabel>🐑 Lemming Leaderboard</SectionLabel>
          <p className="text-muted text-xs mt-2 mb-3 max-w-lg">
            {user.name || user.username}&apos;s most mainstream plays from the last 30
            days, ranked by how many Wikipedia languages have heard of the
            artist. Getting caught on here means everyone else already knew
            about it.
          </p>
          <LemmingLeaderboard entries={lemmingLeaderboard} profileUsername={user.username} />
        </section>
      ),
    },
    {
      id: 'soulmate',
      label: 'Music Soulmate',
      node: isOwnProfile && soulmate && (
        <div className="bg-panel border border-line rounded-lg px-4 py-3 text-sm">
          <span className="text-muted">Your music soulmate: </span>
          <Link href={`/u/${soulmate.username}`} className="text-brass hover:underline">
            {soulmate.name}
          </Link>
          <span className="text-muted"> — {soulmate.score}% match</span>
        </div>
      ),
    },
  ];

  const personalityContent = (
    <ReorderableSections
      tab="personality"
      sections={personalitySections}
      savedOrder={(layoutPreferences?.personality as string[]) || null}
    />
  );

  const topAlbumArts = [...new Set(plays.map((p) => p.albumArt).filter((a): a is string => !!a))].slice(0, 8);

  const artistFacts = user.factsArtistName ? await buildArtistFacts(user.factsArtistName, user.id) : [];

  return (
    <div style={{ '--accent': user.themeColor } as React.CSSProperties}>
      <ProfileBanner bannerImage={user.bannerImage} albumArts={topAlbumArts} />
      {user.pinnedLabel && (
        <div className="flex items-center gap-3 bg-panel border border-brass/40 rounded-lg px-4 py-3 mb-6">
          <span className="text-brass text-xs uppercase tracking-wide font-mono flex-shrink-0">
            Pinned
          </span>
          {user.pinnedArt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.pinnedArt} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-paper text-sm truncate">{user.pinnedLabel}</div>
            {user.pinnedSublabel && (
              <div className="text-muted text-xs truncate">{user.pinnedSublabel}</div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="w-16 h-16 rounded-full object-cover border border-line" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-panel2 flex items-center justify-center text-2xl">
              ♪
            </div>
          )}
          <div>
            <h1 className="font-display italic text-2xl text-paper">{user.name || user.username}</h1>
            <p className="text-muted text-sm font-mono">@{user.username}</p>
            {user.bio && <p className="text-paper text-sm mt-1 max-w-sm">{user.bio}</p>}
            <Link
              href={`/u/${user.username}/library`}
              className="text-xs text-muted hover:text-brass transition inline-block mt-1.5"
            >
              Browse full library →
            </Link>
          </div>
        </div>

        <div className="pt-2 flex flex-col items-end gap-2">
          {isOwnProfile ? (
            <>
              <SyncButton />
              <ImportLikedButton />
            </>
          ) : viewerId ? (
            <>
              <FollowButton username={user.username} initiallyFollowing={!!isFollowing} />
              <RecommendToProfile toUsername={user.username} displayName={user.name || user.username} />
              <BuildForFriendButton toUsername={user.username} displayName={user.name || user.username} />
            </>
          ) : null}
        </div>
      </div>

      <NowPlayingBadge username={user.username} />
      {isOwnProfile && <PlaybackWidget />}
      {isOwnProfile && <EmbeddedPlayer />}

      {isOwnProfile && pendingRecs.length > 0 && (
        <div className="bg-panel border border-signal/40 rounded-lg p-4 mt-4">
          <p className="text-xs uppercase tracking-widest text-signal font-mono mb-3">
            Recommended to you
          </p>
          <div className="space-y-2">
            {pendingRecs.map((r) => (
              <div key={r.id} className="text-sm text-paper">
                <span className="text-signal">{r.fromUser.name || r.fromUser.username}</span> thinks you
                should hear <span className="font-medium">{r.trackName}</span> —{' '}
                <span className="text-muted">{r.artistName}</span>
              </div>
            ))}
          </div>
          <Link href="/log" className="text-xs text-brass hover:underline mt-2 inline-block">
            Log one from the queue →
          </Link>
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-6">
          <Dashboard
            sleepCount={sleepPlaysCount}
            pendingRecsCount={pendingRecs.length}
            rediscoveriesCount={rediscoveries.length}
          />
        </div>
      )}

      {user.factsArtistName && artistFacts.length > 0 && (
        <div className="mt-6">
          <MusicianFacts artistName={user.factsArtistName} facts={artistFacts} />
        </div>
      )}

      <div className="mt-8">
        <Suspense fallback={null}>
          <RangeSelector />
        </Suspense>
      </div>

      <div className="mt-8">
        <Suspense fallback={null}>
          <ProfileTabs overview={overviewContent} nerdData={nerdDataContent} history={historyContent} personality={personalityContent} />
        </Suspense>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <span className="flex items-baseline gap-1">
        <TapeCounter value={value} />
        {suffix && <span className="text-muted text-sm font-mono">{suffix}</span>}
      </span>
      <div className="text-xs text-muted mt-1.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="font-display italic text-xl text-paper">
        {value}
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      <div className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
      {children}
    </h2>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-muted text-sm py-4">{text}</p>;
}

function RankedSection({
  title,
  items,
  showSublabel,
  showFirstPlayed,
  showPlayButton,
  showSimilar,
  profileUsername,
}: {
  title: string;
  items: { key: string; label: string; sublabel?: string; count: number; firstPlayed?: Date; spotifyUri?: string | null }[];
  showSublabel?: boolean;
  showFirstPlayed?: boolean;
  showPlayButton?: boolean;
  showSimilar?: boolean;
  profileUsername?: string;
}) {
  const isArtistList = title === 'Top artists';

  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <ol className="mt-3">
        {items.length === 0 && <EmptyNote text="No plays yet." />}
        {items.map((item, i) => (
          <li key={item.key} className="ledger-row py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-brass w-4 flex-shrink-0">{i + 1}</span>
                <span className="min-w-0">
                  {isArtistList && profileUsername ? (
                    <Link
                      href={`/u/${profileUsername}/artist/${encodeURIComponent(item.label)}`}
                      className="block truncate text-paper text-sm hover:text-brass transition"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="block truncate text-paper text-sm">{item.label}</span>
                  )}
                  {showSublabel && item.sublabel && profileUsername ? (
                    <Link
                      href={`/u/${profileUsername}/artist/${encodeURIComponent(item.sublabel.split(',')[0].trim())}`}
                      className="block truncate text-muted text-xs hover:text-brass transition"
                    >
                      {item.sublabel}
                    </Link>
                  ) : (
                    showSublabel &&
                    item.sublabel && <span className="block truncate text-muted text-xs">{item.sublabel}</span>
                  )}
                  {showFirstPlayed && item.firstPlayed && (
                    <span className="block truncate text-muted text-xs">
                      since {item.firstPlayed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {showPlayButton && item.spotifyUri && <PlayButton spotifyUri={item.spotifyUri} />}
                <span className="font-mono text-xs text-muted">{item.count}×</span>
              </span>
            </div>
            {showSimilar && item.sublabel && (
              <div className="pl-7 mt-1.5">
                <SimilarTracksPanel artistName={item.sublabel} canPlay={showPlayButton} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
