# Spinlog

A last.fm-style listening log for you and your friends. Syncs recently played
tracks from Spotify automatically, and lets anyone log a play by hand (vinyl,
a live show, whatever Spotify doesn't know about). Every play shows up on a
personal profile with stats and charts, and in a friends activity feed.

Built with Next.js (App Router), Prisma, PostgreSQL, and NextAuth (Spotify OAuth).

## 1. Create a Spotify app

1. Go to https://developer.spotify.com/dashboard and create an app.
2. Add a Redirect URI:
   - Local dev: `http://127.0.0.1:3000/api/auth/callback/spotify`
     (Spotify now requires HTTPS redirect URIs *except* for loopback
     addresses — `127.0.0.1` works over plain HTTP, but `localhost` no
     longer will. Visit the app at `http://127.0.0.1:3000` in your
     browser too, not `localhost:3000`, so it matches.)
   - Production: `https://your-domain.com/api/auth/callback/spotify`
     (must be HTTPS — Vercel gives you this automatically)
3. Copy the Client ID and Client Secret.

**Current Spotify Developer Mode limits (as of Feb 2026), worth knowing
before you build your friend list:**
- The account that owns the app needs an active Spotify **Premium**
  subscription, or the app stops working.
- Each app is capped at **5 authorized users** total (including you).
  That's fine for a small group, but if you're picturing more than 4
  friends you'll need to apply to Spotify for "extended quota" access,
  which is a heavier approval process aimed at larger/commercial apps.
- Add each friend's Spotify account under **Settings > User Management**
  in the app dashboard — they need to be added there before they can log
  in successfully.
- Spotify no longer returns a user's email address from its API, so the
  `email` field on your account will just be empty — this doesn't affect
  anything in the app, since usernames (not email) are what's used
  everywhere.

## 2. Create a Postgres database

Any Postgres works. The easiest free option is [Neon](https://neon.tech):
create a project, copy the connection string it gives you.

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL="<your Postgres connection string>"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
SPOTIFY_CLIENT_ID="<from step 1>"
SPOTIFY_CLIENT_SECRET="<from step 1>"
```

## 4. Install, migrate, run

```bash
npm install
npm run db:push      # creates tables in your database
npm run dev
```

Visit **http://127.0.0.1:3000** (not `localhost:3000` — see the redirect URI
note above), sign in with Spotify, and you're in.

## 5. Deploy (Vercel)

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env` in the Vercel project
   settings (set `NEXTAUTH_URL` to your production URL).
4. Deploy. Then run `npm run db:push` once locally (pointed at the same
   `DATABASE_URL`) to create tables in production, or add it as a build step.
5. Add the production redirect URI to your Spotify app (step 1).

## ⚠️ Database schema changed again — re-run db:push

This update adds a `Rating` table and two new columns on `Play`
(`releaseYear` for decade breakdowns). Same as last time:

```bash
npm run db:push
```

## ⚠️ New Spotify permissions required — everyone must re-sign-in

This update adds live playback control, which needs new permissions Spotify
didn't ask for before. The code change alone isn't enough — **you and every
friend using the app need to sign out and sign back in** once this is
deployed, so Spotify actually grants the new access. Until they do, the new
features below will silently return empty results (not an error) for that
person specifically.

## ⚠️ Database schema changed again — re-run db:push

This adds a `Tag` table for the new tagging feature.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds an `artistNames` array column on `Play` (for collaboration tracking)
and a `disliked` column on `Rating`.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds a `GroupPlaylist` table for the new shared-playlist feature.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `manualSource` on `Play` and a new `ArtistMetadataCache` table for
MusicBrainz genre lookups.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `wikidataQid` and `wikidataSitelinks` to the MusicBrainz cache table.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `timezone` to `User` and `mood` to `Play`.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `Concert` and `ConcertSong` tables.

```bash
npm run db:push
```

## Optional: set up setlist.fm for concert tracking

The new "Concerts" page can search real setlists from setlist.fm, which is
free for non-commercial use but requires your own API key:

1. Create a free account at https://www.setlist.fm
2. Apply for an API key at https://api.setlist.fm/ (linked from your
   account settings once logged in) — approval isn't always instant
3. Add it to `.env` (locally) and to Vercel's Environment Variables
   (production):
   ```
   SETLISTFM_API_KEY="your-key-here"
   ```

Without this key, setlist search is disabled, but manually entering a
concert (with or without a typed-out setlist) still works fine.

## ⚠️ Database schema changed again — re-run db:push

Adds `locationName`/`locationLat`/`locationLon` to `User` and a new
`WeatherDayCache` table.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `tempUnit` to `User`, and `weatherCode`/`sunrise`/`sunset` to the
weather cache table.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `PhysicalMedia` and `PhysicalMediaTrack` tables.

```bash
npm run db:push
```

## Optional: set up Discogs for the Shelf page

Free, and generated instantly — no approval wait like setlist.fm:

1. Log into (or create) a free Discogs account
2. Go to Settings → Developers → **Generate new token**
3. Add it to `.env` (locally) and Vercel's Environment Variables:
   ```
   DISCOGS_TOKEN="your-token-here"
   ```

Without this, Shelf's search and collection-import don't work, but manual
entry (artist, title, format, tracklist) still does.

## ⚠️ Important: stats are now capped at your most recent 8,000 plays

After importing a large Last.fm history, pages that compute stats over
your *entire* play history (profile, leaderboard, settings pin picker)
could load enough data into memory to crash the page outright on Vercel's
Hobby plan (a genuine out-of-memory kill, not a bug you'd see an error
for — it just hangs). Every play still stays in the database and counts
fully toward Concerts/Shelf tagging and the CSV export; this only limits
how much gets loaded for on-page stats specifically, using your most
recent plays. No action needed — this is just a behavior change worth
knowing about if your top stats look like they're only covering recent
history rather than "all time" after a big import.

## ⚠️ Also fixed: profile page could time out, not just crash

Separately from the memory issue above, the profile page makes several
external calls (MusicBrainz, Wikidata) that are deliberately throttled to
respect their rate limits — when it hit artists that weren't cached yet,
those calls could stack up past the platform's time limit and the page
would just hang with no response. Fixed by: giving the page more time
before it's cut off (`maxDuration`), capping how many uncached lookups
happen per load, and adding a hard 5-second timeout to each individual
external request so one slow response can't block everything else.

## ⚠️ Database schema changed again — re-run db:push

Adds `lastfmUsername` to `User`.

```bash
npm run db:push
```

## ⚠️ Re-authenticate with Spotify after this update

Adding direct in-browser playback required a new OAuth scope
(`streaming`). Existing signed-in users need to **sign out and back in**
once for Spotify to grant the new permission — otherwise the embedded
player will fail silently.

## Optional: set up automatic daily syncing

1. Generate a random string (16+ characters) for `CRON_SECRET`
2. Add it to Vercel's Environment Variables (not `.env` locally — this
   only needs to exist in production, since only Vercel's real cron
   triggers it)
