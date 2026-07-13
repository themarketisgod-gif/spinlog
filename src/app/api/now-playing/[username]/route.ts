import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, fetchCurrentlyPlaying } from '@/lib/spotify';

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) return NextResponse.json({ nowPlaying: null });

  const nowPlaying = await fetchCurrentlyPlaying(accessToken);
  return NextResponse.json({ nowPlaying });
}
