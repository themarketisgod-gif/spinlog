import { prisma } from './prisma';

const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';

/**
 * Returns a valid access token for the given user, refreshing it first
 * if it has expired.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.refreshToken) return null;

  const expiresSoon =
    !user.tokenExpires || user.tokenExpires.getTime() - Date.now() < 60_000;

  if (!expiresSoon && user.accessToken) return user.accessToken;

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(SPOTIFY_ACCOUNTS, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: data.access_token,
      tokenExpires: new Date(Date.now() + data.expires_in * 1000),
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    },
  });

  return data.access_token as string;
}

export interface SpotifyRecentTrack {
  playedAt: string;
  trackName: string;
  artistName: string;
  artistNames: string[];
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  spotifyUri: string;
  primaryArtistId: string | null;
  releaseYear: number | null;
}

export async function fetchRecentlyPlayed(
  accessToken: string
): Promise<SpotifyRecentTrack[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/recently-played?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // Throwing here (rather than silently returning []) lets the /api/sync
    // route tell a real failure (expired token, rate limit, etc.) apart
    // from "genuinely nothing new," instead of both looking identical.
    const body = await res.text().catch(() => '');
    throw new Error(`Spotify recently-played request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    playedAt: item.played_at,
    trackName: item.track.name,
    artistName: item.track.artists.map((a: any) => a.name).join(', '),
    artistNames: item.track.artists.map((a: any) => a.name),
    albumName: item.track.album?.name ?? null,
    albumArt: item.track.album?.images?.[0]?.url ?? null,
    durationMs: item.track.duration_ms,
    spotifyUri: item.track.uri,
    primaryArtistId: item.track.artists?.[0]?.id ?? null,
    releaseYear: parseReleaseYear(item.track.album?.release_date),
  }));
}

function parseReleaseYear(releaseDate: string | undefined | null): number | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

export interface CurrentlyPlaying {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number | null;
  durationMs: number | null;
}

export async function fetchCurrentlyPlaying(
  accessToken: string
): Promise<CurrentlyPlaying | null> {
  const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 204 = nothing currently playing
  if (res.status === 204 || !res.ok) return null;
  const data = await res.json();
  if (!data?.item) return null;

  return {
    trackName: data.item.name,
    artistName: (data.item.artists || []).map((a: any) => a.name).join(', '),
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    isPlaying: !!data.is_playing,
    progressMs: data.progress_ms ?? null,
    durationMs: data.item.duration_ms ?? null,
  };
}

export interface FollowedArtist {
  name: string;
  image: string | null;
  spotifyUrl: string;
}

export async function fetchFollowedArtists(
  accessToken: string,
  limit = 12
): Promise<FollowedArtist[]> {
  const res = await fetch(
    `${SPOTIFY_API}/me/following?type=artist&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.artists?.items || [];
  return items.map((a: any) => ({
    name: a.name,
    image: a.images?.[0]?.url ?? null,
    spotifyUrl: a.external_urls?.spotify ?? '#',
  }));
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  image: string | null;
  spotifyUrl: string;
}

export async function fetchUserPlaylists(
  accessToken: string,
  limit = 12
): Promise<SpotifyPlaylist[]> {
  const res = await fetch(`${SPOTIFY_API}/me/playlists?limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.items || [];
  return items
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      // Spotify renamed this field from "tracks" to "items" inside the
      // playlist object itself in its February 2026 API changes — falling
      // back to the old name too in case a cached/edge response still
      // uses it, rather than silently showing 0 either way.
      trackCount: p.items?.total ?? p.tracks?.total ?? 0,
      image: p.images?.[0]?.url ?? null,
      spotifyUrl: p.external_urls?.spotify ?? '#',
    }));
}

export interface SpotifyTrackResult {
  trackName: string;
  artistName: string;
  artistNames: string[];
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  spotifyUri: string;
  primaryArtistId: string | null;
  releaseYear: number | null;
}

export async function searchTracks(
  accessToken: string,
  query: string
): Promise<SpotifyTrackResult[]> {
  const url = `${SPOTIFY_API}/search?q=${encodeURIComponent(query)}&type=track&limit=8`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.tracks?.items || []).map((track: any) => ({
    trackName: track.name,
    artistName: track.artists.map((a: any) => a.name).join(', '),
    artistNames: track.artists.map((a: any) => a.name),
    albumName: track.album?.name ?? '',
    albumArt: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
    spotifyUri: track.uri,
    primaryArtistId: track.artists?.[0]?.id ?? null,
    releaseYear: parseReleaseYear(track.album?.release_date),
  }));
}

export interface SavedTrack extends SpotifyTrackResult {
  addedAt: string;
}

/**
 * Fetches the user's saved ("liked") tracks, paginating up to `maxTracks`.
 * Used for a one-time historical import rather than ongoing sync.
 */