3. Push this update — `vercel.json` registers the daily cron job
   automatically on deploy

Vercel's Hobby plan caps cron jobs at once per day, with imprecise timing
(it can fire any time within the scheduled hour) — so this isn't
real-time syncing, just automatic instead of needing a manual click once
a day. The manual "Sync Spotify" button still works anytime for something
sooner.

## Not built this round: fully custom, drag-and-drop dashboard layout

You asked whether each section could be freely rearranged per user. I
didn't attempt this — it's a genuinely large feature (a saved layout
schema per user, a drag-and-drop library, and careful handling of moving
sections between tabs), and rushing a half-working version felt worse
than being upfront about the scope. What's built instead: more tabs to
reduce how much lives in one place, and every stat linking to where it
actually lives, so navigating still feels organized even without manual
rearranging. Happy to scope the real drag-and-drop version as a focused
follow-up if you still want it.

## ⚠️ Database schema changed again — re-run db:push

Adds `layoutPreferences` to `User` for the new customizable drag-and-drop
layout.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `country`, `areaName`, and `formedYear` to the artist metadata cache
— no new API calls needed, these come from data MusicBrainz was already
returning.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `members` (band member relationships) to the artist metadata cache.

```bash
npm run db:push
```

## ⚠️ Caught and fixed a real regression

While making other changes, found that the Sync button's proper error
reporting (added a while back) had reverted to an older, silent-failure
version — clicking Sync would say "Synced ✓" even if Spotify's API call
failed underneath. Re-applied the fix: real errors now surface instead of
a false "success."

## ⚠️ Database schema changed again — re-run db:push

Adds `note` to `Rating`, for the new per-track notes feature.

```bash
npm run db:push
```

## ⚠️ Database schema changed again — re-run db:push

Adds `factsArtistName` and `bannerImage` to `User`.

```bash
npm run db:push
```

## How it works

- **Auth**: Signing in with Spotify creates your account and stores an
  access/refresh token pair.
- **Auto-sync**: The "Sync Spotify" button on your profile pulls your last 50
  played tracks from Spotify's API and saves any new ones. Duplicates are
  skipped automatically. Wire this to a cron job (e.g. Vercel Cron hitting
  `POST /api/sync` on a schedule, adding a shared secret check) if you want it
  to run without a page visit.
- **Manual logging**: `/log` lets you search Spotify's catalog for metadata,
  or type in a track/artist freehand — both save as a "Play" with
  `source: "manual"`.
- **Now playing**: a live badge on each profile polls Spotify every 20
  seconds and shows a pulsing indicator when that person is actively
  listening. Disappears automatically when playback stops.
- **Liked songs import**: an "Import liked songs" button on your own profile
  pulls up to 500 tracks from your Spotify Likes as a one-time historical
  backfill, timestamped to when each was saved (`source: "library"`) — useful
  for populating your history beyond just the last 50 recently-played tracks.
- **Following on Spotify**: shows the artists you follow on Spotify, fetched
  live (not stored) — separate from "top artists," which is ranked by actual
  play count in this app.
- **Playlists**: shows your own Spotify playlists with track counts, linking
  out to Spotify. Only your own playlists are readable — Spotify no longer
  allows reading other users' playlists via the API.
