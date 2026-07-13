import { NextResponse } from 'next/server';
import { fetchMemberOtherBands } from '@/lib/musicbrainz';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mbid = searchParams.get('mbid');
  if (!mbid) return NextResponse.json({ error: 'mbid is required' }, { status: 400 });

  const bands = await fetchMemberOtherBands(mbid);
  return NextResponse.json({ bands });
}
