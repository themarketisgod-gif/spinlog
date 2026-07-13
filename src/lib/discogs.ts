const DISCOGS_API = 'https://api.discogs.com';
const USER_AGENT = 'Spinlog-ListeningLog/1.0';

function token() {
  return process.env.DISCOGS_TOKEN || '';
}

async function discogsFetch(path: string): Promise<any | null> {
  if (!token()) return null;
  try {
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(`${DISCOGS_API}${path}${separator}token=${token()}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface DiscogsSearchResult {
  releaseId: string;
  title: string;
  year: string | null;
  thumb: string | null;
  format: string | null;
}

export async function searchDiscogsReleases(query: string): Promise<DiscogsSearchResult[]> {
  const data = await discogsFetch(`/database/search?q=${encodeURIComponent(query)}&type=release&per_page=10`);
  if (!data) return [];
  return (data.results || []).map((r: any) => ({
    releaseId: String(r.id),
    title: r.title,
    year: r.year || null,
    thumb: r.thumb || null,
    format: (r.format || [])[0] || null,
  }));
}

export interface DiscogsReleaseDetail {
  artistName: string;
  releaseTitle: string;
  year: number | null;
  coverArt: string | null;
  format: string;
  discogsUrl: string;
  tracks: { trackName: string; position: number }[];
}

export async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsReleaseDetail | null> {
  const data = await discogsFetch(`/releases/${releaseId}`);
  if (!data) return null;

  return {
    artistName: (data.artists || []).map((a: any) => a.name).join(', ') || 'Unknown',
    releaseTitle: data.title,
    year: data.year || null,
    coverArt: data.images?.[0]?.uri || null,
    format: data.formats?.[0]?.name || 'Other',
    discogsUrl: data.uri || `https://www.discogs.com/release/${releaseId}`,
    tracks: (data.tracklist || [])
      .filter((t: any) => t.type_ === 'track')
      .map((t: any, i: number) => ({ trackName: t.title, position: i + 1 })),
  };
}

export interface DiscogsCollectionItem {
  releaseId: string;
  artistName: string;
  releaseTitle: string;
  year: number | null;
  coverArt: string | null;
  format: string;
}

/**
 * Pulls a user's default ("Uncategorized") Discogs folder — which for most
 * people holds their whole collection unless they've organized it into
 * custom folders, in which case only this default folder comes through.
 * Only works if the collection is public (Discogs' default setting).
 */
export async function fetchDiscogsCollection(
  username: string,
  maxItems = 500
): Promise<DiscogsCollectionItem[]> {
  const results: DiscogsCollectionItem[] = [];
  let page = 1;
  const perPage = 100;

  while (results.length < maxItems) {
    const data = await discogsFetch(
      `/users/${encodeURIComponent(username)}/collection/folders/0/releases?per_page=${perPage}&page=${page}`
    );
    if (!data) break;
    const releases = data.releases || [];
    if (releases.length === 0) break;

    for (const r of releases) {
      const info = r.basic_information;
      if (!info) continue;
      results.push({
        releaseId: String(r.id),
        artistName: (info.artists || []).map((a: any) => a.name).join(', ') || 'Unknown',
        releaseTitle: info.title,
        year: info.year || null,
        coverArt: info.thumb || info.cover_image || null,
        format: info.formats?.[0]?.name || 'Other',
      });
    }

    const totalPages = data.pagination?.pages || 1;
    if (page >= totalPages) break;
    page += 1;
  }

  return results.slice(0, maxItems);
}
