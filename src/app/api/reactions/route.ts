import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { playId, emoji = '🔥' } = await req.json();
  if (!playId) return NextResponse.json({ error: 'playId is required' }, { status: 400 });

  const existing = await prisma.reaction.findUnique({
    where: { playId_userId: { playId, userId } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ reacted: false });
  }

  await prisma.reaction.create({ data: { playId, userId, emoji } });
  return NextResponse.json({ reacted: true });
}
