'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BannerUpload from './BannerUpload';

interface RankedItem {
  key: string;
  label: string;
  sublabel?: string;
  count: number;
  art?: string | null;
}

interface Pin {
  type: string;
  label: string;
  sublabel: string | null;
  art: string | null;
}

const THEME_OPTIONS = [
  { hex: '#C9974B', name: 'Brass' },
  { hex: '#6FA88F', name: 'Sage' },
  { hex: '#C4694B', name: 'Clay' },
  { hex: '#7C93C4', name: 'Denim' },
  { hex: '#B57EDC', name: 'Violet' },
  { hex: '#D4A5A5', name: 'Rose' },
];

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function SettingsForm({
  initialBio,
  initialTheme,
  initialTimezone,
  initialLocationName,
  initialTempUnit,
  initialLastfmUsername,
  initialFactsArtistName,
  hasCustomBanner,
  initialPin,
  candidates,
}: {
  initialBio: string;
  initialTheme: string;
  initialTimezone: string;
  initialLocationName: string | null;
  initialTempUnit: string;
  initialLastfmUsername: string | null;
  initialFactsArtistName: string | null;
  hasCustomBanner: boolean;
  initialPin: Pin | null;
  candidates: { artist: RankedItem[]; track: RankedItem[]; album: RankedItem[] };
}) {
  const [bio, setBio] = useState(initialBio);
  const [theme, setTheme] = useState(initialTheme);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [tempUnit, setTempUnit] = useState(initialTempUnit);
  const [lastfmUsername, setLastfmUsername] = useState(initialLastfmUsername || '');
  const [factsArtistName, setFactsArtistName] = useState(initialFactsArtistName || '');
  const [locationName, setLocationName] = useState(initialLocationName);
  const [cityInput, setCityInput] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [pin, setPin] = useState(initialPin);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function saveLocation() {
    if (!cityInput.trim()) return;
    setLocationSaving(true);
    setLocationError('');
    try {
      const res = await fetch('/api/settings/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocationError(data.error || 'Could not set location');
        return;
      }
      setLocationName(data.location.name);
      setCityInput('');
      router.refresh();
    } finally {
      setLocationSaving(false);
    }
  }

  async function clearLocation() {
    await fetch('/api/settings/location', { method: 'DELETE' });
    setLocationName(null);
    router.refresh();
  }

  async function saveProfile() {
    await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, themeColor: theme, timezone, tempUnit, lastfmUsername, factsArtistName }),
    });
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function pinItem(type: string, item: RankedItem) {
    await fetch('/api/settings/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, label: item.label, sublabel: item.sublabel, art: item.art }),
    });
    setPin({ type, label: item.label, sublabel: item.sublabel || null, art: item.art || null });
    router.refresh();
  }

  async function unpin() {
    await fetch('/api/settings/pin', { method: 'DELETE' });
    setPin(null);
    router.refresh();
  }

  return (
    <div>
      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Bio
        </h2>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 160))}
          placeholder="A line about your taste, your favorite venue, whatever you want."
          rows={2}
          className="w-full mt-3 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass resize-none"
        />
        <p className="text-muted text-xs mt-1">{bio.length}/160</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Accent color
        </h2>
        <div className="flex gap-3 mt-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.hex}
              onClick={() => setTheme(opt.hex)}
              title={opt.name}
              className="w-8 h-8 rounded-full border-2 transition"
              style={{
                backgroundColor: opt.hex,
                borderColor: theme === opt.hex ? '#E7E3D6' : 'transparent',
              }}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Timezone
        </h2>
        <p className="text-muted text-xs mt-3 mb-2">
          Used for your "listening clock" and time-of-day personality — without
          this, times are shown in the server's timezone (UTC), not yours.
        </p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper focus:outline-none focus:border-brass"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Location
        </h2>
        <p className="text-muted text-xs mt-3 mb-2">
          Powers the "weather & mood" correlation on your Personality tab —
          uses your city only to look up historical weather, via the free
          Open-Meteo API. No location is shared with anyone else.
        </p>
        {locationName ? (
          <div className="flex items-center gap-3">
            <span className="text-paper text-sm">{locationName}</span>
            <button onClick={clearLocation} className="text-xs text-muted hover:text-danger transition">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="e.g. Chicago, IL"
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <button
              onClick={saveLocation}
              disabled={locationSaving}
              className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
            >
              {locationSaving ? 'Looking up…' : 'Set'}
            </button>
          </div>
        )}
        {locationError && <p className="text-danger text-xs mt-1.5">{locationError}</p>}

        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-muted">Temperature unit:</span>
          {(['F', 'C'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setTempUnit(u)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                tempUnit === u ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Last.fm username
        </h2>
        <p className="text-muted text-xs mt-3 mb-2 max-w-md">
          Used to link straight to a track's exact entry on Last.fm's own
          site — useful since Last.fm's API doesn't support deleting a
          scrobble; that's only possible from their website, one at a time.
          Also enables automatic daily syncing of your Last.fm loved
          tracks, if the site owner has a Last.fm API key configured.
        </p>
        <input
          value={lastfmUsername}
          onChange={(e) => setLastfmUsername(e.target.value)}
          placeholder="Your Last.fm username"
          className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Musician facts
        </h2>
        <p className="text-muted text-xs mt-3 mb-2 max-w-md">
          Pick an artist to see rotating facts about on your profile —
          formation year, origin, genre tags, and real scrobble counts from
          MusicBrainz and Last.fm, not a made-up biography.
        </p>
        <input
          value={factsArtistName}
          onChange={(e) => setFactsArtistName(e.target.value)}
          placeholder="e.g. Radiohead"
          className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Profile banner
        </h2>
        <div className="mt-3">
          <BannerUpload hasCustomBanner={hasCustomBanner} />
        </div>
      </section>

      <button
        onClick={saveProfile}
        className="mt-6 text-xs px-4 py-2 rounded-full bg-brass text-ink font-medium hover:brightness-110 transition"
      >
        {saved ? 'Saved ✓' : 'Save changes'}
      </button>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Pinned favorite
        </h2>
        {pin ? (
          <div className="flex items-center gap-3 mt-3">
            <div className="min-w-0">
              <div className="text-paper text-sm">{pin.label}</div>
              {pin.sublabel && <div className="text-muted text-xs">{pin.sublabel}</div>}
            </div>
            <button onClick={unpin} className="text-xs text-muted hover:text-danger transition">
              Unpin
            </button>
          </div>
        ) : (
          <p className="text-muted text-xs mt-3">
            Nothing pinned yet — pick one below to feature it at the top of your profile.
          </p>
        )}

        <div className="grid sm:grid-cols-3 gap-6 mt-5">
          <PinCandidates title="Artists" type="artist" items={candidates.artist} onPin={pinItem} />
          <PinCandidates title="Tracks" type="track" items={candidates.track} onPin={pinItem} />
          <PinCandidates title="Albums" type="album" items={candidates.album} onPin={pinItem} />
        </div>
      </section>
    </div>
  );
}

function PinCandidates({
  title,
  type,
  items,
  onPin,
}: {
  title: string;
  type: string;
  items: RankedItem[];
  onPin: (type: string, item: RankedItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onPin(type, item)}
            className="block w-full text-left text-xs text-paper hover:text-brass truncate transition"
          >
            📌 {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