export async function fetchSavedTracks(
  accessToken: string,
  maxTracks = 500
): Promise<SavedTrack[]> {
  const results: SavedTrack[] = [];
  let offset = 0;
  const pageSize = 50;

  while (results.length < maxTracks) {
    const res = await fetch(
      `${SPOTIFY_API}/me/tracks?limit=${pageSize}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) break;
    const data = await res.json();
    const items = data?.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      const track = item.track;
      if (!track) continue;
      results.push({
        trackName: track.name,
        artistName: track.artists.map((a: any) => a.name).join(', '),
        artistNames: track.artists.map((a: any) => a.name),
        albumName: track.album?.name ?? '',
        albumArt: track.album?.images?.[0]?.url ?? null,
        durationMs: track.duration_ms,
        spotifyUri: track.uri,
        primaryArtistId: track.artists?.[0]?.id ?? null,
        releaseYear: parseReleaseYear(track.album?.release_date),
        addedAt: item.added_at,
      });
    }

    if (!data.next || items.length < pageSize) break;
    offset += pageSize;
  }

  return results.slice(0, maxTracks);
}

/**
 * Fetches genres for a small set of artist IDs. Spotify removed the batch
 * "Get Several Artists" endpoint in Feb 2026, so this calls the single-artist
 * endpoint per ID. Kept to a small cap by the caller — this is meant for a
 * "top genres" summary over a handful of top artists, not a full catalog scan.
 */
export async function fetchArtistGenres(
  accessToken: string,
  artistIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const uniqueIds = [...new Set(artistIds)].slice(0, 15);

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const res = await fetch(`${SPOTIFY_API}/artists/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        result.set(id, data.genres || []);
      } catch {
        // skip this artist on failure
      }
    })
  );

  return result;
}

export interface PlaybackState {
  deviceName: string | null;
  volumePercent: number | null;
  isPlaying: boolean;
  shuffleState: boolean;
  repeatState: string; // "off" | "track" | "context"
}

export async function fetchPlaybackState(accessToken: string): Promise<PlaybackState | null> {
  const res = await fetch(`${SPOTIFY_API}/me/player`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204 || !res.ok) return null;
  const data = await res.json();
  if (!data) return null;

  return {
    deviceName: data.device?.name ?? null,
    volumePercent: data.device?.volume_percent ?? null,
    isPlaying: !!data.is_playing,
    shuffleState: !!data.shuffle_state,
    repeatState: data.repeat_state ?? 'off',
  };
}

export interface QueueTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
}

export async function fetchQueue(accessToken: string): Promise<QueueTrack[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/queue`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.queue || []).slice(0, 5).map((track: any) => ({
    trackName: track.name,
    artistName: (track.artists || []).map((a: any) => a.name).join(', '),
    albumArt: track.album?.images?.[0]?.url ?? null,
  }));
}

/**
 * Sends a playback control command. Requires an active Spotify device (the
 * app open somewhere) — Spotify returns 404 NO_ACTIVE_DEVICE if nothing is
 * currently playing anywhere, which callers should surface as a friendly
 * message rather than a generic error.
 */
export async function controlPlayback(
  accessToken: string,
  action: 'play' | 'pause' | 'next' | 'previous'
): Promise<{ ok: boolean; error?: string }> {
  const method = action === 'next' || action === 'previous' ? 'POST' : 'PUT';
  const res = await fetch(`${SPOTIFY_API}/me/player/${action}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204 || res.ok) return { ok: true };
  if (res.status === 404) return { ok: false, error: 'No active Spotify device — open Spotify somewhere first.' };
  return { ok: false, error: 'Playback command failed.' };
}

