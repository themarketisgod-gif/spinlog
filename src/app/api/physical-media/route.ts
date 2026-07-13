import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDiscogsRelease } from '@/lib/discogs';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const items = await prisma.physicalMedia.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { tracks: { orderBy: { position: 'asc' } } },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();

  if (body.discogsReleaseId) {
    const detail = await fetchDiscogsRelease(body.discogsReleaseId);
    if (!detail) return NextResponse.json({ error: 'Could not fetch that release from Discogs.' }, { status: 400 });

    const item = await prisma.physicalMedia.create({
      data: {
        userId,
        artistName: detail.artistName,
        releaseTitle: detail.releaseTitle,
        format: detail.format,
        year: detail.year,
        coverArt: detail.coverArt,
        discogsReleaseId: body.discogsReleaseId,
        discogsUrl: detail.discogsUrl,
        source: 'discogs',
        tracks: { create: detail.tracks },
      },
      include: { tracks: true },
    });
    return NextResponse.json({ item });
  }

  const { artistName, releaseTitle, format, year, tracks } = body;
  if (!artistName?.trim() || !releaseTitle?.trim()) {
    return NextResponse.json({ error: 'artistName and releaseTitle are required' }, { status: 400 });
  }

  const item = await prisma.physicalMedia.create({
    data: {
      userId,
      artistName: artistName.trim(),
      releaseTitle: releaseTitle.trim(),
      format: format || 'Other',
      year: year ? parseInt(year, 10) : null,
      source: 'manual',
      tracks: {
        create: (Array.isArray(tracks) ? tracks : [])
          .filter((t: string) => t?.trim())
          .map((t: string, i: number) => ({ trackName: t.trim(), position: i + 1 })),
      },
    },
    include: { tracks: true },
  });

  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await req.json();
  await prisma.physicalMedia.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