- **Stats suite** on every profile, filterable by date range (7/30/90 days,
  this year, all time):
  - Top artists, top tracks, and top albums, ranked by play count
  - Total time listened (from tracks with known duration)
  - Taste diversity score (0–100, based on how spread out your listening is
    across artists vs. concentrated on a few)
  - Longest listening streak (consecutive days with at least one play)
  - A 24-hour "listening clock" heatmap and a day-of-week breakdown
  - A 6-month recap of your top artist per month
  - A "new artists discovered per month" chart
- **Group leaderboard** (`/leaderboard`): combined top artists/tracks and
  most-active-listener ranking across you and everyone you follow.
- **Taste compatibility**: on the Feed page, pick a friend to see a
  Jaccard-similarity score between your top artists and theirs, plus which
  artists you share.
- **Top genres**: pulled from Spotify's per-artist genre data for your top
  artists, weighted by play count. (Spotify removed the bulk "get several
  artists" endpoint in Feb 2026, so this fetches genres one artist at a time,
  capped at 15 — fine for a top-genres summary, not meant for bulk analysis.)
- **Badges**: fun, automatically-earned badges based on your stats (streaks,
  play counts, night-owl listening hours, taste diversity, etc.) — purely
  derived from data you already have, no extra permissions needed.
- **Settings** (`/settings`): a short bio, an accent color for your profile
  (applied via a CSS variable, so it re-colors highlights across your whole
  profile page), and a pinned favorite artist/track/album featured at the
  top.
- **Data export**: download your full play history as a CSV from Settings.
- **Shareable recap image**: an auto-generated image (`/api/recap/[username]`)
  with your top 5 artists and total plays — also used as the Open Graph
  preview image when your profile link is shared elsewhere (iMessage,
  Slack, etc. will show a rich card instead of a plain link).
- **Comments & reactions**: react with 🔥 or leave a comment on any play in
  the Feed.
- **Recommendations**: send a friend a track recommendation straight from
  the Feed (🎁 button); it shows up in their "Log a play" page with a
  one-click "Log it" button.
- **Personal ratings**: rate any track 1-5 stars from your own profile's
  recent plays; a "Top rated" section on your profile surfaces your 4-5
  star tracks.
- **By decade**: a chart of your plays grouped by the release decade of the
  music (from Spotify's album release-date data — manually logged tracks
  without that data are simply excluded, not guessed at).
- **Rediscover these**: surfaces tracks you played several times in the
  past but haven't touched in 60+ days — a nudge back to old favorites.
- **On this day**: shows what you were listening to on this exact date in
  previous years. Naturally empty until your history spans more than a
  year.
- **Deep cuts vs. samples**: counts artists you've properly dug into
  (5+ different tracks logged) against ones you've only tried once, plus a
  list of those one-play artists as a prompt to explore further.
- **Live playback control** (your own profile only): shows what device
  you're playing on, volume, shuffle/repeat state, and lets you play/pause/
  skip directly from the site — genuinely controls Spotify in real time.
  Needs an active Spotify device (the app open somewhere); if there isn't
  one, it says so rather than failing silently.
- **Saved albums**: your Spotify album library, shown as a grid.
- **Export to Spotify**: turns your top 30 trackable plays into a real,
  private playlist in your actual Spotify account with one click.
- **Live progress bar**: the "Listening now" badge shows a real-time
  progress bar for the currently playing track, ticking forward between
  polls rather than just showing a static snapshot.
- **Listening sessions**: groups your plays into sessions (a new one starts
  after a 30+ minute gap) and shows total sessions, average tracks per
  session, average length, and your longest session. This is exact, not an
  estimate — it's just clustering your own timestamps.
- **Estimated skip rate**: infers how often you skip tracks by checking
  whether the next play started well before the previous track's known
  duration would have finished. Clearly labeled as an inference — Spotify's
  API has no real skip-tracking data, and no third-party app can get it.
- **Tags**: last.fm-style free-text tagging on any track from your recent
  plays, plus a tag cloud on your profile sized by how often you've used
  each tag.
- **Full library browser** (`/u/[username]/library`): every artist you've
  ever logged, alphabetically, with search and sort by play count or most
  recently played — the classic last.fm "Library" page.
- **Milestones**: which track was your 100th, 500th, 1000th (etc.) all-time
  play.
- **Trending**: for 7/30/90-day ranges, shows whether each top artist moved
  up, down, or is new compared to the equivalent previous period.
- **Collaborations**: tracks recurring artist pairings (e.g. features and
  duets) and which artists show up mainly as a second/third credit rather
  than the lead. Needs the full artist-credit list, which only tracks
  synced or searched from this point forward have — older plays are
  excluded rather than guessed at.
- **Dislike**: a 👎 next to the star rating on your own recent plays, as an
  alternative to rating — mutually exclusive with giving it stars.
- **Recommend to a specific person**: on any friend's profile, a button
  lets you search Spotify's catalog and send them any track directly —
  not just something from their existing feed activity. It shows up as a
  highlighted "Recommended to you" block right on their own profile, not
  just tucked into the log page.
- **Music soulmate**: automatically computed on your own profile — the
  friend with the highest taste-overlap score, using the same compatibility
  math as the Feed's manual comparison tool.
