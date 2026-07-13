import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, fetchSavedTracks } from '@/lib/spotify';

// One-time historical import: pulls the signed-in user's Spotify "liked
// songs" library and records each as a Play, timestamped at when it was
// saved to the library (not necessarily when it was last played).
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token' }, { status: 400 });
  }

  const savedTracks = await fetchSavedTracks(accessToken, 500);
  let added = 0;

  for (const t of savedTracks) {
    try {
      await prisma.play.create({
        data: {
          userId,
          trackName: t.trackName,
          artistName: t.artistName,
          albumName: t.albumName,
          albumArt: t.albumArt,
          durationMs: t.durationMs,
          spotifyUri: t.spotifyUri,
          primaryArtistId: t.primaryArtistId,
          releaseYear: t.releaseYear,
          artistNames: t.artistNames,
          source: 'library',
          playedAt: new Date(t.addedAt),
        },
      });
      added += 1;
    } catch {
      // duplicate, ignore
    }
  }

  return NextResponse.json({ added, checked: savedTracks.length });
}