export interface SavedAlbum {
  name: string;
  artistName: string;
  image: string | null;
  spotifyUrl: string;
}

export async function fetchSavedAlbums(accessToken: string, limit = 12): Promise<SavedAlbum[]> {
  const res = await fetch(`${SPOTIFY_API}/me/albums?limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    name: item.album.name,
    artistName: (item.album.artists || []).map((a: any) => a.name).join(', '),
    image: item.album.images?.[0]?.url ?? null,
    spotifyUrl: item.album.external_urls?.spotify ?? '#',
  }));
}

/**
 * Creates a real private Spotify playlist in the user's own account and
 * fills it with the given track URIs. Uses POST /me/playlists (the
 * still-supported "for the current user" endpoint — Spotify removed the
 * older "create playlist for a given user id" endpoint in Feb 2026).
 */
export async function createPlaylistFromTracks(
  accessToken: string,
  name: string,
  description: string,
  trackUris: string[]
): Promise<{ playlistUrl: string } | null> {
  const createRes = await fetch(`${SPOTIFY_API}/me/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!createRes.ok) return null;
  const playlist = await createRes.json();

  if (trackUris.length > 0) {
    await fetch(`${SPOTIFY_API}/playlists/${playlist.id}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  return { playlistUrl: playlist.external_urls?.spotify ?? null };
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export async function fetchDevices(accessToken: string): Promise<SpotifyDevice[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/devices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.devices || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    isActive: !!d.is_active,
  }));
}

/**
 * Starts playback of specific track(s) via Spotify Connect. Requires an
 * active or specified device — Spotify returns 404 if nothing is available
 * to play on.
 */
export async function playTrackUris(
  accessToken: string,
  uris: string[],
  deviceId?: string
): Promise<{ ok: boolean; error?: string }> {
  const url = deviceId
    ? `${SPOTIFY_API}/me/player/play?device_id=${deviceId}`
    : `${SPOTIFY_API}/me/player/play`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris }),
  });
  if (res.status === 204 || res.ok) return { ok: true };
  if (res.status === 404) return { ok: false, error: 'No active Spotify device — open Spotify somewhere first.' };
  return { ok: false, error: 'Playback command failed.' };
}

/**
 * Adds tracks to an existing playlist using whichever user's access token
 * is passed in — works for any playlist the token's account can modify
 * (its own playlists, or a collaborative one it has access to).
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<{ ok: boolean }> {
  const res = await fetch(`${SPOTIFY_API}/playlists/${playlistId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: trackUris }),
  });
  return { ok: res.ok };
}

/**
 * Creates a collaborative playlist — other users' own tokens can add to it
 * later via addTracksToPlaylist, as long as they have the playlist ID.
 */
export async function createCollaborativePlaylist(
  accessToken: string,
  name: string,
  description: string
): Promise<{ playlistId: string; playlistUrl: string } | null> {
  const res = await fetch(`${SPOTIFY_API}/me/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, public: false, collaborative: true }),
  });
  if (!res.ok) return null;
  const playlist = await res.json();
  return { playlistId: playlist.id, playlistUrl: playlist.external_urls?.spotify ?? '' };
}

export interface PlaylistTrackInfo {
  trackName: string;
  artistName: string;
  primaryArtistId: string | null;
}

/**
 * Reads the tracks in one of the user's own playlists — used as a seed
 * group for playlist-based recommendations. Reading a playlist's own
 * tracks remains available even after Spotify's Feb 2026 API changes
 * (unlike reading *other users'* playlists, which is no longer possible).
 */
export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<PlaylistTrackInfo[]> {
  const res = await fetch(`${SPOTIFY_API}/playlists/${playlistId}/items?limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || [])
    .filter((item: any) => item.track)
    .map((item: any) => ({
      trackName: item.track.name,
      artistName: (item.track.artists || []).map((a: any) => a.name).join(', '),
      primaryArtistId: item.track.artists?.[0]?.id ?? null,
    }));
}