- **The roast**: a deterministic, template-based one-liner about your
  listening habits, built from thresholds over stats you already have. No
  AI call, no external service — just rules like "one artist is 35%+ of
  your plays" or "you skip almost everything."
- **Shuffle my past**: picks a random track from your history and links
  straight to it on Spotify.
- **Device picker + play any track**: the playback widget now lists your
  active Spotify devices and lets you switch between them, and a ▶ button
  next to your top tracks starts that exact track playing via Spotify
  Connect — not just play/pause/skip on whatever's already going.
- **Group playlists**: create a collaborative Spotify playlist from the
  Feed page, and anyone in the group can add tracks to it — each add uses
  that person's own Spotify account (their own stored token), so it's
  genuinely multi-user, not just you adding things on everyone's behalf.
  One Spotify quirk worth knowing: a friend may need to open the playlist's
  Spotify link at least once (so it's in their own library) before the API
  will let their account add to it — if an add fails, that's the first
  thing to try.
- **Build a playlist for a friend**: on any friend's profile, one click
  creates a real playlist *in their own Spotify account* — seeded from
  every track you've recommended them. This only works because the app
  already stores each person's own access token from when they signed in;
  it can never act on an account that hasn't logged in here.
- **Manual source tracking**: when you log a play by hand, you can specify
  where you actually heard it — Apple Music, YouTube Music, Pandora, vinyl,
  or a live show — and that shows up as its own badge everywhere the play
  appears, instead of a generic "logged."
- **Search links on other platforms**: your own recent plays show quick
  "Apple Music" / "YouTube Music" links that search for the track there.
  These are search links, not exact-track deep links — Spotify's own track
  ID is the only one we actually have, since we're not integrated with
  those other services.
- **MusicBrainz genre tags**: genres for your top artists now come from
  Spotify *and* MusicBrainz's free, open database, merged together. This
  matters because Spotify's genre lookup is capped at looking up 15 artists
  at a time — MusicBrainz has no such limit and needs no login at all.
  Results are cached in the database and shared across every user of the
  app, so the same artist is only ever looked up once, keeping well within
  MusicBrainz's request-rate etiquette.
- **Obscure or mainstream?**: two honest signals, shown together rather
  than pretending to be one number. "In your group" is exact — how many
  Spinlog users have logged that artist. "Global fame" is a rough proxy
  from Wikidata: how many Wikipedia language editions have an article on
  the artist. Neither MusicBrainz nor what's left of Spotify's API exposes
  a real popularity/play-count number anymore, so this is the honest
  substitute rather than a fabricated score.
- **Find similar** (on your own top tracks) and **Discover**
  (`/discover`, matching a whole Spotify playlist at once): content-based
  recommendations using MusicBrainz genre tags, matched against tracks
  already logged somewhere in Spinlog — yours or a friend's. This can only
  ever surface things someone in the group has actually played; it can't
  reach into Spotify's full catalog, since the recommendation/related-
  artist endpoints that would allow that were deprecated by Spotify in
  2024. Matches are also limited to artists whose genre tags are already
  cached, to keep results fast rather than triggering a wave of live
  MusicBrainz lookups mid-request — coverage grows automatically as more
  profiles get viewed over time.
- **Dislike, made obvious**: a disliked track now gets an unmissable "🗑️
  Dog Shit" tag wherever it shows up on your own profile, not just a small
  icon — and a 🗑️ "Dog Shit Top 10" leaderboard lists your most recent
  dislikes.
- **5-star glow**: tracks you've rated 5 stars get a warm pulsing glow in
  every list they appear in, so your favorites visually stand out instead
  of blending in.
- **More stats**: average plays per day, longest dry spell (days between
  listening sessions), repeat-listen rate (how often you immediately
  replay the same track — different from skip rate), weekend vs. weekday
  listening split, longest/shortest track played, and a full breakdown of
  where your plays came from (Spotify sync, liked-songs import, or each
  manually-logged platform).
- **Lemming Leaderboard**: the most mainstream tracks from the last 30
  days, ranked by the same Wikidata fame signal used in "Obscure or
  mainstream?" — built for a group where getting caught listening to an
  actual hit is the joke. Comes with a rotating set of roast lines. Only
  includes tracks whose artist has fame data already looked up, so it may
  take a few profile views before it fills in for less-common artists.
- **Three profile tabs**: **Overview** (stats you'd check day-to-day),
  **🤓 Nerd Data** (the deep cuts: sessions, skip rate, decades,
  collaborations, obscurity, monthly recaps, milestones, tag cloud), and
  **🎭 Personality** (badges, the roast, the Lemming Leaderboard, and
  everything below).
- **Listening personality**: a real 4-axis type — Loyalty/Variety,
  Timelessness/Newness, Commonality/Uniqueness, Depth/Breadth — in the
  spirit of Spotify's actual 2022 Wrapped "Listening Personality" feature.
  Built from data this app already has (repeat-listen rate, average
  release year, fame data, diversity score), not a reproduction of
  Spotify's own private algorithm, since that was never public.
- **Timezone setting** (Settings page): without it, times default to UTC.
  Set your real timezone and the "Listening clock" and time-of-day
  personality both become accurate to when you actually listen, not when
  the server thinks you did.
- **Time-of-day archetype**: Night Owl, Early Bird, Daytime Listener,
  Evening Wind-Down, or Late-Night Lurker, based on your timezone-adjusted
  hourly listening pattern.
- **Stuck on repeat**: calls out the single track you've most obviously
  been looping in the last 7 days, with an escalating roast depending on
  how bad it's gotten.
- **Mood tagging**: tag any play with how it felt (happy, sad, hype, chill,
  heartbroken, angry, focus, in love) — either at log time or after the
  fact from your recent plays. The Personality tab shows a breakdown of
  your tagged moods.
- **Concerts** (`/concerts`): log shows you've attended, either by
  searching setlist.fm for the real setlist (needs a free API key you
  apply for yourself — see setup above) or entering one by hand. Any song
  from a logged show gets a "🎤 Seen live" tag automatically, everywhere
  that song shows up in your plays — matched by artist + track name, not
  tied to when you actually logged the concert.
- **Weather & mood** (Personality tab, your own profile only): correlates
  your self-tagged moods against the actual historical weather on the day
  you played each track — e.g. "on rainy days, 40% of your tagged plays
  are 'sad', vs. 12% on dry days." Uses your own mood tags as the
  "how did it feel" signal, since Spotify's audio-feature/valence data was
  deprecated for new apps in 2024 and there's no other honest source for
  that. Weather comes from Open-Meteo (free, no key, no signup, historical
  data back to 1940) — set your city once in Settings to enable this; nothing
  about your location is ever shown to anyone else, even indirectly.
- **10-point ratings**: ratings are now out of 10 instead of 5, with two
  distinct glow tiers on any track shown anywhere — a warm gold pulse for
  a perfect 10/10, a dimmer teal pulse for an 8-9. Note: any ratings you
  already gave under the old 1-5 scale keep their stored number, so a
  track you rated "5" (meaning perfect, out of 5) will now display as
  "5/10" and only get the dimmer glow tier, not the top one — you'd need
  to re-rate it as 10 to get the gold pulse back.
- **"Seen live" links to the concert**: clicking the badge now jumps
  straight to that specific show on your Concerts page, with a brief
  highlight so it's obvious which one matched.
- **Recent plays moved**: now shows immediately under the Overview/Nerd
  Data/Personality tabs, instead of at the bottom of the page.
- **Weather icon + temperature per song** (Recent Plays, your own profile
  only): each play now shows the actual weather that day where you were —
  ☀️/🌙 for clear (sun or moon depending on whether it was day or night
  when you played it), ⛅/☁️ cloudy, 🌧️ rain, ❄️ snow, ⛈️ thunderstorm,
  🌫️ fog — plus the day's high temperature in your chosen unit (Settings
  has an °F/°C toggle). Needs a location set in Settings; without one, this
  just doesn't show rather than erroring.
- **Last.fm imports no longer duplicate Spotify plays**: if Last.fm was
  already scrobbling your Spotify listening (a common setup), importing
  your Last.fm history used to create a second copy of everything our own
  Spotify sync already captured. Both Last.fm importers now check against
  *all* your existing plays, not just past Last.fm imports, with a small
  time tolerance to account for the two services not recording the exact
  same second for one listen. A "Remove duplicate Last.fm plays" button in
  Settings cleans up anything already duplicated from before this fix.
- **Accurate lifetime totals, even for very large histories**: "Total
  plays" and "Unique artists" are now exact counts across your entire
  history, computed with cheap database aggregates rather than the
  memory-capped dataset used for the heavier per-row stats. If your
  history is large enough that those detailed stats (top artists,
  sessions, diversity, decades, and similar) are only covering your most
  recent 8,000 plays rather than everything, the page says so directly
  and shows your true lifetime totals alongside the range-limited numbers.
- **Bedtime** (Personality tab): flags listening sessions that started in
  the evening, ran at least 45 uninterrupted minutes across 5+ tracks, and
  didn't stop until 11pm or later, as "possibly fell asleep to this," then
  estimates your usual bedtime from when those sessions actually stop.
  Clearly labeled as a pattern-based guess, not a fact — leaving music
  running while doing something else late at night looks identical to
  this. (The 11pm-or-later requirement was added after the first version
  was flagging ordinary evening listening that just happened to start
  around 8pm and end at a normal hour.)
- **Delete a play**: any play on your own profile can now be removed
  directly from Spinlog with a confirm step.
- **Direct link to Last.fm**: for plays imported from Last.fm, a "View on
  Last.fm" link jumps straight to that exact track's entry on their site
  — useful since Last.fm's public API has no scrobble-deletion method at
  all (confirmed by checking their docs); deleting a scrobble is only
  possible from their website, one at a time, so this gets you there
  directly instead of hunting through your library manually. Set your
  Last.fm username once in Settings (or it's saved automatically the
  first time you use the live API import) to enable these links.
- **Import from Last.fm, no API key needed**: export your scrobble history
  or loved tracks at mainstream.ghan.nl/export.html (a well-known
  community tool — enter your username, pick a type and CSV/JSON format,
  download), then upload that file directly in Settings. Handles up to
  20,000 rows per file. A live-import option using your own free Last.fm
  API key is also available for anyone who'd rather skip the manual
  export step.
- **Fetch tracklist, retroactively**: on the Shelf page, any item added
  without a tracklist (mainly from a bulk Discogs collection import) now
  has a "Fetch tracklist from Discogs" button, so you can get the real,
  precise tracklist after the fact instead of relying on the looser
  artist-level fallback matching.
- **Shelf** (`/shelf`): catalog vinyl, CDs, and cassettes you actually own
  — search Discogs, import your whole public Discogs collection at once,
  or enter releases by hand. Any track from a release with its full
  tracklist attached gets a "💿 Own it" badge wherever it shows up in your
  plays, linking back to that exact release; a release added without a
  tracklist (including every item from a bulk collection import, which
  doesn't fetch tracklists individually) falls back to tagging the whole
  artist, same logic as concerts without a setlist. Matching also falls
  back through track-title-only and partial-title matching if the exact
  artist+track pairing doesn't line up — this catches real-world cases
  like a skit credited to a "character" instead of the album's main
  artist (common on Eminem albums, for instance), or Discogs' tracklist
  title being slightly shorter than what a streaming platform calls the
  same track.
- **Apple Music/YouTube links removed from Recent Plays** — they're on
  the Track Detail page now instead, so keeping them on every row too was
  just duplication.
- **A quick fact/stat line under each scrobble**: total times you've
  scrobbled that exact track, plus a short fact (formation year/origin,
  or a top genre tag) when it's already cached — computed entirely from
  data the page already loads, so this doesn't add any new API calls or
  slow the page down.
- **Lyrics: not built, on purpose.** I checked the actual Last.fm track
  page you linked — even Last.fm itself doesn't host lyrics inline; it
  just links out to Musixmatch's contribution system. Full song lyrics
  are copyrighted, and reproducing them requires a paid licensing deal
  that no scrappy hobby project has. Instead, added a "Search lyrics →"
  link that jumps straight to a real lyrics search for that exact song.
- **Similar Artists, via Last.fm's real recommendation engine** — a
  second, independent similar-artists source alongside this app's own
  tag-overlap-based "Find similar," on the Artist page.
- **"Featured on"** — every album a track appears on, from your own
  logged data, shown on the Track page.
- **More listen links**: YouTube Music and Apple Music search links added
  alongside the existing Spotify and Last.fm ones on Track pages.
- **Automatic Last.fm syncing**: the daily cron job (see setup above) now
  also syncs your Last.fm loved tracks automatically, alongside Spotify
  plays and likes — same cross-source duplicate protection as the manual
  importers. Just set your Last.fm username in Settings; needs the site
  owner's `LASTFM_API_KEY` to be configured.
- **Musician facts widget**: pick any artist in Settings, and your
  profile shows a rotating fact about them (every 3 minutes) — formation
  year, origin, genre tags, Wikipedia language count, a top track's real
  Last.fm playcount, and your own scrobble count for them. Every fact
  traces back to real structured data, not a fabricated or copied
  biography.
- **Profile banner**: upload your own image in Settings, or leave it
  unset for an auto-generated collage of your top albums' covers —
  similar in spirit to Last.fm's profile header.
- **Bigger, clearer rating stars** with a "Your rating" title, larger
  click targets, and a clearer dislike toggle.
- **Notes**: a free-text notes field per track — lyrics that hit, a
  memory, why you rated it the way you did. Lives on the Track Detail
  page alongside rating and tags.
- **Per-scrobble weather, genuinely accurate to the hour**: each
  individual scrobble on a Track page now shows the actual weather
  (sun/moon/rain/snow icon + real temperature) *at that specific hour* —
  not just the day's high, which is what was shown before. Uses
  Open-Meteo's real hourly historical data. Removed from the main profile
  entirely, since it now lives on Track pages instead — one less thing
  cluttering Recent Plays.
- **Profile decluttered**: rating, dislike, tags, mood, and delete
  controls are no longer inline on every row of Recent Plays — they now
  live entirely on each track's Track Detail page (click any track title
  to get there). Recent Plays just shows the track, artist, and badges.
- **Real scrobble history on Track pages**: every individual play of a
  track is now listed (date, time, source), each with its own mood picker
  and delete button — not just a single aggregate "first/last played."
- **Artist bio, formation, and band members**: Artist pages now show a
  short factual description (formed year, origin, top genres) synthesized
  from our own structured data — deliberately *not* a quoted Wikipedia/
  Last.fm biography, since reproducing that text at length would run into
  real copyright limits. Band members are pure factual MusicBrainz
  relationship data, so those are shown in full, each with a click-to-
  expand for other bands they've played in (fetched lazily, only when
  you actually expand a member, so it doesn't slow down the main page load).
- **"You've scrobbled this" is now a real link** on the tag directory
  page, going straight to your own listening data for that artist.
- **Terminology: "play" → "scrobble" site-wide**, wherever it means a
  logged listen (Total scrobbles, Recent scrobbles, Log a scrobble, etc.).
  Left untouched: anything about actual audio playback control (the ▶
  Play button, Now Playing, Playback widget) — those are a different
  concept and "scrobble" wouldn't make sense there.
- **New Track Detail page**: track titles across the app now link to a
  real Spinlog page (not Spotify) showing your play count, first/last
  played, rating, Last.fm's global playcount, genre tags, and a play
  button — mirroring the Artist page. Spotify and Last.fm links still
  live there, just as secondary links rather than the default click.
- **Play buttons on recommendations**: "Find similar" results and the
  Last.fm "most popular tracks" list on Artist pages now have actual play
  buttons (▶), not just "add to playlist."
- **Genre tags next to played songs**: Recent Plays now shows each
  artist's top genre tags as small clickable pills, reusing data already
  fetched for other features — no extra lookups.
- **Two new stats from MusicBrainz data already being fetched**: "Where
  your top artists are from" (a country/region breakdown) and your
  oldest/newest band by formation year — both come from core MusicBrainz
  artist fields that were already part of every lookup, just unused
  until now.
- **Album art fallback for Artist pages**: Last.fm's CSV/JSON export
  format genuinely has no image data at all — for artists logged that
  way, there was nothing stored locally to show. The Artist page now
  falls back to a quick Spotify search for a usable image when nothing
  local exists.
- **Genre tags are now a real recommendation surface**: every genre tag
  (on the profile's Top Genres and on Artist pages) links to a new tag
  directory page listing every artist Spinlog has cached with that tag —
  built from real MusicBrainz genre data, not an algorithm. Artists
  you've actually logged link to your own listening data for them;
  everyone else links out to discover them.
- **Profile load speed**: merged two separate throttled MusicBrainz/
  Wikidata lookups into one combined call (roughly halving the worst-case
  added latency from cold-cache artists), and combined three previously
  sequential database queries (On This Day, concerts, physical media)
  into the page's existing parallel batch instead of running one after
  another.
- **Playlists showing 0 items — real bug, fixed**: Spotify's February 2026
  changes renamed the `tracks` field to `items` *inside the playlist
  object itself*, not just in endpoint paths. Our code was still reading
  the old field name, which no longer exists, so every playlist silently
  showed a count of zero. Now reads the new field (with a fallback to the
  old name, just in case).
- **Every track and artist is now clickable, everywhere**: On This Day,
  Top Rated, the Dog Shit list, Rediscover, the Lemming Leaderboard,
  Monthly Recap, Collaborations, Milestones, Feed, and the Artist page's
  own top-tracks list — all of these were still plain text before. Track
  titles open a Spotify search; artist names link to their Spinlog Artist
  page.
- **Customizable drag-and-drop layout, actually built this time**: every
  tab (Overview, Nerd Data, History, Personality) now has a "✎ Customize
  layout" toggle — drag sections to reorder them, or use the ↑/↓ buttons
  (works on mobile, where drag alone wouldn't). Saved per user, per tab,
  with a "Reset to default" option.
- **Recent Plays in Feed now link to Spinlog**: artist names in the Feed's
  chronological list now link to each play's actual owner's Spinlog artist
  page, using per-row data instead of a single static link — this was
  simply missing before.
- **"Most popular tracks" via Last.fm, not Spotify**: I checked Spotify's
  own developer docs before building this — their February 2026 API
  changes removed *both* the "Get Artist's Top Tracks" endpoint and the
  track "popularity" field entirely for Development Mode apps, so there's
  no way to pull an official Spotify popularity ranking anymore. Used
  Last.fm's real aggregate playcount/listener data instead — a different
  source, but the same idea. Each track shows whether you've actually
  heard it, with an "+ Playlist" button to add it straight to one of your
  own Spotify playlists.
- **Fixed a real bug**: `fetchPlaylistTracks` was calling Spotify's
  deprecated `/playlists/{id}/tracks` path (renamed to `/items` in the
  same February 2026 changes) — found while researching the above.
- **Two real bugs fixed**: (1) "Artists you've only sampled" and Top
  Artists were grouping multi-artist tracks (e.g. "Nicki Minaj, Drake, Lil
  Wayne, Chris Brown") as one single weird "artist" instead of crediting
  the primary artist — fixed by using Spotify's own ordered artist list.
  (2) "On This Day" was checking only your most recent 8,000 plays, which
  for a large history doesn't reach back a full year — now queries the
  database directly for that exact date across all years, independent of
  that cap.
- **Everything is clickable now**: every artist name and track title
  throughout the app links somewhere real — artist names go to a new
  in-app Artist page (total plays, top tracks by them, first/last played,
  genre tags, "seen live"/"own it" badges, and a direct Spotify link);
  track titles open a Spotify search for that exact song.
- **Configurable list sizes**: Top Artists/Tracks/Albums now has a
  Last.fm-style "Show: 5 / 10 / 25 / 50" toggle instead of being fixed at 5.
- **A new "📜 History" tab**: split out from Nerd Data to keep either tab
  from growing unwieldy — decades, monthly recaps, milestones, tags, and
  "artists you've only sampled" now live here; Nerd Data keeps the more
  analytical stuff (sessions, skip rate, obscurity, collaborations).
- **Play directly from Spinlog**: your browser tab can now register
  itself as a real Spotify Connect device ("Spinlog (browser)") using
  Spotify's Web Playback SDK — pick it from the existing device dropdown
  to play audio right here, no separate Spotify window needed. Requires
  Spotify Premium (Spotify's own restriction, not this app's) and the new
  `streaming` OAuth scope, which existing users need to re-authenticate
  once to grant.
- **Automatic daily sync**: Spotify plays and liked songs can now sync
  once a day on their own via a scheduled job, instead of only when you
  click "Sync Spotify" manually. See setup above — needs a `CRON_SECRET`
  set in Vercel.
- **Dashboard and badges now link somewhere**: the Dashboard's sleep
  cleanup has a "Review →" step before the destructive action, and every
  achievement badge (Century Club, The Archive, Night Owl, etc.) links to
  the actual stat or section it's measuring, jumping to the right tab
  automatically.
- **Browse older scrobbles**: Recent Plays now has real pagination —
  Newer/Older navigation plus a "jump to page" input, so you can actually
  get back to plays from months or years ago instead of only ever seeing
  the most recent 15.
- **More specific genres**: "Top genres" now has a "Show all N genres
  (more specific)" toggle, revealing far more niche/specific tags beyond
  the top 8 shown by default.
- **Dashboard**: a compact action area above the tabs, showing what
  actually needs attention — plays logged during possible sleep sessions
  (with a one-click cleanup), pending recommendations from friends, and
  tracks worth revisiting — or a plain "✓ All clear" when there's nothing
  to do. The main stats and detailed tabs stay clean and separate from
  this.
- **Stats moved back to the top**, above Recent Plays, closer to how
  Last.fm's own profile lays things out. The "detailed stats are sampled"
  notice was also cut down to one line.
- **Liked & loved tracks are now visible**: Spotify liked songs and
  Last.fm loved tracks are dated whenever you originally liked/loved
  them — often not recent — so they were real but invisible, buried
  outside the 15-item Recent Plays window. A dedicated section now shows
  them regardless of how long ago that was.
- **Profile** (`/u/[username]`): total plays, unique artists, a 14-day
  activity chart, top artists/tracks ranked by play count, and a recent
  plays list.
- **Feed** (`/feed`): add friends by username, see everyone's plays merged
  into one chronological list.

**Not included, on purpose:** RateYourMusic integration. RYM has no public
API — their own FAQ says so directly, with a "some day, maybe" note about
one being planned. The only workarounds are unofficial scrapers, and the
most-used one currently doesn't work because RYM added Cloudflare
protection specifically to block that kind of access. Left out rather
than built as something fragile and against their wishes.

**Not included, on purpose:**
- **Apple Music / YouTube Music / Pandora account sync.** YouTube Music has
  no official API for personal listening history. Pandora has no public
  developer API for third-party apps at all. Apple Music does have a real
  API, but it requires a paid Apple Developer account ($99/year) and its
  own separate auth flow — a deliberate decision to make, not something to
  wire in by default.
- **MusicBrainz "similar artists."** MusicBrainz has artist relationship
  data (band members, side projects), but it's discography research data,
  not a taste-similarity algorithm — showing it as "similar artists" would
  be misleading. Left out rather than shipped as something it isn't.

**Not included, on purpose:** mood/tempo/energy analytics. Spotify
deprecated the Audio Features and Audio Analysis endpoints for all new apps
in November 2024 — the same deprecation that killed Related Artists. There
is no first-party way to get this data anymore. Paid third-party services
exist that reverse-engineer similar numbers, but wiring one in means an
extra external API key, a per-track cost, and a dependency outside
Spotify's control — worth doing deliberately, not by default. Let me know
if you want to go that route and I'll help pick one and wire it in.

## Project structure

```
prisma/schema.prisma      User, Play, Friendship models
src/lib/auth.ts           NextAuth + Spotify OAuth config
src/lib/spotify.ts        Spotify API helpers (token refresh, recently played,
                           search, currently-playing, followed artists,
                           playlists, saved-tracks import)
src/lib/stats.ts          All stat calculations (top artists/tracks/albums,
                           listen time, diversity score, streaks, hourly/
                           weekday histograms, monthly recap, discovery rate,
                           taste compatibility)
src/app/api/              sync, scrobble (manual log), search, friends,
                           now-playing/[username], import-liked,
                           compatibility routes
src/app/u/[username]/     profile page (full stats suite)
src/app/feed/             friends feed + taste comparison
src/app/leaderboard/      group leaderboard
src/app/log/              manual logging page
src/components/           shared UI (Nav, TrackRow, TapeCounter, ActivityBars,
                           HourlyHeatmap, WeekdayBars, MonthlyRecapList,
                           RangeSelector, CompareTaste, NowPlayingBadge,
                           ImportLikedButton, FollowedArtistsGrid,
                           PlaylistsGrid, forms)
```

## Notes

- Free tier limits: Neon's free Postgres tier and Vercel's free hosting tier
  are both plenty for a small group of friends.
- Spotify's `recently-played` endpoint only returns the last ~50 tracks, so
  sync periodically (or on each visit) rather than relying on one big
  catch-up sync.
