import { findBeer, type Beer } from '@/data/beers';
import type { Post } from '@/data/types';

/**
 * Beer cards: the first check-in of a beer earns its card, and the card levels up as you
 * drink more. 5 tiers × 5 levels = level 25 max.
 *
 * XP: each check-in of that exact beer = 2 XP (one level); a check-in of a *different*
 * beer from the same brewery = 1 XP (half a level). The brewery bonus is capped at the XP
 * from the beer itself, so you can't max a card you've only had once. Everything is
 * derived from posts.
 */

export const TIERS = [
  { name: 'Bronze', colors: ['#7A4A22', '#C9844A'], ink: '#FFF4E8' },
  { name: 'Silver', colors: ['#7D8797', '#DDE3EA'], ink: '#15181D' },
  { name: 'Gold', colors: ['#A67C00', '#FFD95E'], ink: '#1E1600' },
  { name: 'Platinum', colors: ['#2F8C9C', '#BFF2F5'], ink: '#062126' },
  { name: 'Legendary', colors: ['#6A1FD1', '#F0469E'], ink: '#FFFFFF' },
] as const;

export const LEVELS_PER_TIER = 5;
export const MAX_LEVEL = TIERS.length * LEVELS_PER_TIER;
const XP_PER_LEVEL = 2;
const XP_EXACT = 2;
const XP_BREWERY = 1;

export type BeerCard = {
  beer: Beer;
  /** Check-ins of this exact beer. */
  count: number;
  /** Check-ins of other beers from the same brewery. */
  breweryCount: number;
  xp: number;
  level: number;
  tierIndex: number;
  /** 1–5 within the tier. */
  levelInTier: number;
  /** 0–1 progress towards the next level (1 at max). */
  progress: number;
  maxed: boolean;
  firstAt: number;
  /** Most recent photo the user took of this beer, used as the card art. */
  photo?: string;
};

export function levelForXp(xp: number) {
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL)));
}

export function tierOf(level: number) {
  const tierIndex = Math.floor((level - 1) / LEVELS_PER_TIER);
  return { tierIndex, levelInTier: ((level - 1) % LEVELS_PER_TIER) + 1, tier: TIERS[tierIndex] };
}

/** All cards a user owns, best first. */
export function cardsFor(posts: Post[], userId: string, customBeers: Beer[]): BeerCard[] {
  const mine = posts
    .filter((p) => p.userId === userId && p.kind === 'beer' && p.beerId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const owned = new Map<string, Post[]>();
  for (const p of mine) owned.set(p.beerId!, [...(owned.get(p.beerId!) ?? []), p]);

  const cards: BeerCard[] = [];
  for (const [beerId, checkIns] of owned) {
    const beer = findBeer(beerId, customBeers);
    if (!beer) continue;
    const breweryCount = mine.filter((p) => {
      if (p.beerId === beerId) return false;
      const other = findBeer(p.beerId, customBeers);
      return !!other && other.brewery === beer.brewery && beer.brewery !== 'Unknown brewery';
    }).length;
    const exactXp = checkIns.length * XP_EXACT;
    const xp = exactXp + Math.min(breweryCount * XP_BREWERY, exactXp);
    const level = levelForXp(xp);
    const { tierIndex, levelInTier } = tierOf(level);
    const maxed = level >= MAX_LEVEL;
    cards.push({
      beer,
      count: checkIns.length,
      breweryCount,
      xp,
      level,
      tierIndex,
      levelInTier,
      progress: maxed ? 1 : (xp % XP_PER_LEVEL) / XP_PER_LEVEL,
      maxed,
      firstAt: checkIns[0].createdAt,
      photo: [...checkIns].reverse().find((p) => p.photo)?.photo,
    });
  }
  return cards.sort((a, b) => b.xp - a.xp || b.firstAt - a.firstAt);
}
