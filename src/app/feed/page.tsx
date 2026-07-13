import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TrackRow from '@/components/TrackRow';
import AddFriendForm from '@/components/AddFriendForm';
import CompareTaste from '@/components/CompareTaste';
import PlayActions from '@/components/PlayActions';
import RecommendButton from '@/components/RecommendButton';
import GroupPlaylistSection from '@/components/GroupPlaylistSection';

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect('/');

  const following = await prisma.friendship.findMany({
    where: { followerId: userId },
    include: { followed: true },
  });

  const followedIds = following.map((f: { followedId: string }) => f.followedId);
  const feedUserIds = [userId, ...followedIds];

  const plays = await prisma.play.findMany({
    where: { userId: { in: feedUserIds } },
    orderBy: { playedAt: 'desc' },
    take: 50,
    include: {
      user: { select: { name: true, username: true } },
      reactions: true,
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, username: true } } },
      },
    },
  });

  const friendList = following.map((f: { followed: { username: string; name: string | null } }) => ({
    username: f.followed.username,
    name: f.followed.name || f.followed.username,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display italic text-2xl text-paper">Feed</h1>
        <Link href="/leaderboard" className="text-xs text-muted hover:text-brass transition">
          Group leaderboard →
        </Link>
      </div>

      <div className="mt-5 bg-panel border border-line rounded-lg p-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono mb-3">
          Add a friend
        </p>
        <AddFriendForm />
        {following.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {following.map((f) => (
              <span
                key={f.id}
                className="text-xs font-mono px-2.5 py-1 rounded-full border border-line text-muted"
              >
                @{f.followed.username}
              </span>
            ))}
          </div>
        )}
      </div>

      <CompareTaste friends={friendList} />

      <GroupPlaylistSection />

      <div className="mt-8">
        {plays.length === 0 ? (
          <p className="text-muted text-sm py-8 text-center">
            Nothing here yet — follow a friend or log your first play.
          </p>
        ) : (
          plays.map((p) => (
            <div key={p.id}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <TrackRow
                    trackName={p.trackName}
                    artistName={p.artistName}
                    albumArt={p.albumArt}
                    playedAt={p.playedAt}
                    source={p.source}
                    manualSource={p.manualSource}
                    listenerName={p.userId === userId ? 'You' : p.user.name || p.user.username}
                    profileUsername={p.user.username}
                  />
                </div>
                {p.userId !== userId && friendList.length > 0 && (
                  <RecommendButton
                    friends={friendList}
                    track={{ trackName: p.trackName, artistName: p.artistName, albumArt: p.albumArt, spotifyUri: p.spotifyUri }}
                  />
                )}
              </div>
              <PlayActions
                playId={p.id}
                initialReactionCount={p.reactions.length}
                initialReacted={p.reactions.some((r) => r.userId === userId)}
                initialComments={p.comments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  authorName: c.author.name || c.author.username,
                }))}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
