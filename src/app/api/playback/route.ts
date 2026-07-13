import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getValidAccessToken,
  fetchPlaybackState,
  fetchQueue,
  fetchDevices,
  controlPlayback,
  playTrackUris,
} from '@/lib/spotify';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ state: null, queue: [], devices: [] });

  const [state, queue, devices] = await Promise.all([
    fetchPlaybackState(accessToken),
    fetchQueue(accessToken),
    fetchDevices(accessToken),
  ]);

  return NextResponse.json({ state, queue, devices });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { action, uri, deviceId } = await req.json();
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ ok: false, error: 'No Spotify token' }, { status: 400 });

  if (action === 'play_uri') {
    if (!uri) return NextResponse.json({ ok: false, error: 'Missing track uri' }, { status: 400 });
    const result = await playTrackUris(accessToken, [uri], deviceId);
    return NextResponse.json(result);
  }

  if (!['play', 'pause', 'next', 'previous'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const result = await controlPlayback(accessToken, action);
  return NextResponse.json(result);
}
