import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchSetlists } from '@/lib/setlistfm';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const artistName = searchParams.get('artistName');
  const year = searchParams.get('year') || undefined;
  if (!artistName?.trim()) {
    return NextResponse.json({ error: 'artistName is required' }, { status: 400 });
  }

  if (!process.env.SETLISTFM_API_KEY) {
    return NextResponse.json(
      { error: 'setlist.fm isn\'t configured — add SETLISTFM_API_KEY to enable searching.', results: [] },
      { status: 200 }
    );
  }

  const results = await searchSetlists(artistName.trim(), year);
  return NextResponse.json({ results });
}
