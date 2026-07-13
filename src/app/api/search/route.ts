import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, searchTracks } from '@/lib/spotify';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ results: [] });

  const results = await searchTracks(accessToken, q);
  return NextResponse.json({ results });
}
