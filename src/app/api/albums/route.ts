import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, fetchSavedAlbums } from '@/lib/spotify';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ albums: [] });

  const albums = await fetchSavedAlbums(accessToken);
  return NextResponse.json({ albums });
}
