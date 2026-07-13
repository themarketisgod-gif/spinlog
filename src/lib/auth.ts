import { NextAuthOptions } from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import { prisma } from './prisma';

const SCOPES = [
  'user-read-email',
  'user-read-recently-played',
  'user-read-currently-playing',
  'user-library-read',
  'user-follow-read',
  'playlist-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-private',
  'streaming', // needed for the Web Playback SDK — playing audio directly in the browser tab
].join(' ');

function slugify(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24) || 'listener';
}

async function uniqueUsername(base: string, excludeUserId?: string) {
  const slug = slugify(base);
  let candidate = slug;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing || existing.id === excludeUserId) return candidate;
    n += 1;
    candidate = `${slug}-${n}`;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: `https://accounts.spotify.com/authorize?scope=${encodeURIComponent(
        SCOPES
      )}`,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const spotifyId = (profile as any).id as string;
        const displayName = (profile as any).display_name || spotifyId;
        const image = (profile as any).images?.[0]?.url ?? null;
        const email = (profile as any).email ?? null;

        let user = await prisma.user.findUnique({ where: { spotifyId } });

        if (!user) {
          const username = await uniqueUsername(displayName);
          user = await prisma.user.create({
            data: {
              spotifyId,
              username,
              name: displayName,
              email,
              image,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              tokenExpires: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              name: displayName,
              image,
              accessToken: account.access_token,
              refreshToken: account.refresh_token ?? user.refreshToken,
              tokenExpires: account.expires_at
                ? new Date(account.expires_at * 1000)
                : user.tokenExpires,
            },
          });
        }

        token.userId = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        (session.user as any).username = token.username as string;
      }
      return session;
    },
  },
};
