import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getArtistMetadata } from '@/lib/musicbrainz';
import { findSimilarTracks } from '@/lib/community';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const artistName = searchParams.get('artistName');
  if (!artistName) return NextResponse.json({ error: 'artistName is required' }, { status: 400 });

  const metadata = await getArtistMetadata([artistName], 2);
  const tags = metadata.get(artistName)?.tags || [];

  if (tags.length === 0) {
    return NextResponse.json({ results: [], reason: 'No genre tags found for this artist yet.' });
  }

  const results = await findSimilarTracks(tags, new Set([artistName]), 8);
  return NextResponse.json({ results, seedTags: tags });
}
