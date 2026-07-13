import { prisma } from './prisma';

const MB_API = 'https://musicbrainz.org/ws/2';
// MusicBrainz requires a descriptive User-Agent identifying the app —
// requests without one are more likely to be rate-limited or blocked.
const USER_AGENT = 'Spinlog-ListeningLog/1.0 ( https://spinlog.app )';

// A single unresponsive external call shouldn't be able to hang the whole
// page load — cap each request rather than waiting indefinitely.
const FETCH_TIMEOUT_MS = 5000;

async function mbFetch(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${MB_API}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchWikidataSitelinks(qid: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities?.[qid];
    if (!entity) return null;
    return Object.keys(entity.sitelinks || {}).length;
  } catch {
    return null;
  }
}

export interface BandMember {
  name: string;
  mbid: string;
  begin: string | null;
  end: string | null;
  current: boolean;
}

export interface ArtistMetadata {
  mbid: string | null;
  tags: string[];
  wikidataSitelinks: number | null;
  country: string | null;
  areaName: string | null;
  formedYear: number | null;
  members: BandMember[];
}

/**
 * One MusicBrainz lookup gets genre tags, a Wikidata relation, and band
 * member relationships all in a single request — country, formation year,
 * and member list are core/relationship data MusicBrainz already returns,
 * not separate paid or rate-limited endpoints, so this adds no extra
 * network round trips over what was already being fetched.
 */
async function fetchFreshMetadata(artistName: string): Promise<ArtistMetadata> {
  const query = encodeURIComponent(`artist:"${artistName}"`);
  const searchData = await mbFetch(`/artist/?query=${query}&fmt=json&limit=1`);
  const candidate = searchData?.artists?.[0];
  if (!candidate) {
    return { mbid: null, tags: [], wikidataSitelinks: null, country: null, areaName: null, formedYear: null, members: [] };
  }

  await new Promise((r) => setTimeout(r, 300)); // be polite between calls

  const detail = await mbFetch(`/artist/${candidate.id}?inc=tags+url-rels+artist-rels&fmt=json`);
  const tags = (detail?.tags || [])
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5)
    .map((t: any) => t.name);

  const wikidataRel = (detail?.relations || []).find(
    (r: any) => r.type === 'wikidata' && r.url?.resource
  );
  const qidMatch = wikidataRel?.url?.resource?.match(/Q\d+/);
  const qid = qidMatch ? qidMatch[0] : null;

  let wikidataSitelinks: number | null = null;
  if (qid) {
    await new Promise((r) => setTimeout(r, 200));
    wikidataSitelinks = await fetchWikidataSitelinks(qid);
  }

  const country: string | null = detail?.country || null;
  const areaName: string | null = detail?.area?.name || null;
  const formedYearRaw: string | undefined = detail?.['life-span']?.begin;
  const formedYear = formedYearRaw ? parseInt(formedYearRaw.slice(0, 4), 10) : null;

  // "member of band" relations point from the group to each person —
  // this only appears on group/band artist entities, not solo artists.
  const members: BandMember[] = (detail?.relations || [])
    .filter((r: any) => r.type === 'member of band' && r.artist)
    .map((r: any) => ({
      name: r.artist.name,
      mbid: r.artist.id,
      begin: r.begin || r.period?.begin || null,
      end: r.end || r.period?.end || null,
      current: !r.ended,
    }))
    .slice(0, 20);

  return {
    mbid: candidate.id,
    tags,
    wikidataSitelinks,
    country,
    areaName,
    formedYear: formedYear && !isNaN(formedYear) ? formedYear : null,
    members,
  };
}

/**
 * Returns a Map of artistName -> metadata (tags + fame), backed by a
 * shared, app-wide database cache. `maxLookups` caps how many *uncached*
 * artists get looked up in one call — each is a real network round-trip
 * with a built-in delay to respect MusicBrainz's rate limit, so this keeps
 * a single page load from taking too long on a cold cache. Coverage grows
 * over time as different artists get looked up across different page
 * loads, app-wide.
 */
