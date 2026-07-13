const SETLISTFM_API = 'https://api.setlist.fm/rest/1.0';

function headers() {
  return {
    'x-api-key': process.env.SETLISTFM_API_KEY || '',
    Accept: 'application/json',
  };
}

export interface SetlistSearchResult {
  id: string;
  artistName: string;
  venueName: string;
  city: string;
  country: string;
  eventDate: string; // "DD-MM-YYYY" as setlist.fm formats it
  tour: string | null;
  url: string;
  songCount: number;
}

/**
 * Searches setlist.fm for shows by artist name (optionally narrowed by
 * year). setlist.fm's API can only be called server-side — it doesn't
 * allow browser/CORS requests — which is why this always runs through our
 * own API routes, never directly from the client.
 */
export async function searchSetlists(
  artistName: string,
  year?: string
): Promise<SetlistSearchResult[]> {
  if (!process.env.SETLISTFM_API_KEY) return [];

  const params = new URLSearchParams({ artistName, p: '1' });
  if (year) params.set('year', year);

  const res = await fetch(`${SETLISTFM_API}/search/setlists?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.setlist || []).map((s: any) => ({
    id: s.id,
    artistName: s.artist?.name ?? artistName,
    venueName: s.venue?.name ?? '',
    city: s.venue?.city?.name ?? '',
    country: s.venue?.city?.country?.name ?? '',
    eventDate: s.eventDate,
    tour: s.tour?.name ?? null,
    url: s.url,
    songCount: (s.sets?.set || []).reduce((sum: number, set: any) => sum + (set.song?.length || 0), 0),
  }));
}

export interface SetlistSong {
  trackName: string;
  position: number;
  isEncore: boolean;
}

export interface SetlistDetail {
  id: string;
  artistName: string;
  venueName: string;
  city: string;
  eventDate: string;
  url: string;
  songs: SetlistSong[];
}

/** Converts setlist.fm's "DD-MM-YYYY" date format to a real Date. */
export function parseSetlistFmDate(raw: string): Date {
  const [day, month, year] = raw.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export async function fetchSetlistDetail(setlistId: string): Promise<SetlistDetail | null> {
  if (!process.env.SETLISTFM_API_KEY) return null;

  const res = await fetch(`${SETLISTFM_API}/setlist/${setlistId}`, { headers: headers() });
  if (!res.ok) return null;
  const s = await res.json();

  const songs: SetlistSong[] = [];
  let position = 1;
  for (const set of s.sets?.set || []) {
    const isEncore = !!set.encore;
    for (const song of set.song || []) {
      songs.push({ trackName: song.name, position: position++, isEncore });
    }
  }

  return {
    id: s.id,
    artistName: s.artist?.name ?? '',
    venueName: s.venue?.name ?? '',
    city: s.venue?.city?.name ?? '',
    eventDate: s.eventDate,
    url: s.url,
    songs,
  };
}
