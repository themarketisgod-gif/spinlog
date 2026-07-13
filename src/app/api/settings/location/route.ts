import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { geocodeCity } from '@/lib/weather';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { city } = await req.json();
  if (!city?.trim()) return NextResponse.json({ error: 'city is required' }, { status: 400 });

  const geocoded = await geocodeCity(city.trim());
  if (!geocoded) {
    return NextResponse.json({ error: "Couldn't find that city — try a different spelling or a bigger nearby city." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { locationName: geocoded.name, locationLat: geocoded.lat, locationLon: geocoded.lon },
  });

  return NextResponse.json({ location: geocoded });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { locationName: null, locationLat: null, locationLon: null },
  });
  return NextResponse.json({ ok: true });
}
