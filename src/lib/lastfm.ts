const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

function apiKey() {
  return process.env.LASTFM_API_KEY || '';
}

async function lastfmFetch(params: Record<string, string>): Promise<any | null> {
  const url = new URL(LASTFM_API);
  url.search = new URLSearchParams({ ...params, api_key: apiKey(), format: 'json' }).toString();
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export interface LastfmScrobble {
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumArt: string | null;
  playedAt: Date;
}

/**
 * Pulls scrobble history for a public Last.fm username — no OAuth needed,
 * since scrobble history is public by default on Last.fm. Paginated;
 * capped by the caller to keep a single import request fast.
 */
export async function fetchRecentTracks(
  username: string,
  maxTracks = 1000
): Promise<LastfmScrobble[]> {
  const results: LastfmScrobble[] = [];
  const limit = 200;
  let page = 1;

  while (results.length < maxTracks) {
    const data = await lastfmFetch({
      method: 'user.getrecenttracks',
      user: username,
      limit: String(limit),
      page: String(page),
    });
    const tracks = data?.recenttracks?.track;
    if (!tracks || tracks.length === 0) break;

    for (const t of Array.isArray(tracks) ? tracks : [tracks]) {
      // The currently-playing track has no date field and isn't a
      // completed play — skip it.
      if (!t.date?.uts) continue;
      results.push({
        trackName: t.name,
        artistName: t.artist?.['#text'] || t.artist?.name || '',
        albumName: t.album?.['#text'] || null,
        albumArt: t.image?.find((i: any) => i.size === 'extralarge')?.['#text'] || null,
        playedAt: new Date(parseInt(t.date.uts, 10) * 1000),
      });
    }

    const totalPages = parseInt(data?.recenttracks?.['@attr']?.totalPages || '1', 10);
    if (page >= totalPages) break;
    page += 1;
  }

  return results.slice(0, maxTracks);
}

export interface LastfmLovedTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  lovedAt: Date;
}

export async function fetchLovedTracks(
  username: string,
  maxTracks = 1000
): Promise<LastfmLovedTrack[]> {
  const results: LastfmLovedTrack[] = [];
  const limit = 200;
  let page = 1;

  while (results.length < maxTracks) {
    const data = await lastfmFetch({
      method: 'user.getlovedtracks',
      user: username,
      limit: String(limit),
      page: String(page),
    });
    const tracks = data?.lovedtracks?.track;
    if (!tracks || tracks.length === 0) break;

    for (const t of Array.isArray(tracks) ? tracks : [tracks]) {
      results.push({
        trackName: t.name,
        artistName: t.artist?.name || '',
        albumArt: t.image?.find((i: any) => i.size === 'extralarge')?.['#text'] || null,
        lovedAt: t.date?.uts ? new Date(parseInt(t.date.uts, 10) * 1000) : new Date(),
      });
    }

    const totalPages = parseInt(data?.lovedtracks?.['@attr']?.totalPages || '1', 10);
    if (page >= totalPages) break;
    page += 1;
  }

  return results.slice(0, maxTracks);
}

export interface LastfmTopTrack {
  trackName: string;
  playcount: number;
  listeners: number;
  url: string;
}

/**
 * The artist's most popular tracks, by Last.fm's own aggregate global
 * scrobble data. This exists specifically because Spotify removed both
 * its "Get Artist's Top Tracks" endpoint AND the track "popularity" field
 * in its February 2026 API changes — there's no way to get an official
 * Spotify popularity ranking anymore for a Development Mode app. Last.fm's
 * real playcount/listener totals are a genuine (if different-source)
 * substitute for "what are this artist's most popular songs."
 */
export async function fetchArtistTopTracksFromLastfm(
  artistName: string,
  limit = 15
): Promise<LastfmTopTrack[]> {
  if (!apiKey()) return [];
  try {
    const params = new URLSearchParams({
      method: 'artist.gettoptracks',
      artist: artistName,
      api_key: apiKey(),
      format: 'json',
      limit: String(limit),
    });
    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const tracks = data.toptracks?.track;
    if (!tracks) return [];

    return tracks.map((t: any) => ({
      trackName: t.name,
      playcount: parseInt(t.playcount || '0', 10),
      listeners: parseInt(t.listeners || '0', 10),
      url: t.url,
    }));
  } catch {
    return [];
  }
}

export interface LastfmTrackInfo {
  playcount: number;
  listeners: number;
  tags: string[];
  url: string;
}

/** A specific track's own global playcount/listener stats and tags, via Last.fm's track.getInfo. */
export async function fetchTrackInfoFromLastfm(
  trackName: string,
  artistName: string
): Promise<LastfmTrackInfo | null> {
  if (!apiKey()) return null;
  try {
    const params = new URLSearchParams({
      method: 'track.getinfo',
      track: trackName,
      artist: artistName,
      api_key: apiKey(),
      format: 'json',
    });
    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const track = data.track;
    if (!track) return null;

    return {
      playcount: parseInt(track.playcount || '0', 10),
      listeners: parseInt(track.listeners || '0', 10),
      tags: (track.toptags?.tag || []).map((t: any) => t.name),
      url: track.url,
    };
  } catch {
    return null;
  }
}

export interface LastfmSimilarArtist {
  name: string;
  match: number; // 0-1 similarity score, as Last.fm reports it
}

/** Last.fm's own "Similar Artists" — a real recommendation engine, distinct
 * from this app's own tag-overlap-based "Find similar" feature. */
export async function fetchSimilarArtistsFromLastfm(
  artistName: string,
  limit = 8
): Promise<LastfmSimilarArtist[]> {
  if (!apiKey()) return [];
  try {
    const params = new URLSearchParams({
      method: 'artist.getsimilar',
      artist: artistName,
      api_key: apiKey(),
      format: 'json',
      limit: String(limit),
    });
    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const artists = data.similarartists?.artist;
    if (!artists) return [];

    return artists.map((a: any) => ({
      name: a.name,
      match: parseFloat(a.match || '0'),
    }));
  } catch {
    return [];
  }
}
