import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeSleepAnalysis, type StatPlay } from '@/lib/stats';

export const maxDuration = 30;
const MAX_STATS_PLAYS = 8000;

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const plays = await prisma.play.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: MAX_STATS_PLAYS,
    select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
  });

  const analysis = computeSleepAnalysis(plays as StatPlay[], user.timezone);
  if (analysis.allRanges.length === 0) {
    return NextResponse.json({ removed: 0 });
  }

  const result = await prisma.play.deleteMany({
    where: {
      userId,
      OR: analysis.allRanges.map((r) => ({ playedAt: { gte: r.start, lte: r.end } })),
    },
  });

  return NextResponse.json({ removed: result.count });
}
