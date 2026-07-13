import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchDiscogsReleases } from '@/lib/discogs';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q?.trim()) return NextResponse.json({ error: 'q is required' }, { status: 400 });

  if (!process.env.DISCOGS_TOKEN) {
    return NextResponse.json(
      { error: "Discogs isn't configured — add DISCOGS_TOKEN to enable searching.", results: [] },
      { status: 200 }
    );
  }

  const results = await searchDiscogsReleases(q.trim());
  return NextResponse.json({ results });
}
