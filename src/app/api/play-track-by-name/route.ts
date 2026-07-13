import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, searchTracks, playTrackUris } from '@/lib/spotify';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { trackName, artistName } = await req.json();
  if (!trackName || !artistName) {
    return NextResponse.json({ error: 'trackName and artistName are required' }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ error: 'No Spotify token' }, { status: 400 });

  const results = await searchTracks(accessToken, `${trackName} ${artistName}`);
  const match = results[0];
  if (!match) {
    return NextResponse.json({ error: `Couldn't find "${trackName}" on Spotify.` }, { status: 404 });
  }

  const result = await playTrackUris(accessToken, [match.spotifyUri]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'No active Spotify device — open Spotify somewhere first.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
