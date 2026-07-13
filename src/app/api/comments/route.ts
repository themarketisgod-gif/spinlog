import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { playId, body } = await req.json();
  if (!playId || !body?.trim()) {
    return NextResponse.json({ error: 'playId and body are required' }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { playId, authorId: userId, body: body.trim().slice(0, 500) },
    include: { author: { select: { name: true, username: true } } },
  });

  return NextResponse.json({ comment });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { commentId } = await req.json();
  await prisma.comment.deleteMany({ where: { id: commentId, authorId: userId } });
  return NextResponse.json({ ok: true });
}
