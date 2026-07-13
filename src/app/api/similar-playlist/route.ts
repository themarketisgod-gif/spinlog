import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, fetchPlaylistTracks } from '@/lib/spotify';
import { getArtistMetadata } from '@/lib/musicbrainz';
import { findSimilarTracks } from '@/lib/community';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { playlistId } = await req.json();
  if (!playlistId) return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token — try signing out and back in.' }, { status: 400 });
  }

  const tracks = await fetchPlaylistTracks(accessToken, playlistId);
  if (tracks.length === 0) {
    return NextResponse.json({ error: 'Could not read tracks from that playlist.' }, { status: 400 });
  }

  const artistNames = [...new Set(tracks.map((t) => t.artistName))];
  // Only use tags already cached — a playlist can have dozens of unique
  // artists, and looking all of them up live would be far too slow given
  // MusicBrainz's rate limit. Coverage improves over time as those artists
  // get looked up elsewhere in the app.
  const metadata = await getArtistMetadata(artistNames, 3);

  const tagCounts = new Map<string, number>();
  for (const name of artistNames) {
    for (const tag of metadata.get(name)?.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const seedTags = [...tagCounts.keys()];

  if (seedTags.length === 0) {
    return NextResponse.json({
      results: [],
      reason: "None of this playlist's artists have genre data cached yet — try again after browsing a few profiles.",
    });
  }

  const results = await findSimilarTracks(seedTags, new Set(artistNames), 10);
  return NextResponse.json({ results, seedTags, artistCount: artistNames.length });
}
