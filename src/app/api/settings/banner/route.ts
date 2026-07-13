import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_BASE64_LENGTH = 3_000_000; // ~2.2MB of actual image data

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { image } = await req.json();
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'A valid image is required' }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image is too large — try a smaller file (under ~2MB).' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { bannerImage: image } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { bannerImage: null } });
  return NextResponse.json({ ok: true });
}
