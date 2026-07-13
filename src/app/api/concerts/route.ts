import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchSetlistDetail, parseSetlistFmDate } from '@/lib/setlistfm';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const concerts = await prisma.concert.findMany({
    where: { userId },
    orderBy: { eventDate: 'desc' },
    include: { songs: { orderBy: { position: 'asc' } } },
  });

  return NextResponse.json({ concerts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();

  // Importing a specific setlist.fm show
  if (body.setlistFmId) {
    const detail = await fetchSetlistDetail(body.setlistFmId);
    if (!detail) return NextResponse.json({ error: 'Could not fetch that setlist.' }, { status: 400 });

    const concert = await prisma.concert.create({
      data: {
        userId,
        artistName: detail.artistName,
        venueName: detail.venueName || null,
        city: detail.city || null,
        eventDate: parseSetlistFmDate(detail.eventDate),
        setlistFmId: detail.id,
        setlistFmUrl: detail.url,
        source: 'setlistfm',
        songs: {
          create: detail.songs.map((s) => ({
            trackName: s.trackName,
            position: s.position,
            isEncore: s.isEncore,
          })),
        },
      },
      include: { songs: true },
    });

    return NextResponse.json({ concert });
  }

  // Manual entry
  const { artistName, venueName, city, eventDate, songs } = body;
  if (!artistName?.trim() || !eventDate) {
    return NextResponse.json({ error: 'artistName and eventDate are required' }, { status: 400 });
  }

  const concert = await prisma.concert.create({
    data: {
      userId,
      artistName: artistName.trim(),
      venueName: venueName?.trim() || null,
      city: city?.trim() || null,
      eventDate: new Date(eventDate),
      source: 'manual',
      songs: {
        create: (Array.isArray(songs) ? songs : [])
          .filter((s: string) => s?.trim())
          .map((s: string, i: number) => ({ trackName: s.trim(), position: i + 1, isEncore: false })),
      },
    },
    include: { songs: true },
  });

  return NextResponse.json({ concert });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await req.json();
  await prisma.concert.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
