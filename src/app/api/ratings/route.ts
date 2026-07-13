import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { trackName, artistName, albumArt, rating, disliked } = await req.json();
  if (!trackName?.trim() || !artistName?.trim()) {
    return NextResponse.json({ error: 'trackName and artistName are required' }, { status: 400 });
  }
  if (rating !== undefined && (rating < 0 || rating > 10)) {
    return NextResponse.json({ error: 'rating must be 0-10' }, { status: 400 });
  }

  // Rating and dislike are mutually exclusive on the same track.
  const data =
    disliked === true
      ? { disliked: true, rating: 0, albumArt: albumArt || null }
      : { rating: rating ?? 0, disliked: false, albumArt: albumArt || null };

  const saved = await prisma.rating.upsert({
    where: { userId_trackName_artistName: { userId, trackName, artistName } },
    update: data,
    create: { userId, trackName, artistName, ...data },
  });

  return NextResponse.json({ rating: saved });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { trackName, artistName, albumArt, note } = await req.json();
  if (!trackName?.trim() || !artistName?.trim()) {
    return NextResponse.json({ error: 'trackName and artistName are required' }, { status: 400 });
  }

  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) || null : null;

  const saved = await prisma.rating.upsert({
    where: { userId_trackName_artistName: { userId, trackName, artistName } },
    update: { note: trimmedNote },
    create: { userId, trackName, artistName, note: trimmedNote, albumArt: albumArt || null },
  });

  return NextResponse.json({ rating: saved });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { trackName, artistName } = await req.json();
  await prisma.rating.deleteMany({ where: { userId, trackName, artistName } });
  return NextResponse.json({ ok: true });
}
