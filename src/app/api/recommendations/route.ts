import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const recs = await prisma.recommendation.findMany({
    where: { toUserId: userId, loggedAt: null, dismissedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { fromUser: { select: { name: true, username: true } } },
  });

  return NextResponse.json({ recommendations: recs });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { toUsername, trackName, artistName, albumArt, spotifyUri, message } = await req.json();
  const toUser = await prisma.user.findUnique({ where: { username: toUsername } });
  if (!toUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!trackName?.trim() || !artistName?.trim()) {
    return NextResponse.json({ error: 'Track and artist are required' }, { status: 400 });
  }

  const rec = await prisma.recommendation.create({
    data: {
      fromUserId: userId,
      toUserId: toUser.id,
      trackName: trackName.trim(),
      artistName: artistName.trim(),
      albumArt: albumArt || null,
      spotifyUri: spotifyUri || null,
      message: message?.trim().slice(0, 200) || null,
    },
  });

  return NextResponse.json({ recommendation: rec });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id, action } = await req.json();
  const rec = await prisma.recommendation.findUnique({ where: { id } });
  if (!rec || rec.toUserId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (action === 'dismiss') {
    await prisma.recommendation.update({ where: { id }, data: { dismissedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'log') {
    await prisma.$transaction([
      prisma.play.create({
        data: {
          userId,
          trackName: rec.trackName,
          artistName: rec.artistName,
          albumArt: rec.albumArt,
          spotifyUri: rec.spotifyUri,
          source: 'manual',
          playedAt: new Date(),
        },
      }),
      prisma.recommendation.update({ where: { id }, data: { loggedAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