export async function getArtistMetadata(
  artistNames: string[],
  maxLookups = 5
): Promise<Map<string, ArtistMetadata>> {
  const result = new Map<string, ArtistMetadata>();
  if (artistNames.length === 0) return result;

  const cached = await prisma.artistMetadataCache.findMany({
    where: { artistName: { in: artistNames } },
  });
  const cachedNames = new Set<string>();
  for (const c of cached as {
    artistName: string;
    tags: string[];
    mbid: string | null;
    wikidataSitelinks: number | null;
    country: string | null;
    areaName: string | null;
    formedYear: number | null;
    members: unknown;
  }[]) {
    cachedNames.add(c.artistName);
    result.set(c.artistName, {
      mbid: c.mbid,
      tags: c.tags,
      wikidataSitelinks: c.wikidataSitelinks,
      country: c.country,
      areaName: c.areaName,
      formedYear: c.formedYear,
      members: (c.members as BandMember[]) || [],
    });
  }

  const missing = artistNames.filter((n) => !cachedNames.has(n)).slice(0, maxLookups);

  for (const name of missing) {
    const metadata = await fetchFreshMetadata(name);
    result.set(name, metadata);
    try {
      await prisma.artistMetadataCache.upsert({
        where: { artistName: name },
        update: {
          tags: metadata.tags,
          mbid: metadata.mbid,
          wikidataSitelinks: metadata.wikidataSitelinks,
          country: metadata.country,
          areaName: metadata.areaName,
          formedYear: metadata.formedYear,
          members: metadata.members as any,
          fetchedAt: new Date(),
        },
        create: {
          artistName: name,
          tags: metadata.tags,
          mbid: metadata.mbid,
          wikidataSitelinks: metadata.wikidataSitelinks,
          country: metadata.country,
          areaName: metadata.areaName,
          formedYear: metadata.formedYear,
          members: metadata.members as any,
        },
      });
    } catch {
      // cache write failing shouldn't break the page
    }
    await new Promise((r) => setTimeout(r, 1100)); // ~1 req/sec between distinct artists
  }

  return result;
}

/** Convenience wrapper when only genre tags are needed. */
export async function getCachedArtistTags(
  artistNames: string[],
  maxLookups = 5
): Promise<Map<string, string[]>> {
  const metadata = await getArtistMetadata(artistNames, maxLookups);
  const tagsOnly = new Map<string, string[]>();
  for (const [name, data] of metadata.entries()) tagsOnly.set(name, data.tags);
  return tagsOnly;
}

export function fameLabel(sitelinks: number | null): string {
  if (sitelinks === null) return 'Unknown';
  if (sitelinks === 0) return 'No Wikipedia presence';
  if (sitelinks < 5) return 'Niche';
  if (sitelinks < 15) return 'Recognized';
  if (sitelinks < 40) return 'Well-known';
  return 'Global mainstream';
}

export interface MemberOtherBand {
  name: string;
  begin: string | null;
  end: string | null;
}

/**
 * A specific band member's own "member of band" relationships — i.e.
 * which other bands/groups they've also played in. Done as a lazy,
 * on-demand lookup (called only when someone actually expands a member's
 * bio) rather than eagerly for every member of every artist looked up,
 * since that would multiply the number of throttled MusicBrainz requests
 * per page load.
 */
export async function fetchMemberOtherBands(personMbid: string): Promise<MemberOtherBand[]> {
  const detail = await mbFetch(`/artist/${personMbid}?inc=artist-rels&fmt=json`);
  if (!detail) return [];

  return (detail.relations || [])
    .filter((r: any) => r.type === 'member of band' && r.artist)
    .map((r: any) => ({
      name: r.artist.name,
      begin: r.begin || r.period?.begin || null,
      end: r.end || r.period?.end || null,
    }))
    .slice(0, 15);
}
