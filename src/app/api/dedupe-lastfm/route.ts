import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

const DEDUPE_TOLERANCE_MS = 2 * 60 * 1000;

// One-time cleanup for duplicates created before the Last.fm importers
// checked against Spotify-synced plays too — finds Last.fm-sourced plays
// that match a non-Last.fm play on the same track within a couple of
// minutes, and removes the Last.fm copy, keeping the original.
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const [lastfmPlays, otherPlays] = await Promise.all([
    prisma.play.findMany({
      where: { userId, source: 'lastfm' },
      select: { id: true, trackName: true, artistName: true, playedAt: true },
    }),
    prisma.play.findMany({
      where: { userId, source: { not: 'lastfm' } },
      select: { trackName: true, artistName: true, playedAt: true },
    }),
  ]);

  const otherByKey = new Map<string, number[]>();
  for (const p of otherPlays as { trackName: string; artistName: string; playedAt: Date }[]) {
    const key = `${p.trackName.toLowerCase()}::${p.artistName.toLowerCase()}`;
    const list = otherByKey.get(key);
    if (list) list.push(p.playedAt.getTime());
    else otherByKey.set(key, [p.playedAt.getTime()]);
  }

  const idsToDelete: string[] = [];
  for (const p of lastfmPlays as { id: string; trackName: string; artistName: string; playedAt: Date }[]) {
    const key = `${p.trackName.toLowerCase()}::${p.artistName.toLowerCase()}`;
    const times = otherByKey.get(key);
    if (!times) continue;
    const t = p.playedAt.getTime();
    if (times.some((existingTime) => Math.abs(existingTime - t) <= DEDUPE_TOLERANCE_MS)) {
      idsToDelete.push(p.id);
    }
  }

  if (idsToDelete.length > 0) {
    await prisma.play.deleteMany({ where: { id: { in: idsToDelete } } });
  }

  return NextResponse.json({ removed: idsToDelete.length, checked: lastfmPlays.length });
}
