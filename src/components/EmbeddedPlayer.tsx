'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

type Status = 'loading' | 'ready' | 'not_ready' | 'error' | 'no_premium';

/**
 * Registers this browser tab as a real, selectable Spotify Connect
 * device using the Web Playback SDK — once ready, it shows up in
 * PlaybackWidget's device dropdown automatically, since Spotify treats it
 * as a normal Connect device from the Web API's perspective. Requires
 * Spotify Premium; free-tier accounts get an explicit "requires Premium"
 * message instead of a silent failure.
 */
export default function EmbeddedPlayer() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const tokenRes = await fetch('/api/spotify-token');
      if (!tokenRes.ok) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Could not get a Spotify token — try signing out and back in.');
        }
        return;
      }
      const { accessToken } = await tokenRes.json();

      if (!document.getElementById('spotify-web-playback-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-web-playback-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        if (cancelled) return;
        const player = new window.Spotify.Player({
          name: 'Spinlog (browser)',
          getOAuthToken: (cb: (token: string) => void) => cb(accessToken),
          volume: 0.8,
        });
        playerRef.current = player;

        player.addListener('ready', () => {
          if (!cancelled) {
            setStatus('ready');
            setMessage('Ready — pick "Spinlog (browser)" from the device list above to play here.');
          }
        });
        player.addListener('not_ready', () => {
          if (!cancelled) setStatus('not_ready');
        });
        player.addListener('initialization_error', () => {
          if (!cancelled) {
            setStatus('error');
            setMessage('This browser could not initialize playback.');
          }
        });
        player.addListener('authentication_error', () => {
          if (!cancelled) {
            setStatus('error');
            setMessage('Spotify authentication failed — try signing out and back in.');
          }
        });
        player.addListener('account_error', () => {
          if (!cancelled) {
            setStatus('no_premium');
            setMessage('Playing directly in the browser requires Spotify Premium.');
          }
        });

        player.connect();
      };
    }

    init();
    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
    };
  }, []);

  if (status === 'loading') return null;

  return (
    <p className={`text-xs mt-2 ${status === 'error' || status === 'no_premium' ? 'text-danger' : 'text-signal'}`}>
      {status === 'ready' && '🎧 '}
      {message}
    </p>
  );
}
