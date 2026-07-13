import { prisma } from './prisma';

const GEOCODE_API = 'https://geocoding-api.open-meteo.com/v1/search';
const ARCHIVE_API = 'https://archive-api.open-meteo.com/v1/archive';

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
}

/** Turns a typed city name into coordinates. Free, no key, no signup. */
export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(`${GEOCODE_API}?name=${encodeURIComponent(query)}&count=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.results?.[0];
    if (!first) return null;
    return {
      name: [first.name, first.admin1, first.country].filter(Boolean).join(', '),
      lat: first.latitude,
      lon: first.longitude,
    };
  } catch {
    return null;
  }
}

export interface WeatherDay {
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  sunrise: string | null;
  sunset: string | null;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Returns a Map of "YYYY-MM-DD" -> weather for every day in [startDate,
 * endDate], backed by a shared cache. A multi-year range comes back from
 * Open-Meteo in a single fast call, so this just fetches whatever's
 * missing from the cache rather than needing to throttle per-day lookups.
 */
export async function getWeatherRange(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Map<string, WeatherDay>> {
  const rLat = round(lat);
  const rLon = round(lon);
  const result = new Map<string, WeatherDay>();

  const cached = await prisma.weatherDayCache.findMany({
    where: { lat: rLat, lon: rLon, date: { gte: startDate, lte: endDate } },
  });
  for (const c of cached as {
    date: string;
    tempMaxC: number | null;
    tempMinC: number | null;
    precipitationMm: number | null;
    weatherCode: number | null;
    sunrise: string | null;
    sunset: string | null;
  }[]) {
    result.set(c.date, {
      tempMaxC: c.tempMaxC,
      tempMinC: c.tempMinC,
      precipitationMm: c.precipitationMm,
      weatherCode: c.weatherCode,
      sunrise: c.sunrise,
      sunset: c.sunset,
    });
  }

  const allDates: string[] = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    allDates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  const missing = allDates.filter((d) => !result.has(d));
  if (missing.length === 0) return result;

  try {
    const params = new URLSearchParams({
      latitude: String(rLat),
      longitude: String(rLon),
      start_date: missing[0],
      end_date: missing[missing.length - 1],
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,sunrise,sunset',
      timezone: 'auto',
    });
    const res = await fetch(`${ARCHIVE_API}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return result;
    const data = await res.json();

    const dates: string[] = data.daily?.time || [];
    const tempMax: number[] = data.daily?.temperature_2m_max || [];
    const tempMin: number[] = data.daily?.temperature_2m_min || [];
    const precip: number[] = data.daily?.precipitation_sum || [];
    const codes: number[] = data.daily?.weathercode || [];
    const sunrises: string[] = data.daily?.sunrise || [];
    const sunsets: string[] = data.daily?.sunset || [];

    const rows: {
      lat: number;
      lon: number;
      date: string;
      tempMaxC: number | null;
      tempMinC: number | null;
      precipitationMm: number | null;
      weatherCode: number | null;
      sunrise: string | null;
      sunset: string | null;
    }[] = [];

    for (let i = 0; i < dates.length; i++) {
      const day: WeatherDay = {
        tempMaxC: tempMax[i] ?? null,
        tempMinC: tempMin[i] ?? null,
        precipitationMm: precip[i] ?? null,
        weatherCode: codes[i] ?? null,
        sunrise: sunrises[i] ?? null,
        sunset: sunsets[i] ?? null,
      };
      result.set(dates[i], day);
      rows.push({ lat: rLat, lon: rLon, date: dates[i], ...day });
    }

    for (const row of rows) {
      try {
        await prisma.weatherDayCache.upsert({
          where: { lat_lon_date: { lat: row.lat, lon: row.lon, date: row.date } },
          update: row,
          create: row,
        });
      } catch {
        // ignore individual cache-write failures
      }
    }
  } catch {
    // network failure — return whatever was already cached
  }

  return result;
}

