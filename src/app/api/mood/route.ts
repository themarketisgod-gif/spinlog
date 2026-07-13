import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_MOODS = ['happy', 'sad', 'hype', 'chill', 'heartbroken', 'angry', 'focus', 'love'];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { playId, mood } = await req.json();
  if (!playId) return NextResponse.json({ error: 'playId is required' }, { status: 400 });
  if (mood !== null && !VALID_MOODS.includes(mood)) {
    return NextResponse.json({ error: 'Invalid mood' }, { status: 400 });
  }

  const result = await prisma.play.updateMany({
    where: { id: playId, userId },
    data: { mood },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Play not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
