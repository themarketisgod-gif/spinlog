import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, fetchRecentlyPlayed } from '@/lib/spotify';

// Pulls the current user's recently played tracks from Spotify and
// upserts them as Plays. Safe to call often; duplicates are skipped
// via the unique (userId, spotifyUri, playedAt) constraint.
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token' }, { status: 400 });
  }

  let tracks;
  try {
    tracks = await fetchRecentlyPlayed(accessToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Spotify request failed', added: 0, checked: 0 },
      { status: 502 }
    );
  }

  let added = 0;

  for (const t of tracks) {
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
          source: 'spotify',
          playedAt: new Date(t.playedAt),
        },
      });
      added += 1;
    } catch {
      // duplicate play, ignore
    }
  }

  return NextResponse.json({ added, checked: tracks.length });
}
