import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeCompatibility, type StatPlay } from '@/lib/stats';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id;
  if (!viewerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const withUsername = searchParams.get('with');
  if (!withUsername) return NextResponse.json({ error: 'Missing "with" param' }, { status: 400 });

  const other = await prisma.user.findUnique({ where: { username: withUsername } });
  if (!other) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const [playsA, playsB] = await Promise.all([
    prisma.play.findMany({
      where: { userId: viewerId },
      select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
    }),
    prisma.play.findMany({
      where: { userId: other.id },
      select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
    }),
  ]);

  const { score, sharedArtists } = computeCompatibility(
    playsA as StatPlay[],
    playsB as StatPlay[]
  );

  return NextResponse.json({ score, sharedArtists, otherName: other.name || other.username });
}
