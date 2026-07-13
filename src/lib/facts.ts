import { getArtistMetadata } from './musicbrainz';
import { fetchArtistTopTracksFromLastfm } from './lastfm';
import { prisma } from './prisma';

/**
 * Builds a set of real, factual statements about an artist from data
 * already available in this app — MusicBrainz (formation, origin, genre
 * tags, member count), Last.fm (a top track's real global playcount), and
 * the user's own scrobble history. Deliberately not a fabricated or
 * copied biography — every fact here traces back to structured data, not
 * quoted prose.
 */
export async function buildArtistFacts(artistName: string, userId: string): Promise<string[]> {
  const facts: string[] = [];

  const [metadata, lastfmTopTracks, userScrobbleCount] = await Promise.all([
    getArtistMetadata([artistName], 1).then((m) => m.get(artistName)),
    fetchArtistTopTracksFromLastfm(artistName, 1),
    prisma.play.count({
      where: {
        userId,
        OR: [{ artistName }, { artistNames: { has: artistName } }],
      },
    }),
  ]);

  if (metadata?.formedYear && metadata?.areaName) {
    facts.push(`${artistName} formed in ${metadata.formedYear} in ${metadata.areaName}.`);
  } else if (metadata?.formedYear) {
    facts.push(`${artistName} formed in ${metadata.formedYear}.`);
  } else if (metadata?.areaName) {
    facts.push(`${artistName} is from ${metadata.areaName}.`);
  }

  if (metadata?.tags && metadata.tags.length > 0) {
    facts.push(`${artistName} is tagged as ${metadata.tags.slice(0, 3).join(', ')} on MusicBrainz.`);
  }

  if (metadata?.wikidataSitelinks) {
    facts.push(`${artistName} has a Wikipedia article in ${metadata.wikidataSitelinks} different languages.`);
  }

  if (metadata?.members && metadata.members.length > 0) {
    facts.push(`${artistName} has ${metadata.members.length} band member${metadata.members.length !== 1 ? 's' : ''} on file with MusicBrainz.`);
  }

  if (lastfmTopTracks[0] && lastfmTopTracks[0].playcount > 0) {
    facts.push(
      `${artistName}'s most popular track, "${lastfmTopTracks[0].trackName}," has been scrobbled ${lastfmTopTracks[0].playcount.toLocaleString()} times on Last.fm.`
    );
  }

  if (userScrobbleCount > 0) {
    facts.push(`You've personally scrobbled ${artistName} ${userScrobbleCount.toLocaleString()} time${userScrobbleCount !== 1 ? 's' : ''}.`);
  }

  if (facts.length === 0) {
    facts.push(`No facts on file yet for ${artistName} — MusicBrainz and Last.fm may not have much data for them.`);
  }

  return facts;
}