export type WeatherBucket = 'rainy' | 'dry';
export type TempBucket = 'hot' | 'mild' | 'cold';

export function bucketWeather(day: WeatherDay): { rain: WeatherBucket; temp: TempBucket } {
  const rain: WeatherBucket = (day.precipitationMm ?? 0) >= 1 ? 'rainy' : 'dry';
  const tempC = day.tempMaxC;
  const temp: TempBucket = tempC === null ? 'mild' : tempC >= 27 ? 'hot' : tempC <= 10 ? 'cold' : 'mild';
  return { rain, temp };
}

/** Whether a given moment falls between that day's sunrise and sunset. */
export function isDaytime(at: Date, sunrise: string | null, sunset: string | null): boolean | null {
  if (!sunrise || !sunset) return null;
  const sunriseTime = new Date(sunrise).getTime();
  const sunsetTime = new Date(sunset).getTime();
  const t = at.getTime();
  return t >= sunriseTime && t <= sunsetTime;
}

/**
 * Maps a WMO weather code (what Open-Meteo returns) plus day/night to a
 * single representative emoji. Grouped into the handful of categories that
 * are visually distinguishable rather than all ~30 individual WMO codes.
 */
export function weatherIcon(code: number | null, daytime: boolean | null): string {
  if (code === null) return '';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'; // snow
  if ([95, 96, 99].includes(code)) return '⛈️'; // thunderstorm
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️'; // rain/drizzle
  if ([45, 48].includes(code)) return '🌫️'; // fog
  if ([2, 3].includes(code)) return daytime === false ? '☁️' : '⛅'; // cloudy/overcast
  if (code === 0 || code === 1) return daytime === false ? '🌙' : '☀️'; // clear/mainly clear
  return '';
}

export function formatTemp(tempC: number | null, unit: 'F' | 'C'): string {
  if (tempC === null) return '';
  const value = unit === 'F' ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC);
  return `${value}°${unit}`;
}

/**
 * Real hour-by-hour temperature and condition data, for cases where "the
 * day's high" isn't accurate enough — e.g. tagging a specific scrobble's
 * weather should reflect what it was actually like at that hour, not just
 * that day's peak. One call covers the whole date range, same as the
 * daily version, keeping this to a single request regardless of how many
 * individual scrobbles need a lookup.
 */
export async function getHourlyWeatherRange(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Map<string, { tempC: number; weatherCode: number | null }>> {
  const rLat = Math.round(lat * 100) / 100;
  const rLon = Math.round(lon * 100) / 100;
  const result = new Map<string, { tempC: number; weatherCode: number | null }>();

  try {
    const params = new URLSearchParams({
      latitude: String(rLat),
      longitude: String(rLon),
      start_date: startDate,
      end_date: endDate,
      hourly: 'temperature_2m,weathercode',
      timezone: 'auto',
    });
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
    if (!res.ok) return result;
    const data = await res.json();

    const times: string[] = data.hourly?.time || []; // "YYYY-MM-DDTHH:00" in local time (timezone=auto)
    const temps: number[] = data.hourly?.temperature_2m || [];
    const codes: number[] = data.hourly?.weathercode || [];

    for (let i = 0; i < times.length; i++) {
      // Key by "YYYY-MM-DDTHH" for easy rounding-to-nearest-hour lookups.
      result.set(times[i].slice(0, 13), { tempC: temps[i], weatherCode: codes[i] ?? null });
    }
  } catch {
    // network failure — caller just won't get hourly data for this range
  }

  return result;
}

/** "YYYY-MM-DDTHH" for a UTC Date, in a given IANA timezone — matches the
 * key format getHourlyWeatherRange uses (Open-Meteo's timezone=auto keys). */
export function localHourKey(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const hour = get('hour') === '24' ? '00' : get('hour');
    return `${get('year')}-${get('month')}-${get('day')}T${hour}`;
  } catch {
    return date.toISOString().slice(0, 13);
  }
}
