export interface ParsedLastfmRow {
  trackName: string;
  artistName: string;
  albumName: string | null;
  playedAt: Date;
}

/**
 * A minimal CSV row splitter that respects double-quoted fields containing
 * commas — good enough for the well-behaved exports this is built for,
 * without pulling in a CSV parsing library for one narrow use case.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parses the CSV format produced by https://mainstream.ghan.nl/export.html
 * (and the compatible "lastfm-to-csv" family of tools other people link
 * to) — columns are typically `uts, utc_time, artist, artist_mbid, album,
 * album_mbid, track, track_mbid` for scrobbles, with the album columns
 * dropped for loved tracks. Column order and exact presence are handled
 * flexibly by name rather than assumed position, since different export
 * tools order things slightly differently.
 */
export function parseLastfmCsv(content: string): ParsedLastfmRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const tsIdx = findColumn(header, ['uts', 'timestamp', 'date']);
  const artistIdx = findColumn(header, ['artist']);
  const trackIdx = findColumn(header, ['track', 'name', 'trackname']);
  const albumIdx = findColumn(header, ['album', 'albumname']);

  if (artistIdx === -1 || trackIdx === -1) return [];

  const rows: ParsedLastfmRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const artistName = fields[artistIdx]?.trim();
    const trackName = fields[trackIdx]?.trim();
    if (!artistName || !trackName) continue;

    let playedAt: Date;
    if (tsIdx !== -1 && fields[tsIdx]) {
      const raw = fields[tsIdx].trim();
      playedAt = /^\d+$/.test(raw) ? new Date(parseInt(raw, 10) * 1000) : new Date(raw);
    } else {
      continue;
    }
    if (isNaN(playedAt.getTime())) continue;

    rows.push({
      trackName,
      artistName,
      albumName: albumIdx !== -1 ? fields[albumIdx]?.trim() || null : null,
      playedAt,
    });
  }
  return rows;
}

/**
 * Parses the JSON export from the same tool. Handles both a flattened
 * shape (uts/artist/track/album as plain strings) and the raw Last.fm API
 * shape it's sometimes built from (artist: {"#text": ...}, date: {uts}).
 */
export function parseLastfmJson(content: string): ParsedLastfmRow[] {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }

  const items: any[] = Array.isArray(data) ? data : data?.track || data?.tracks || [];
  if (!Array.isArray(items)) return [];

  const rows: ParsedLastfmRow[] = [];
  for (const item of items) {
    const artistName =
      typeof item.artist === 'string' ? item.artist : item.artist?.['#text'] || item.artist?.name;
    const trackName = item.track || item.name || item.trackName;
    if (!artistName || !trackName) continue;

    const albumName =
      typeof item.album === 'string' ? item.album : item.album?.['#text'] || null;

    const rawTs = item.uts ?? item.timestamp ?? item.date?.uts;
    if (!rawTs) continue;
    const playedAt = new Date(parseInt(String(rawTs), 10) * 1000);
    if (isNaN(playedAt.getTime())) continue;

    rows.push({ trackName, artistName, albumName: albumName || null, playedAt });
  }
  return rows;
}

export function parseLastfmExport(content: string): ParsedLastfmRow[] {
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseLastfmJson(trimmed);
  }
  return parseLastfmCsv(trimmed);
}
