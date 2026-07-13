import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, createPlaylistFromTracks } from '@/lib/spotify';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { range } = await req.json().catch(() => ({ range: 'all' }));

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token — try signing out and back in.' }, { status: 400 });
  }

  const plays = await prisma.play.findMany({
    where: { userId, spotifyUri: { not: null } },
    select: { trackName: true, artistName: true, spotifyUri: true, playedAt: true },
  });

  const counts = new Map<string, { uri: string; count: number }>();
  for (const p of plays) {
    if (!p.spotifyUri) continue;
    const key = `${p.trackName}::${p.artistName}`;
    const existing = counts.get(key);
    counts.set(key, { uri: p.spotifyUri, count: (existing?.count || 0) + 1 });
  }

  const topUris = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .map((c) => c.uri);

  if (topUris.length === 0) {
    return NextResponse.json({ error: 'No trackable plays yet to export.' }, { status: 400 });
  }

  const label = range === 'all' ? 'All time' : range;
  const result = await createPlaylistFromTracks(
    accessToken,
    `Spinlog — Top Tracks (${label})`,
    'Generated automatically by Spinlog from your logged plays.',
    topUris
  );

  if (!result) {
    return NextResponse.json({ error: 'Spotify rejected the playlist creation.' }, { status: 500 });
  }

  return NextResponse.json({ playlistUrl: result.playlistUrl });
}
