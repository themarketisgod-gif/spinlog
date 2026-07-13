import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { username } = await req.json();
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: 'No user with that username' }, { status: 404 });
  if (target.id === userId)
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });

  try {
    await prisma.friendship.create({
      data: { followerId: userId, followedId: target.id },
    });
  } catch {
    return NextResponse.json({ error: 'Already following' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { username } = await req.json();
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.friendship.deleteMany({
    where: { followerId: userId, followedId: target.id },
  });

  return NextResponse.json({ ok: true });
}
