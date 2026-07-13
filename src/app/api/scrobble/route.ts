import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Manually log a play — either picked from Spotify search results
// (has spotifyUri + albumArt) or typed freehand.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();
  const { trackName, artistName, artistNames, albumName, albumArt, durationMs, spotifyUri, primaryArtistId, releaseYear, manualSource, mood, playedAt } =
    body;

  if (!trackName?.trim() || !artistName?.trim()) {
    return NextResponse.json({ error: 'Track and artist are required' }, { status: 400 });
  }

  const play = await prisma.play.create({
    data: {
      userId,
      trackName: trackName.trim(),
      artistName: artistName.trim(),
      artistNames: Array.isArray(artistNames) ? artistNames : [],
      albumName: albumName?.trim() || null,
      albumArt: albumArt || null,
      durationMs: durationMs || null,
      spotifyUri: spotifyUri || null,
      primaryArtistId: primaryArtistId || null,
      releaseYear: releaseYear || null,
      source: 'manual',
      manualSource: manualSource || null,
      mood: mood || null,
      playedAt: playedAt ? new Date(playedAt) : new Date(),
    },
  });

  return NextResponse.json({ play });
}
