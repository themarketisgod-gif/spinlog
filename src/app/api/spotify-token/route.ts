import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken } from '@/lib/spotify';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return NextResponse.json({ error: 'No Spotify token' }, { status: 400 });

  return NextResponse.json({ accessToken });
}
