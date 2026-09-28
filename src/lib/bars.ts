import type { Post } from '@/data/types';
import { distanceMeters } from '@/lib/geo';

/**
 * Nearby bars, pubs and clubs from OpenStreetMap via the public Overpass API (free, no key).
 * OSM has no ratings, so "best" is a Cheers score: ratings from Cheers posts at that venue
 * first, then what the OSM listing tells us (brews its own beer, craft beer, notable, etc.).
 */

export type BarKind = 'bar' | 'pub' | 'nightclub' | 'biergarten' | 'brewery';

export type Bar = {
  id: string;
  name: string;
  kind: BarKind;
  lat: number;
  lng: number;
  distance: number;
  score: number;
  /** Short human-readable reasons behind the score, best first. */
  reasons: string[];
  /** Average rating from Cheers posts that name this venue. */
  cheers?: { rating: number; count: number };
  website?: string;
};

export const BAR_KIND_LABELS: Record<BarKind, { emoji: string; label: string }> = {
  bar: { emoji: '🍸', label: 'Bar' },
  pub: { emoji: '🍺', label: 'Pub' },
  nightclub: { emoji: '🪩', label: 'Club' },
  biergarten: { emoji: '🌳', label: 'Beer garden' },
  brewery: { emoji: '🏭', label: 'Brewery' },
};

// The main server fails intermittently under load, so it gets a second try before the mirror.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const RETRY_PAUSE_MS = 1200;

const MAX_RESULTS = 25;

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Exact tag matches (not a regex) keep this cheap enough for the shared public server.
function query(lat: number, lng: number, radius: number) {
  const a = `around:${Math.round(radius)},${lat},${lng}`;
  return `[out:json][timeout:25];
(
  node[amenity=bar][name](${a});
  node[amenity=pub][name](${a});
  node[amenity=nightclub][name](${a});
  node[amenity=biergarten][name](${a});
  way[amenity=bar][name](${a});
  way[amenity=pub][name](${a});
  way[amenity=nightclub][name](${a});
  node[craft=brewery][name](${a});
  way[craft=brewery][name](${a});
);
out tags center 250;`;
}

export class BarsUnavailableError extends Error {}

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchElements(lat: number, lng: number, radius: number, signal?: AbortSignal) {
  for (const [i, url] of ENDPOINTS.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    if (signal?.aborted) throw new Error('aborted');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(query(lat, lng, radius))}`, {
        // Overpass rejects requests without an identifying User-Agent (HTTP 406).
        headers: { 'User-Agent': 'CheersDemo/1.0 (Expo demo app)', Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) continue; // 429 rate limit / 504 overloaded: try the next server.
      const json = (await res.json()) as { elements: OverpassElement[]; remark?: string };
      // A server-side timeout still returns 200, with a remark and no elements.
      if (json.remark && /timed out|runtime error/i.test(json.remark)) continue;
      return json.elements;
    } catch (e) {
      if (signal?.aborted) throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  throw new BarsUnavailableError('OpenStreetMap is busy');
}

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');

function kindOf(tags: Record<string, string>): BarKind {
  if (tags.craft === 'brewery' || tags.microbrewery === 'yes') return 'brewery';
  const amenity = tags.amenity as BarKind | undefined;
  return amenity && amenity in BAR_KIND_LABELS ? amenity : 'bar';
}

function scoreBar(
  tags: Record<string, string>,
  distance: number,
  radius: number,
  cheers?: Bar['cheers']
) {
  const reasons: string[] = [];
  let score = 50;

  if (cheers) {
    score += (cheers.rating - 3) * 12 + Math.min(cheers.count, 5) * 3;
    reasons.push(`★ ${cheers.rating.toFixed(1)} on Cheers`);
  }
  if (tags.microbrewery === 'yes' || tags.craft === 'brewery') {
    score += 10;
    reasons.push('Brews its own');
  }
  const beersListed = tags.brewery ? tags.brewery.split(';').length : 0;
  if (beersListed >= 3) {
    score += 6;
    reasons.push(`${beersListed} beers listed`);
  } else if (tags.real_ale === 'yes' || tags.craft_beer === 'yes') {
    score += 6;
    reasons.push('Craft beer');
  }
  // Chains are rarely anyone's favorite night out.
  if (tags.brand) score -= 4;
  if (tags.wikidata || tags.wikipedia) {
    score += 8;
    reasons.push('Local landmark');
  }
  if (tags.outdoor_seating === 'yes' || tags.beer_garden === 'yes' || tags.amenity === 'biergarten') {
    score += 4;
    reasons.push('Outdoor seating');
  }
  if (tags.amenity === 'nightclub') {
    score += 3;
    reasons.push('Dancing');
  }
  if (tags.food === 'yes' || tags.cuisine || tags.kitchen === 'yes') {
    score += 2;
    reasons.push('Food');
  }
  if (tags.opening_hours) score += 4;
  if (tags.website || tags['contact:website']) score += 4;
  // Closer is better, but only mildly: a great bar is worth a walk.
  score -= (distance / radius) * 15;

  return { score: Math.round(Math.max(0, Math.min(100, score))), reasons };
}

/** Ratings from Cheers posts per normalized venue name. */
function cheersRatings(posts: Post[]) {
  const byVenue = new Map<string, number[]>();
  for (const p of posts) {
    if (!p.venue || !p.rating) continue;
    const key = normalize(p.venue);
    byVenue.set(key, [...(byVenue.get(key) ?? []), p.rating]);
  }
  return byVenue;
}

const cache = new Map<string, OverpassElement[]>();

export async function findBestBars(
  center: { lat: number; lng: number },
  radius: number,
  posts: Post[],
  signal?: AbortSignal
): Promise<Bar[]> {
  // ~100 m grid so small GPS jitter reuses the same results.
  const cacheKey = `${center.lat.toFixed(3)},${center.lng.toFixed(3)},${radius}`;
  const elements = cache.get(cacheKey) ?? (await fetchElements(center.lat, center.lng, radius, signal));
  cache.set(cacheKey, elements);
  const ratings = cheersRatings(posts);
  const seen = new Set<string>();
  const bars: Bar[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!tags.name || lat == null || lng == null) continue;
    // The same venue is sometimes mapped as both a point and a building.
    const key = normalize(tags.name);
    if (seen.has(key)) continue;
    seen.add(key);

    const distance = distanceMeters(center, { lat, lng });
    if (distance > radius) continue;
    const venueRatings = ratings.get(key);
    const cheers = venueRatings
      ? { rating: venueRatings.reduce((a, b) => a + b, 0) / venueRatings.length, count: venueRatings.length }
      : undefined;
    const { score, reasons } = scoreBar(tags, distance, radius, cheers);

    bars.push({
      id: `${el.type}/${el.id}`,
      name: tags.name,
      kind: kindOf(tags),
      lat,
      lng,
      distance,
      score,
      reasons,
      cheers,
      website: tags.website ?? tags['contact:website'],
    });
  }

  return bars.sort((a, b) => b.score - a.score || a.distance - b.distance).slice(0, MAX_RESULTS);
}
