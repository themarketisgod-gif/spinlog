import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { type, label, sublabel, art } = await req.json();
  if (!type || !label) {
    return NextResponse.json({ error: 'type and label are required' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      pinnedType: type,
      pinnedLabel: label,
      pinnedSublabel: sublabel || null,
      pinnedArt: art || null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { pinnedType: null, pinnedLabel: null, pinnedSublabel: null, pinnedArt: null },
  });

  return NextResponse.json({ ok: true });
}
