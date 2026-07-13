import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_COLORS = ['#C9974B', '#6FA88F', '#C4694B', '#7C93C4', '#B57EDC', '#D4A5A5'];

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { bio, themeColor, timezone, tempUnit, lastfmUsername, factsArtistName } = await req.json();

  const data: {
    bio?: string | null;
    themeColor?: string;
    timezone?: string;
    tempUnit?: string;
    lastfmUsername?: string | null;
    factsArtistName?: string | null;
  } = {};
  if (typeof bio === 'string') data.bio = bio.trim().slice(0, 160) || null;
  if (typeof themeColor === 'string' && ALLOWED_COLORS.includes(themeColor)) {
    data.themeColor = themeColor;
  }
  if (typeof timezone === 'string' && timezone.length < 100) {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone }); // throws if invalid
      data.timezone = timezone;
    } catch {
      // invalid timezone string — ignore rather than error the whole save
    }
  }
  if (tempUnit === 'F' || tempUnit === 'C') data.tempUnit = tempUnit;
  if (typeof lastfmUsername === 'string') data.lastfmUsername = lastfmUsername.trim() || null;
  if (typeof factsArtistName === 'string') data.factsArtistName = factsArtistName.trim() || null;

  const user = await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({
    bio: user.bio,
    themeColor: user.themeColor,
    timezone: user.timezone,
    tempUnit: user.tempUnit,
    lastfmUsername: user.lastfmUsername,
    factsArtistName: user.factsArtistName,
  });
}
