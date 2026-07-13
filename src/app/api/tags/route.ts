import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function normalizeTag(raw: string) {
  return raw.trim().toLowerCase().slice(0, 30);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { targetType, artistName, trackName, tag } = await req.json();
  const normalized = normalizeTag(tag || '');
  if (!normalized || !artistName?.trim() || !['artist', 'track'].includes(targetType)) {
    return NextResponse.json({ error: 'targetType, artistName, and tag are required' }, { status: 400 });
  }

  const created = await prisma.tag.upsert({
    where: {
      userId_targetType_artistName_trackName_tag: {
        userId,
        targetType,
        artistName: artistName.trim(),
        trackName: targetType === 'track' ? (trackName || '').trim() : '',
        tag: normalized,
      },
    },
    update: {},
    create: {
      userId,
      targetType,
      artistName: artistName.trim(),
      trackName: targetType === 'track' ? (trackName || '').trim() : '',
      tag: normalized,
    },
  });

  return NextResponse.json({ tag: created });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await req.json();
  await prisma.tag.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
