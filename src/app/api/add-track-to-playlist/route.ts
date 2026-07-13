import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, searchTracks, addTracksToPlaylist } from '@/lib/spotify';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { trackName, artistName, playlistId } = await req.json();
  if (!trackName || !artistName || !playlistId) {
    return NextResponse.json({ error: 'trackName, artistName, and playlistId are required' }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ error: 'No Spotify token' }, { status: 400 });

  const results = await searchTracks(accessToken, `${trackName} ${artistName}`);
  const match = results[0];
  if (!match) {
    return NextResponse.json({ error: `Couldn't find "${trackName}" on Spotify.` }, { status: 404 });
  }

  const result = await addTracksToPlaylist(accessToken, playlistId, [match.spotifyUri]);
  if (!result.ok) {
    return NextResponse.json({ error: 'Spotify rejected the add — check the playlist is one you own.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, trackName: match.trackName });
}
