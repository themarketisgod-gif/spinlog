export interface StatPlay {
  artistName: string;
  trackName: string;
  albumName: string | null;
  albumArt: string | null;
  playedAt: Date;
  durationMs: number | null;
  source: string;
  primaryArtistId?: string | null;
  releaseYear?: number | null;
  artistNames?: string[];
  spotifyUri?: string | null;
  mood?: string | null;
}

export type DateRange = '7d' | '30d' | '90d' | 'year' | 'all';

export function filterByRange(plays: StatPlay[], range: DateRange): StatPlay[] {
  if (range === 'all') return plays;
  const now = Date.now();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return plays.filter((p) => p.playedAt.getTime() >= cutoff);
}

export interface RankedItem {
  key: string;
  label: string;
  sublabel?: string;
  count: number;
  art?: string | null;
  firstPlayed: Date;
  spotifyUri?: string | null;
}

/**
 * The single primary artist for a play, even when artistName is a joined
 * multi-artist credit line (e.g. "Nicki Minaj, Drake, Lil Wayne, Chris
 * Brown" for a track with several features). Uses artistNames[0] when
 * available (populated from Spotify's own ordered artist list), falling
 * back to splitting the joined string for older rows that predate that
 * field. Without this, grouping by the full credit line treats every
 * distinct combination of collaborators as its own "artist."
 */
export function primaryArtistName(p: StatPlay): string {
  if (p.artistNames && p.artistNames.length > 0) return p.artistNames[0];
  return p.artistName.split(',')[0].trim();
}

