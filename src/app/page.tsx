import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import SignInButton from '@/components/SignInButton';

export default async function Home() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as any)?.username;
  if (username) redirect(`/u/${username}`);

  return (
    <div className="pt-12 md:pt-20">
      <p className="font-mono text-xs tracking-widest text-brass uppercase mb-4">
        A03 · 33⅓ RPM
      </p>
      <h1 className="font-display italic text-4xl md:text-6xl leading-[1.05] text-paper max-w-xl">
        Keep the record of what you played, and hear what your friends spun.
      </h1>
      <p className="text-muted mt-5 max-w-md leading-relaxed">
        Spinlog syncs your Spotify plays automatically, or let you log anything by hand —
        vinyl, a show, a song stuck in your head. Every play lands on your profile and in
        your friends&apos; feed.
      </p>
      <div className="mt-8">
        <SignInButton />
      </div>

      <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg">
        <Feature label="Auto-sync" body="Connects to Spotify and pulls your recent plays." />
        <Feature label="Manual log" body="Logged a record on the turntable? Add it by hand." />
        <Feature label="Friend feed" body="Follow friends, see what's spinning in real time." />
      </div>
    </div>
  );
}

function Feature({ label, body }: { label: string; body: string }) {
  return (
    <div className="border-t border-line pt-3">
      <div className="text-sm text-paper font-medium mb-1">{label}</div>
      <div className="text-xs text-muted leading-relaxed">{body}</div>
    </div>
  );
}
