import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { tab, order } = await req.json();
  if (!tab || !Array.isArray(order)) {
    return NextResponse.json({ error: 'tab and order (array) are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const existing = (user?.layoutPreferences as Record<string, string[]> | null) || {};
  const updated = { ...existing, [tab]: order };

  await prisma.user.update({ where: { id: userId }, data: { layoutPreferences: updated } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { tab } = await req.json();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const existing = (user?.layoutPreferences as Record<string, string[]> | null) || {};
  if (tab) {
    delete existing[tab];
    await prisma.user.update({ where: { id: userId }, data: { layoutPreferences: existing } });
  } else {
    await prisma.user.update({ where: { id: userId }, data: { layoutPreferences: {} } });
  }

  return NextResponse.json({ ok: true });
}