export function computeTopArtists(plays: StatPlay[], limit = 5): RankedItem[] {
  const map = new Map<string, RankedItem>();
  for (const p of plays) {
    const artist = primaryArtistName(p);
    const existing = map.get(artist);
    if (existing) {
      existing.count += 1;
      if (p.playedAt < existing.firstPlayed) existing.firstPlayed = p.playedAt;
    } else {
      map.set(artist, {
        key: artist,
        label: artist,
        count: 1,
        firstPlayed: p.playedAt,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function computeTopTracks(plays: StatPlay[], limit = 5): RankedItem[] {
  const map = new Map<string, RankedItem>();
  for (const p of plays) {
    const key = `${p.trackName}::${p.artistName}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (p.playedAt < existing.firstPlayed) existing.firstPlayed = p.playedAt;
      existing.art = existing.art ?? p.albumArt;
      existing.spotifyUri = existing.spotifyUri ?? p.spotifyUri ?? null;
    } else {
      map.set(key, {
        key,
        label: p.trackName,
        sublabel: p.artistName,
        count: 1,
        art: p.albumArt,
        firstPlayed: p.playedAt,
        spotifyUri: p.spotifyUri ?? null,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function computeTopAlbums(plays: StatPlay[], limit = 5): RankedItem[] {
  const map = new Map<string, RankedItem>();
  for (const p of plays) {
    if (!p.albumName) continue;
    const key = `${p.albumName}::${p.artistName}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (p.playedAt < existing.firstPlayed) existing.firstPlayed = p.playedAt;
      existing.art = existing.art ?? p.albumArt;
    } else {
      map.set(key, {
        key,
        label: p.albumName,
        sublabel: p.artistName,
        count: 1,
        art: p.albumArt,
        firstPlayed: p.playedAt,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function computeTotalListenTime(plays: StatPlay[]): {
  totalMs: number;
  countedPlays: number;
  totalPlays: number;
} {
  let totalMs = 0;
  let countedPlays = 0;
  for (const p of plays) {
    if (p.durationMs) {
      totalMs += p.durationMs;
      countedPlays += 1;
    }
  }
  return { totalMs, countedPlays, totalPlays: plays.length };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Hour-of-day histogram (0-23). Uses the server's local time interpretation
// of each timestamp — on most hosts (including Vercel) that's UTC, so this
// is an approximation rather than the listener's actual local time.
export function computeHourlyHistogram(plays: StatPlay[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const p of plays) buckets[p.playedAt.getUTCHours()] += 1;
  return buckets;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeWeekdayHistogram(plays: StatPlay[]): { label: string; count: number }[] {
  const buckets = new Array(7).fill(0);
  for (const p of plays) buckets[p.playedAt.getUTCDay()] += 1;
  return WEEKDAY_LABELS.map((label, i) => ({ label, count: buckets[i] }));
}

export function computeMonthlyTopArtist(
  plays: StatPlay[],
  monthsBack = 6
): { monthLabel: string; artist: string | null; count: number }[] {
  const now = new Date();
  const results: { monthLabel: string; artist: string | null; count: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const inMonth = plays.filter((p) => {
      const pd = p.playedAt;
      return `${pd.getFullYear()}-${pd.getMonth()}` === monthKey;
    });
    const counts = new Map<string, number>();
    for (const p of inMonth) counts.set(p.artistName, (counts.get(p.artistName) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    results.push({
      monthLabel: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      artist: top ? top[0] : null,
      count: top ? top[1] : 0,
    });
  }
  return results;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeLongestStreak(plays: StatPlay[]): { longest: number; current: number } {
  if (plays.length === 0) return { longest: 0, current: 0 };
  const days = [...new Set(plays.map((p) => dayKey(p.playedAt)))].sort();
  const dayNumbers = days.map((d) => Math.floor(new Date(d).getTime() / 86400000));

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = Math.floor(Date.now() / 86400000);
  let current = 0;
  if (dayNumbers[dayNumbers.length - 1] >= today - 1) {
    current = 1;
    for (let i = dayNumbers.length - 1; i > 0; i--) {
      if (dayNumbers[i] === dayNumbers[i - 1] + 1) current += 1;
      else break;
    }
  }

  return { longest, current };
}

// "Discovery": counts, per month, how many artists had their all-time-first
// play fall in that month. Needs the user's FULL history (not a filtered
// range) to know when an artist was genuinely first heard.
export function computeDiscoveryRate(
  allTimePlays: StatPlay[],
  monthsBack = 6
): { monthLabel: string; newArtists: number }[] {
  const firstPlayByArtist = new Map<string, Date>();
  for (const p of allTimePlays) {
    const existing = firstPlayByArtist.get(p.artistName);
    if (!existing || p.playedAt < existing) firstPlayByArtist.set(p.artistName, p.playedAt);
  }

  const now = new Date();
  const results: { monthLabel: string; newArtists: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    let count = 0;
    for (const first of firstPlayByArtist.values()) {
      if (`${first.getFullYear()}-${first.getMonth()}` === monthKey) count += 1;
    }
    results.push({
      monthLabel: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      newArtists: count,
    });
  }
  return results;
}

/**
 * A 0-100 score from normalized Shannon entropy over artist play share.
 * Low = heavy rotation of a few artists ("Focused"). High = wide spread
 * ("Eclectic").
 */
export function computeDiversityScore(plays: StatPlay[]): {
  score: number;
  label: string;
} {
  const counts = new Map<string, number>();
  for (const p of plays) counts.set(p.artistName, (counts.get(p.artistName) || 0) + 1);

  const total = plays.length;
  const uniqueArtists = counts.size;
  if (total === 0 || uniqueArtists <= 1) return { score: 0, label: 'Not enough data' };

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(uniqueArtists);
  const score = Math.round((entropy / maxEntropy) * 100);

  const label = score < 34 ? 'Focused' : score < 67 ? 'Balanced' : 'Eclectic';
  return { score, label };
}

/**
 * Taste overlap between two listeners, using Jaccard similarity over each
 * person's top-N artists by play count.
 */
export function computeCompatibility(
  playsA: StatPlay[],
  playsB: StatPlay[],
  topN = 50
): { score: number; sharedArtists: string[] } {
  const topArtists = (plays: StatPlay[]) => {
    const counts = new Map<string, number>();
    for (const p of plays) counts.set(p.artistName, (counts.get(p.artistName) || 0) + 1);
    return new Set(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([name]) => name)
    );
  };

  const setA = topArtists(playsA);
  const setB = topArtists(playsB);
  const shared = [...setA].filter((a) => setB.has(a));
  const union = new Set([...setA, ...setB]);

  const score = union.size === 0 ? 0 : Math.round((shared.length / union.size) * 100);
  return { score, sharedArtists: shared };
}

export interface Badge {
  emoji: string;
  label: string;
  description: string;
}

/**
 * Fun, derived-only badges — no extra API calls, just thresholds over stats
 * already computed elsewhere on the profile page.
 */
export function computeBadges(input: {
  totalPlays: number;
  uniqueArtists: number;
  longestStreak: number;
  diversityScore: number;
  hourlyHistogram: number[];
  topArtistShare: number; // 0-1, top artist's plays / total plays
}): Badge[] {
  const badges: Badge[] = [];
  const { totalPlays, uniqueArtists, longestStreak, diversityScore, hourlyHistogram, topArtistShare } = input;

  if (totalPlays >= 100) badges.push({ emoji: '💯', label: 'Century Club', description: '100+ logged plays' });
  if (totalPlays >= 500) badges.push({ emoji: '🏛️', label: 'The Archive', description: '500+ logged plays' });

  if (longestStreak >= 7) badges.push({ emoji: '🔥', label: 'On a Roll', description: 'A 7+ day listening streak' });
  if (longestStreak >= 30) badges.push({ emoji: '🗓️', label: 'Creature of Habit', description: 'A 30+ day listening streak' });

  if (uniqueArtists >= 50) badges.push({ emoji: '🧭', label: 'Explorer', description: '50+ different artists logged' });

  if (diversityScore >= 75) badges.push({ emoji: '🎨', label: 'Eclectic Ear', description: 'Very spread-out taste' });
  if (topArtistShare >= 0.3) badges.push({ emoji: '🎯', label: 'The Loyalist', description: 'One artist dominates your plays' });

  const nightPlays = hourlyHistogram.slice(0, 5).reduce((a, b) => a + b, 0); // 12am-5am
  const morningPlays = hourlyHistogram.slice(5, 9).reduce((a, b) => a + b, 0); // 5am-9am
  const total = hourlyHistogram.reduce((a, b) => a + b, 0);
  if (total > 10 && nightPlays / total > 0.3) badges.push({ emoji: '🦉', label: 'Night Owl', description: 'Plenty of late-night listening' });
  if (total > 10 && morningPlays / total > 0.3) badges.push({ emoji: '🌅', label: 'Early Bird', description: 'Plenty of early-morning listening' });

  return badges;
}

export interface GenreCount {
  genre: string;
  count: number;
}

/**
 * Combines artistId -> genres lookups with play counts per artist to build
 * a weighted top-genres list. Artists with no resolvable ID or genre data
 * are simply excluded rather than skewing the result.
 */
export function computeGenreBreakdown(
  plays: StatPlay[],
  artistIdByName: Map<string, string>,
  genresByArtistId: Map<string, string[]>,
  limit = 8
): GenreCount[] {
  const genreCounts = new Map<string, number>();

  const artistPlayCounts = new Map<string, number>();
  for (const p of plays) artistPlayCounts.set(p.artistName, (artistPlayCounts.get(p.artistName) || 0) + 1);

  for (const [artistName, playCount] of artistPlayCounts.entries()) {
    const artistId = artistIdByName.get(artistName);
    if (!artistId) continue;
    const genres = genresByArtistId.get(artistId) || [];
    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + playCount);
    }
  }

  return [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Same idea as computeGenreBreakdown, but keyed directly by artist name
 * instead of a Spotify artist ID — used when merging genre/tag data from
 * multiple sources (Spotify + MusicBrainz) that don't share an ID scheme.
 */
export function computeGenreBreakdownByName(
  plays: StatPlay[],
  genresByArtistName: Map<string, string[]>,
  limit = 8
): GenreCount[] {
  const genreCounts = new Map<string, number>();

  const artistPlayCounts = new Map<string, number>();
  for (const p of plays) artistPlayCounts.set(p.artistName, (artistPlayCounts.get(p.artistName) || 0) + 1);

  for (const [artistName, playCount] of artistPlayCounts.entries()) {
    const genres = genresByArtistName.get(artistName) || [];
    for (const genre of genres) {
      // Normalize case so "Pop" and "pop" from different sources merge.
      const key = genre.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) || 0) + playCount);
    }
  }

  return [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function computeDecadeBreakdown(plays: StatPlay[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of plays) {
    if (!p.releaseYear) continue;
    const decade = Math.floor(p.releaseYear / 10) * 10;
    const label = `${decade}s`;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface RediscoveryItem {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  totalPlays: number;
  lastPlayed: Date;
}

/**
 * Surfaces tracks that were clearly a favorite at some point (played several
 * times) but haven't come up recently — good "you used to love this" prompts.
 */
export function computeRediscoveries(
  plays: StatPlay[],
  minPlays = 3,
  staleDays = 60,
  limit = 5
): RediscoveryItem[] {
  const map = new Map<string, { artistName: string; albumArt: string | null; count: number; lastPlayed: Date }>();
  for (const p of plays) {
    const key = `${p.trackName}::${p.artistName}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (p.playedAt > existing.lastPlayed) existing.lastPlayed = p.playedAt;
      existing.albumArt = existing.albumArt ?? p.albumArt;
    } else {
      map.set(key, { artistName: p.artistName, albumArt: p.albumArt, count: 1, lastPlayed: p.playedAt });
    }
  }

  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const results: RediscoveryItem[] = [];
  for (const [key, data] of map.entries()) {
    if (data.count >= minPlays && data.lastPlayed.getTime() < cutoff) {
      const [trackName] = key.split('::');
      results.push({
        trackName,
        artistName: data.artistName,
        albumArt: data.albumArt,
        totalPlays: data.count,
        lastPlayed: data.lastPlayed,
      });
    }
  }

  return results.sort((a, b) => b.totalPlays - a.totalPlays).slice(0, limit);
}

/**
 * Finds plays from previous years that happened on the same month/day as
 * "now" — a "this day in your history" callback. Naturally returns nothing
 * until a listener has more than a year of history.
 */
export interface ExplorationDepth {
  deepCuts: number; // artists with 5+ distinct tracks played
  samplers: number; // artists with exactly 1 track played
  sampledArtists: { artistName: string; trackName: string }[]; // for "explore more" prompts
}

export function computeExplorationDepth(plays: StatPlay[], sampleLimit = 6): ExplorationDepth {
  const tracksByArtist = new Map<string, Set<string>>();
  const oneTrackExample = new Map<string, string>();

  for (const p of plays) {
    const artist = primaryArtistName(p);
    if (!tracksByArtist.has(artist)) tracksByArtist.set(artist, new Set());
    tracksByArtist.get(artist)!.add(p.trackName);
    if (!oneTrackExample.has(artist)) oneTrackExample.set(artist, p.trackName);
  }

  let deepCuts = 0;
  let samplers = 0;
  const sampledArtists: { artistName: string; trackName: string }[] = [];

  for (const [artistName, tracks] of tracksByArtist.entries()) {
    if (tracks.size >= 5) deepCuts += 1;
    if (tracks.size === 1) {
      samplers += 1;
      if (sampledArtists.length < sampleLimit) {
        sampledArtists.push({ artistName, trackName: oneTrackExample.get(artistName)! });
      }
    }
  }

  return { deepCuts, samplers, sampledArtists };
}

export interface Session {
  startedAt: Date;
  endedAt: Date;
  trackCount: number;
  durationMs: number;
}

/**
 * Groups plays into "sessions" — runs of listening with no gap longer than
 * `gapMinutes` between consecutive plays. Pure clustering over timestamps
 * you already have, so this is exact, not an estimate.
 */
export function computeSessions(plays: StatPlay[], gapMinutes = 30): Session[] {
  if (plays.length === 0) return [];
  const sorted = [...plays].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const gapMs = gapMinutes * 60 * 1000;

  const sessions: Session[] = [];
  let current: StatPlay[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].playedAt.getTime() - sorted[i - 1].playedAt.getTime();
    if (gap > gapMs) {
      sessions.push(buildSession(current));
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  sessions.push(buildSession(current));
  return sessions;
}

function buildSession(plays: StatPlay[]): Session {
  const startedAt = plays[0].playedAt;
  const lastPlay = plays[plays.length - 1];
  // End of session = start of the last track + its duration if known,
  // otherwise just the last play's start time.
  const endedAt = lastPlay.durationMs
    ? new Date(lastPlay.playedAt.getTime() + lastPlay.durationMs)
    : lastPlay.playedAt;
  return {
    startedAt,
    endedAt,
    trackCount: plays.length,
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
  };
}

export interface SessionStats {
  totalSessions: number;
  avgTracksPerSession: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
}

export function computeSessionStats(plays: StatPlay[], gapMinutes = 30): SessionStats {
  const sessions = computeSessions(plays, gapMinutes);
  if (sessions.length === 0) {
    return { totalSessions: 0, avgTracksPerSession: 0, avgSessionMinutes: 0, longestSessionMinutes: 0 };
  }
  const totalTracks = sessions.reduce((sum, s) => sum + s.trackCount, 0);
  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const longestMs = Math.max(...sessions.map((s) => s.durationMs));

  return {
    totalSessions: sessions.length,
    avgTracksPerSession: Math.round((totalTracks / sessions.length) * 10) / 10,
    avgSessionMinutes: Math.round(totalMs / sessions.length / 60000),
    longestSessionMinutes: Math.round(longestMs / 60000),
  };
}

export interface SkipEstimate {
  skipRate: number; // 0-100, percentage of comparable plays that look skipped
  comparablePlays: number;
  likelySkipped: { trackName: string; artistName: string }[];
}

/**
 * Estimates how often a track looks skipped: the next play started well
 * before this track's known duration would have finished. This is an
 * inference, not a fact from Spotify — a fast transition could also mean
 * a manual skip-ahead in the queue, not necessarily "disliked the song."
 * Only tracks with a known duration (Spotify-sourced plays) are counted;
 * everything else is excluded rather than guessed at.
 */
export function computeSkipEstimate(
  plays: StatPlay[],
  toleranceMs = 15000,
  exampleLimit = 5
): SkipEstimate {
  const sorted = [...plays].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  let comparable = 0;
  let skipped = 0;
  const examples: { trackName: string; artistName: string }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!current.durationMs) continue;

    const expectedEnd = current.playedAt.getTime() + current.durationMs;
    const actualGap = next.playedAt.getTime() - current.playedAt.getTime();

    // Only count as "comparable" if the next play happened somewhat close
    // in time (same listening session) — otherwise we're just seeing the
    // natural end of a session, not a skip.
    if (actualGap > current.durationMs + 30 * 60 * 1000) continue;

    comparable += 1;
    if (next.playedAt.getTime() < expectedEnd - toleranceMs) {
      skipped += 1;
      if (examples.length < exampleLimit) {
        examples.push({ trackName: current.trackName, artistName: current.artistName });
      }
    }
  }

  return {
    skipRate: comparable > 0 ? Math.round((skipped / comparable) * 100) : 0,
    comparablePlays: comparable,
    likelySkipped: examples,
  };
}

export interface Milestone {
  threshold: number;
  trackName: string;
  artistName: string;
  playedAt: Date;
}

/**
 * Finds which track was your Nth all-time play, for a set of round-number
 * thresholds. Purely positional over your own chronological history.
 */
export function computeMilestones(
  allTimePlays: StatPlay[],
  thresholds = [100, 500, 1000, 2500, 5000]
): Milestone[] {
  const sorted = [...allTimePlays].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const milestones: Milestone[] = [];
  for (const threshold of thresholds) {
    if (sorted.length >= threshold) {
      const play = sorted[threshold - 1];
      milestones.push({
        threshold,
        trackName: play.trackName,
        artistName: play.artistName,
        playedAt: play.playedAt,
      });
    }
  }
  return milestones;
}

/**
 * Returns the plays from the period immediately preceding the given range,
 * of the same length — e.g. for "30d", this is days 31-60 ago. Used to
 * compute trend deltas. Returns an empty array for "all" or "year" since
 * "the period before all time" isn't a meaningful concept.
 */
export function computePreviousRangePlays(allPlays: StatPlay[], range: DateRange): StatPlay[] {
  if (range === 'all' || range === 'year') return [];
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const now = Date.now();
  const periodMs = days * 24 * 60 * 60 * 1000;
  const start = now - periodMs * 2;
  const end = now - periodMs;
  return allPlays.filter((p) => {
    const t = p.playedAt.getTime();
    return t >= start && t < end;
  });
}

export interface TrendItem {
  artistName: string;
  currentRank: number;
  previousRank: number | null; // null = wasn't in the previous period's top list at all
}

export function computeTrendDeltas(
  currentPlays: StatPlay[],
  previousPlays: StatPlay[],
  limit = 5
): TrendItem[] {
  const currentTop = computeTopArtists(currentPlays, limit);
  const previousTop = computeTopArtists(previousPlays, 50); // wider net to find prior rank

  return currentTop.map((item, i) => {
    const prevIndex = previousTop.findIndex((p) => p.label === item.label);
    return {
      artistName: item.label,
      currentRank: i + 1,
      previousRank: prevIndex === -1 ? null : prevIndex + 1,
    };
  });
}

export interface CollaborationPair {
  artists: [string, string];
  count: number;
}

export interface CollaborationStats {
  topPairs: CollaborationPair[];
  totalCollabPlays: number;
  topFeaturedArtists: { artistName: string; count: number }[]; // artists who show up mainly as a second/third credit
}

/**
 * Uses the full artist credit list (not just the primary artist) to find
 * recurring collaborations and which artists tend to show up as features
 * rather than as the lead. Plays without a stored artist list (older data,
 * or manual entries) are simply skipped rather than guessed at.
 */
export function computeCollaborations(plays: StatPlay[], limit = 5): CollaborationStats {
  const pairCounts = new Map<string, number>();
  const featureCounts = new Map<string, number>();
  let totalCollabPlays = 0;

  for (const p of plays) {
    const names = p.artistNames;
    if (!names || names.length < 2) continue;
    totalCollabPlays += 1;

    for (let i = 0; i < names.length; i++) {
      if (i > 0) {
        featureCounts.set(names[i], (featureCounts.get(names[i]) || 0) + 1);
      }
      for (let j = i + 1; j < names.length; j++) {
        const pair = [names[i], names[j]].sort();
        const key = pair.join('::');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  const topPairs = [...pairCounts.entries()]
    .map(([key, count]) => ({ artists: key.split('::') as [string, string], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const topFeaturedArtists = [...featureCounts.entries()]
    .map(([artistName, count]) => ({ artistName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { topPairs, totalCollabPlays, topFeaturedArtists };
}

/**
 * A silly, fully deterministic "roast" of someone's listening habits, built
 * from thresholds over stats already computed elsewhere. No AI call, no
 * external data — just template text picked by simple rules, so it's free,
 * instant, and the same for the same stats every time.
 */
export function generateRoast(input: {
  totalPlays: number;
  topArtistShare: number;
  topArtistName: string | null;
  diversityScore: number;
  skipRate: number;
  nightOwlShare: number; // 0-1, fraction of plays between midnight-5am
}): string {
  const { totalPlays, topArtistShare, topArtistName, diversityScore, skipRate, nightOwlShare } = input;
  const lines: string[] = [];

  if (totalPlays === 0) {
    return "You haven't logged anything yet. Even a horoscope needs a birth chart.";
  }

  if (topArtistShare > 0.35 && topArtistName) {
    lines.push(
      `${Math.round(topArtistShare * 100)}% of your plays are ${topArtistName}. At this point just marry them.`
    );
  } else if (diversityScore > 80) {
    lines.push("Your taste is so scattered it looks like you're doing research, not listening for fun.");
  } else if (diversityScore < 30) {
    lines.push('Your rotation is so tight you could set a watch to it. A boring watch.');
  }

  if (skipRate > 40) {
    lines.push(`You skip an estimated ${skipRate}% of what you start. Commitment issues, but for songs.`);
  } else if (skipRate < 5 && skipRate > 0) {
    lines.push("You almost never skip anything. Either great taste or crippling indecision.");
  }

  if (nightOwlShare > 0.3) {
    lines.push("A suspicious amount of this happens after midnight. We don't judge. We just note it.");
  }

  if (lines.length === 0) {
    lines.push('Frankly, your stats are disturbingly well-balanced. Suspicious.');
  }

  return lines.join(' ');
}

export function computeAveragePlaysPerDay(plays: StatPlay[]): number {
  if (plays.length === 0) return 0;
  const days = new Set(plays.map((p) => p.playedAt.toISOString().slice(0, 10)));
  return Math.round((plays.length / days.size) * 10) / 10;
}

export interface DrySpell {
  days: number;
  from: Date;
  to: Date;
}

/** The longest gap between two consecutive days that had at least one play. */
export function computeLongestDrySpell(plays: StatPlay[]): DrySpell | null {
  if (plays.length < 2) return null;
  const days = [...new Set(plays.map((p) => p.playedAt.toISOString().slice(0, 10)))].sort();
  let longest: DrySpell | null = null;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const gapDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (!longest || gapDays > longest.days) {
      longest = { days: gapDays, from: prev, to: curr };
    }
  }
  return longest;
}

/**
 * Rate of "immediate replays" — plays where the very next play is the same
 * track, a different signal from the skip-rate estimate (this measures
 * loving something enough to run it back, not skipping past it).
 */
export function computeRepeatRate(plays: StatPlay[]): { rate: number; total: number } {
  const sorted = [...plays].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  if (sorted.length < 2) return { rate: 0, total: 0 };

  let repeats = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (
      sorted[i].trackName === sorted[i - 1].trackName &&
      sorted[i].artistName === sorted[i - 1].artistName
    ) {
      repeats += 1;
    }
  }
  return { rate: Math.round((repeats / (sorted.length - 1)) * 100), total: sorted.length - 1 };
}

export function computeWeekendSplit(plays: StatPlay[]): { weekendPct: number; weekdayPct: number } {
  if (plays.length === 0) return { weekendPct: 0, weekdayPct: 0 };
  let weekend = 0;
  for (const p of plays) {
    const day = p.playedAt.getUTCDay();
    if (day === 0 || day === 6) weekend += 1;
  }
  const weekendPct = Math.round((weekend / plays.length) * 100);
  return { weekendPct, weekdayPct: 100 - weekendPct };
}

export interface SourceBreakdownItem {
  label: string;
  count: number;
  pct: number;
}

const SOURCE_LABELS: Record<string, string> = {
  spotify: 'Spotify sync',
  library: 'Liked songs import',
  apple_music: 'Apple Music (logged)',
  youtube_music: 'YouTube Music (logged)',
  pandora: 'Pandora (logged)',
  vinyl: 'Vinyl (logged)',
  live: 'Live show (logged)',
  other: 'Logged by hand',
  lastfm_scrobble: 'Last.fm scrobbles',
  lastfm_loved: 'Last.fm loved tracks',
};

export function computeSourceBreakdown(
  plays: (StatPlay & { manualSource?: string | null })[]
): SourceBreakdownItem[] {
  const counts = new Map<string, number>();
  for (const p of plays) {
    const key =
      p.source === 'manual'
        ? p.manualSource || 'other'
        : p.source === 'lastfm'
        ? `lastfm_${p.manualSource || 'scrobble'}`
        : p.source;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = plays.length || 1;
  return [...counts.entries()]
    .map(([key, count]) => ({
      label: SOURCE_LABELS[key] || key,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface TrackDurationExtreme {
  trackName: string;
  artistName: string;
  durationMs: number;
}

export function computeDurationExtremes(
  plays: StatPlay[]
): { longest: TrackDurationExtreme | null; shortest: TrackDurationExtreme | null } {
  let longest: TrackDurationExtreme | null = null;
  let shortest: TrackDurationExtreme | null = null;

  for (const p of plays) {
    if (!p.durationMs) continue;
    if (!longest || p.durationMs > longest.durationMs) {
      longest = { trackName: p.trackName, artistName: p.artistName, durationMs: p.durationMs };
    }
    if (!shortest || p.durationMs < shortest.durationMs) {
      shortest = { trackName: p.trackName, artistName: p.artistName, durationMs: p.durationMs };
    }
  }
  return { longest, shortest };
}

/** Local hour (0-23) of a UTC timestamp in a given IANA timezone. */
function localHour(date: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(date);
    const hour = parseInt(formatted, 10);
    return Number.isFinite(hour) ? hour % 24 : date.getUTCHours();
  } catch {
    return date.getUTCHours(); // invalid timezone string — fall back rather than crash
  }
}

/** Same as computeHourlyHistogram, but adjusted to the listener's own
 * timezone instead of the server's (UTC on Vercel). */
export function computeHourlyHistogramTZ(plays: StatPlay[], timezone: string): number[] {
  const buckets = new Array(24).fill(0);
  for (const p of plays) buckets[localHour(p.playedAt, timezone)] += 1;
  return buckets;
}

export interface TimeOfDayArchetype {
  label: string;
  description: string;
}

export function computeTimeOfDayArchetype(hourlyHistogram: number[]): TimeOfDayArchetype {
  const total = hourlyHistogram.reduce((a, b) => a + b, 0);
  if (total < 10) {
    return { label: 'Not enough data', description: 'Log a few more plays and check back.' };
  }

  const bucket = (start: number, end: number) =>
    hourlyHistogram.slice(start, end).reduce((a, b) => a + b, 0) / total;

  const night = bucket(0, 5); // 12am-5am
  const morning = bucket(5, 9); // 5am-9am
  const midday = bucket(9, 17); // 9am-5pm
  const evening = bucket(17, 21); // 5pm-9pm
  const lateEvening = bucket(21, 24); // 9pm-12am

  const scores: [string, number, string][] = [
    ['Night Owl', night, "Most of your listening happens after midnight, while everyone sane is asleep."],
    ['Early Bird', morning, 'You front-load your listening into the early morning, before most people are awake.'],
    ['Daytime Listener', midday, 'Your listening clusters around the working day — music as a backdrop to everything else.'],
    ['Evening Wind-Down', evening, 'You do most of your listening right after the day ends, prime wind-down hours.'],
    ['Late-Night Lurker', lateEvening, "You're still going strong well after dinner, right up to midnight."],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  return { label: scores[0][0], description: scores[0][2] };
}

export function computeAverageReleaseYear(plays: StatPlay[]): number | null {
  const years = plays.map((p) => p.releaseYear).filter((y): y is number => !!y);
  if (years.length === 0) return null;
  return Math.round(years.reduce((a, b) => a + b, 0) / years.length);
}

export interface PersonalityAxis {
  code: string; // single letter
  label: string;
  description: string;
}

export interface PersonalityType {
  code: string; // 4-letter code
  axes: PersonalityAxis[];
}

/**
 * A 4-axis "listening personality" in the spirit of Spotify's 2022 Wrapped
 * feature — but built entirely from data this app actually has, not
 * reproducing Spotify's exact (private, undocumented) algorithm. Each axis
 * is a real, derived signal: repeat-listen rate, average release year,
 * community/global fame, and taste diversity.
 */
export function computePersonalityType(input: {
  repeatRate: number;
  avgReleaseYear: number | null;
  avgFameSitelinks: number | null;
  diversityScore: number;
}): PersonalityType {
  const { repeatRate, avgReleaseYear, avgFameSitelinks, diversityScore } = input;
  const currentYear = new Date().getFullYear();

  const loyaltyAxis: PersonalityAxis =
    repeatRate >= 8
      ? { code: 'L', label: 'Loyalty', description: 'You run tracks back constantly — once something clicks, it stays in heavy rotation.' }
      : { code: 'V', label: 'Variety', description: "You rarely repeat a track twice in a row — always moving on to the next thing." };

  const timeAxis: PersonalityAxis =
    avgReleaseYear === null
      ? { code: 'N', label: 'Newness', description: 'Not enough release-date data yet to say for sure — leaning toward current by default.' }
      : currentYear - avgReleaseYear <= 3
      ? { code: 'N', label: 'Newness', description: 'Your average track is only a couple years old — you live at the release-date edge.' }
      : { code: 'T', label: 'Timelessness', description: `Your average track is from around ${avgReleaseYear} — you wander the whole catalog, not just what's new.` };

  const fameAxis: PersonalityAxis =
    avgFameSitelinks === null
      ? { code: 'U', label: 'Uniqueness', description: "Not enough fame data cached yet — but your top artists aren't exactly radio staples." }
      : avgFameSitelinks >= 15
      ? { code: 'C', label: 'Commonality', description: 'Your top artists are genuinely famous — you and a few hundred million other people share a playlist, basically.' }
      : { code: 'U', label: 'Uniqueness', description: "Your top artists don't have huge global profiles — you're digging deeper than the charts." };

  const breadthAxis: PersonalityAxis =
    diversityScore >= 60
      ? { code: 'B', label: 'Breadth', description: 'Your listening spans a wide spread of artists rather than clustering on a few favorites.' }
      : { code: 'D', label: 'Depth', description: "You go deep on a smaller set of artists rather than spreading thin." };

  const axes = [loyaltyAxis, timeAxis, fameAxis, breadthAxis];
  return { code: axes.map((a) => a.code).join(''), axes };
}

export interface RepeatedRecentTrack {
  trackName: string;
  artistName: string;
  count: number;
  days: number;
}

/** The single most-played track in a recent window — feeds the "you keep
 * playing this" callout, distinct from the immediate-replay repeat rate. */
export function computeMostRepeatedRecent(plays: StatPlay[], days = 7): RepeatedRecentTrack | null {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = plays.filter((p) => p.playedAt.getTime() >= cutoff);
  if (recent.length === 0) return null;

  const counts = new Map<string, { artistName: string; count: number }>();
  for (const p of recent) {
    const key = `${p.trackName}::${p.artistName}`;
    const existing = counts.get(key);
    counts.set(key, { artistName: p.artistName, count: (existing?.count || 0) + 1 });
  }

  const top = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (!top || top[1].count < 3) return null; // not worth calling out below 3 plays

  const [trackName] = top[0].split('::');
  return { trackName, artistName: top[1].artistName, count: top[1].count, days };
}

export function generateRepetitionCallout(repeated: RepeatedRecentTrack | null): string | null {
  if (!repeated) return null;
  const { trackName, count, days } = repeated;
  if (count >= 15) {
    return `You've played "${trackName}" ${count} times in the last ${days} days. This isn't a favorite anymore, it's a hostage situation.`;
  }
  if (count >= 8) {
    return `"${trackName}" ${count} times in ${days} days. At some point the algorithm should just rename itself after this song.`;
  }
  return `You've circled back to "${trackName}" ${count} times this week. Might be worth branching out.`;
}

export interface MoodBreakdownItem {
  mood: string;
  count: number;
  pct: number;
}

const MOOD_LABELS: Record<string, string> = {
  happy: '😊 Happy',
  sad: '😢 Sad',
  hype: '⚡ Hype',
  chill: '😌 Chill',
  heartbroken: '💔 Heartbroken',
  angry: '😠 Angry',
  focus: '🎯 Focus',
  love: '🥰 In Love',
};

export function computeMoodBreakdown(plays: StatPlay[]): MoodBreakdownItem[] {
  const tagged = plays.filter((p) => p.mood);
  if (tagged.length === 0) return [];

  const counts = new Map<string, number>();
  for (const p of tagged) counts.set(p.mood!, (counts.get(p.mood!) || 0) + 1);

  return [...counts.entries()]
    .map(([mood, count]) => ({
      mood: MOOD_LABELS[mood] || mood,
      count,
      pct: Math.round((count / tagged.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface WeatherMoodCorrelation {
  sentence: string;
  rainyMoodPct: Map<string, number>;
  dryMoodPct: Map<string, number>;
  hotMoodPct: Map<string, number>;
  coldMoodPct: Map<string, number>;
  sampleSize: number;
}

/**
 * Correlates self-tagged moods against the weather on the day each play
 * happened. This uses your own manually-tagged moods as the "how did it
 * feel" signal — there's no other honest source for that, since Spotify's
 * audio-feature/valence data was deprecated for new apps in 2024.
 */
export function computeWeatherMoodCorrelation(
  plays: StatPlay[],
  weatherByDate: Map<string, { tempMaxC: number | null; precipitationMm: number | null }>,
  minSample = 10
): WeatherMoodCorrelation | null {
  const tagged = plays.filter((p) => p.mood);
  if (tagged.length < minSample) return null;

  const buckets = {
    rainy: new Map<string, number>(),
    dry: new Map<string, number>(),
    hot: new Map<string, number>(),
    cold: new Map<string, number>(),
  };
  const totals = { rainy: 0, dry: 0, hot: 0, cold: 0 };

  for (const p of tagged) {
    const dateKey = p.playedAt.toISOString().slice(0, 10);
    const weather = weatherByDate.get(dateKey);
    if (!weather) continue;

    const isRainy = (weather.precipitationMm ?? 0) >= 1;
    const rainKey = isRainy ? 'rainy' : 'dry';
    buckets[rainKey].set(p.mood!, (buckets[rainKey].get(p.mood!) || 0) + 1);
    totals[rainKey] += 1;

    if (weather.tempMaxC !== null) {
      if (weather.tempMaxC >= 27) {
        buckets.hot.set(p.mood!, (buckets.hot.get(p.mood!) || 0) + 1);
        totals.hot += 1;
      } else if (weather.tempMaxC <= 10) {
        buckets.cold.set(p.mood!, (buckets.cold.get(p.mood!) || 0) + 1);
        totals.cold += 1;
      }
    }
  }

  const toPct = (map: Map<string, number>, total: number) => {
    const pct = new Map<string, number>();
    for (const [mood, count] of map.entries()) pct.set(mood, total > 0 ? Math.round((count / total) * 100) : 0);
    return pct;
  };

  const rainyMoodPct = toPct(buckets.rainy, totals.rainy);
  const dryMoodPct = toPct(buckets.dry, totals.dry);
  const hotMoodPct = toPct(buckets.hot, totals.hot);
  const coldMoodPct = toPct(buckets.cold, totals.cold);

  // Find the single biggest swing between rainy and dry for any mood, to
  // build a one-line highlight rather than dumping a full table.
  let sentence = "Not enough overlap between tagged moods and matched weather days yet to say anything meaningful.";
  let biggestDelta = 0;
  let biggestMood = '';
  let biggestDirection: 'rainy' | 'dry' = 'rainy';

  const allMoods = new Set([...rainyMoodPct.keys(), ...dryMoodPct.keys()]);
  for (const mood of allMoods) {
    const rainyPct = rainyMoodPct.get(mood) || 0;
    const dryPct = dryMoodPct.get(mood) || 0;
    const delta = rainyPct - dryPct;
    if (Math.abs(delta) > Math.abs(biggestDelta)) {
      biggestDelta = delta;
      biggestMood = mood;
      biggestDirection = delta > 0 ? 'rainy' : 'dry';
    }
  }

  if (biggestMood && Math.abs(biggestDelta) >= 10 && totals.rainy >= 3 && totals.dry >= 3) {
    const rainyPct = rainyMoodPct.get(biggestMood) || 0;
    const dryPct = dryMoodPct.get(biggestMood) || 0;
    sentence =
      biggestDirection === 'rainy'
        ? `On rainy days, ${rainyPct}% of your tagged plays are "${biggestMood}" — compared to ${dryPct}% on dry days.`
        : `On dry days, ${dryPct}% of your tagged plays are "${biggestMood}" — compared to ${rainyPct}% on rainy days.`;
  }

  return {
    sentence,
    rainyMoodPct,
    dryMoodPct,
    hotMoodPct,
    coldMoodPct,
    sampleSize: tagged.length,
  };
}

function localDateParts(date: Date, timezone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return { hour, minute };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}

/** Hour expressed on a continuous evening→morning scale (11pm = 23,
 * 1am = 25) so midnight doesn't break ordering or averaging. */
function nightHourValue(hour: number, minute: number): number {
  return (hour < 12 ? hour + 24 : hour) + minute / 60;
}

function formatNightHour(value: number): string {
  const hour24 = Math.floor(value) % 24;
  const minute = Math.round((value - Math.floor(value)) * 60);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

export interface SleepSession {
  date: string;
  startLabel: string;
  endLabel: string;
  trackCount: number;
  durationMinutes: number;
  rangeStart: Date;
  rangeEnd: Date;
}

export interface SleepAnalysis {
  sleepSessions: SleepSession[];
  estimatedBedtime: string | null;
  sampleSize: number;
  allRanges: { start: Date; end: Date }[];
}

/**
 * Flags listening sessions that started in the evening/night and ran long
 * enough, uninterrupted, that falling asleep partway through is a
 * plausible explanation — then estimates a "usual bedtime" from when
 * those sessions actually stop. This is a pattern-based inference, not a
 * fact: someone could just as easily have left music running while doing
 * something else. Presented as a rough signal, not a claim about what
 * actually happened.
 */
export function computeSleepAnalysis(
  allTimePlays: StatPlay[],
  timezone: string,
  minTracks = 5,
  minMinutes = 45
): SleepAnalysis {
  const sessions = computeSessions(allTimePlays, 30);
  const nightSessions: { session: Session; startNightHour: number; endNightHour: number }[] = [];

  for (const s of sessions) {
    const startParts = localDateParts(s.startedAt, timezone);
    const startNightHour = nightHourValue(startParts.hour, startParts.minute);
    // Only sessions that started in the evening/night window (8pm-4am).
    if (startNightHour < 20 || startNightHour > 28) continue;

    const endParts = localDateParts(s.endedAt, timezone);
    const endNightHour = nightHourValue(endParts.hour, endParts.minute);
    nightSessions.push({ session: s, startNightHour, endNightHour });
  }

  const sleepFlagged = nightSessions.filter(
    (n) =>
      n.session.trackCount >= minTracks &&
      n.session.durationMs / 60000 >= minMinutes &&
      // The real "possibly asleep" signal is that the session ran late
      // enough that stopping voluntarily gets less likely — an evening
      // session that just ends at a normal hour (9-10pm) is ordinary
      // listening, not a sign of dozing off, even if it started at 8pm.
      n.endNightHour >= 23
  );

  const sleepSessions: SleepSession[] = sleepFlagged
    .slice(-20)
    .reverse()
    .map((n) => ({
      date: n.session.startedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      startLabel: formatNightHour(n.startNightHour),
      endLabel: formatNightHour(n.endNightHour),
      trackCount: n.session.trackCount,
      durationMinutes: Math.round(n.session.durationMs / 60000),
      rangeStart: n.session.startedAt,
      rangeEnd: n.session.endedAt,
    }));

  let estimatedBedtime: string | null = null;
  if (sleepFlagged.length >= 5) {
    const endHours = sleepFlagged.map((n) => n.endNightHour).sort((a, b) => a - b);
    const mid = Math.floor(endHours.length / 2);
    const median = endHours.length % 2 === 0 ? (endHours[mid - 1] + endHours[mid]) / 2 : endHours[mid];
    estimatedBedtime = formatNightHour(median);
  }

  return {
    sleepSessions,
    estimatedBedtime,
    sampleSize: sleepFlagged.length,
    allRanges: sleepFlagged.map((n) => ({ start: n.session.startedAt, end: n.session.endedAt })),
  };
}
