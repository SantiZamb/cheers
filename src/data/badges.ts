import type { Beer } from '@/data/beers';
import { cardsFor, LEVELS_PER_TIER, TIERS } from '@/data/cards';
import type { Group, GroupLeaderboard, Post } from '@/data/types';

/**
 * The 30 profile badges. Everything is derived on the device from data the app already has
 * (posts you and your friends can see, friends, groups and their all-time leaderboards, finished
 * challenges), so there's nothing to store and badges can never get out of sync.
 *
 * Each badge reports progress (`value` of `goal`); it's earned once value ≥ goal. `earnedAt` is
 * when the goal was reached, when that can be worked out from post times.
 */

export type BadgeDifficulty = 'common' | 'rare' | 'epic' | 'legendary';

export const DIFFICULTIES: { id: BadgeDifficulty; label: string; colors: readonly [string, string]; ink: string }[] = [
  { id: 'common', label: 'Common', colors: TIERS[0].colors, ink: TIERS[0].ink },
  { id: 'rare', label: 'Rare', colors: TIERS[1].colors, ink: TIERS[1].ink },
  { id: 'epic', label: 'Epic', colors: TIERS[2].colors, ink: TIERS[2].ink },
  { id: 'legendary', label: 'Legendary', colors: TIERS[4].colors, ink: TIERS[4].ink },
];

export type BadgeContext = {
  myId: string;
  /** Every post the user can see: their own and their friends'. */
  posts: Post[];
  friendIds: string[];
  customBeers: Beer[];
  groups: Group[];
  /** All-time leaderboard per group id (missing while loading). */
  boards: Map<string, GroupLeaderboard>;
  challengesDone: number;
};

type Progress = { value: number; goal: number; earnedAt?: number; detail?: string };

type BadgeDef = {
  id: string;
  emoji: string;
  name: string;
  difficulty: BadgeDifficulty;
  /** How to earn it, shown on locked badges. */
  howTo: string;
  /** How it was earned, shown once unlocked. */
  earned: string;
  /** Unit for the progress line, e.g. "beers". */
  unit?: string;
  progress: (d: Derived) => Progress;
};

export type Badge = Omit<BadgeDef, 'progress'> & Progress & { unlocked: boolean };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BUDDY_WINDOW = 3 * HOUR;
const MIN_GROUP_SIZE = 3;

// ───────────── Helpers ─────────────

type Timed = { createdAt: number };

/** Walks items oldest first and reports how many (distinct, if `key` is given) there are, and when `goal` was hit. */
function countUp<T extends Timed>(items: T[], goal: number, key?: (item: T) => string | undefined): Progress {
  const seen = new Set<string>();
  let value = 0;
  let earnedAt: number | undefined;
  for (const item of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    if (key) {
      const k = key(item);
      if (!k || seen.has(k)) continue;
      seen.add(k);
    }
    value++;
    if (value === goal) earnedAt = item.createdAt;
  }
  return { value, goal, earnedAt };
}

/** A number that only has a current value (no history), e.g. friend count. */
const atLeast = (value: number, goal: number, detail?: string): Progress => ({ value, goal, detail });

const normalize = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function startOfWeek(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

/** The Friday that starts the weekend `t` falls in, or null on Mon–Thu. */
function weekendOf(t: number) {
  const d = new Date(t);
  const day = d.getDay(); // 0 = Sunday
  if (day !== 5 && day !== 6 && day !== 0) return null;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day === 0 ? 2 : day - 5));
  return d.getTime();
}

// ───────────── What every badge reads ─────────────

type Derived = ReturnType<typeof derive>;

function derive(ctx: BadgeContext) {
  const { myId, posts, friendIds } = ctx;
  const mine = posts.filter((p) => p.userId === myId).sort((a, b) => a.createdAt - b.createdAt);
  const beers = mine.filter((p) => p.kind === 'beer');
  const friends = new Set(friendIds);
  const friendPosts = posts.filter((p) => friends.has(p.userId));

  // Beers drunk: one per beer check-in plus the count logged on night-out posts.
  const drinks: Timed[] = mine.flatMap((p) =>
    p.kind === 'beer'
      ? [p]
      : p.kind === 'night'
        ? Array.from({ length: p.beersCount ?? 0 }, () => ({ createdAt: p.createdAt }))
        : []
  );

  // For each of my posts with a venue: which friends posted from the same place within 3 hours.
  const outings = mine
    .filter((p) => normalize(p.venue))
    .map((p) => {
      const buddies = new Set(
        friendPosts
          .filter((f) => normalize(f.venue) === normalize(p.venue) && Math.abs(f.createdAt - p.createdAt) <= BUDDY_WINDOW)
          .map((f) => f.userId)
      );
      return { post: p, buddies };
    });

  const cards = cardsFor(posts, myId, ctx.customBeers);
  const bestLevel = Math.max(0, ...cards.map((c) => c.level));

  const myComments = posts.flatMap((p) => p.comments.filter((c) => c.userId === myId));
  const myReactions = posts
    .filter((p) => p.userId !== myId)
    .reduce((n, p) => n + Object.values(p.reactions).filter((users) => users?.includes(myId)).length, 0);
  const bestPostCheers = Math.max(
    0,
    ...mine.map((p) =>
      Object.values(p.reactions).reduce((n, users) => n + (users ?? []).filter((id) => id !== myId).length, 0)
    )
  );

  // Longest run of consecutive weeks with at least one post.
  const weeks = [...new Set(mine.map((p) => startOfWeek(p.createdAt)))].sort((a, b) => a - b);
  let streak = 0;
  let run = 0;
  weeks.forEach((w, i) => {
    run = i > 0 && Math.round((w - weeks[i - 1]) / (7 * DAY)) === 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
  });

  // Most of Friday / Saturday / Sunday covered in a single weekend.
  const weekendDays = new Map<number, Set<number>>();
  for (const p of mine) {
    const w = weekendOf(p.createdAt);
    if (w != null) weekendDays.set(w, (weekendDays.get(w) ?? new Set()).add(new Date(p.createdAt).getDay()));
  }
  const bestWeekend = Math.max(0, ...[...weekendDays.values()].map((s) => s.size));

  /** Groups (3+ people) where you're strictly ahead of everyone on `metric`, with at least `min`. */
  const groupLead = (metric: 'nights' | 'beers', min: number): Progress => {
    let best: { value: number; group: string; ahead: boolean } | undefined;
    for (const g of ctx.groups) {
      const board = ctx.boards.get(g.id);
      if (!board || board.standings.length < MIN_GROUP_SIZE) continue;
      const me = board.standings.find((s) => s.userId === myId);
      if (!me) continue;
      const others = Math.max(0, ...board.standings.filter((s) => s.userId !== myId).map((s) => s[metric]));
      const ahead = me[metric] > others && me[metric] >= min;
      if (!best || (ahead && !best.ahead) || (ahead === best.ahead && me[metric] > best.value))
        best = { value: me[metric], group: g.name, ahead };
    }
    if (!best) return atLeast(0, 1, `Needs a group of ${MIN_GROUP_SIZE}+ people`);
    return atLeast(best.ahead ? 1 : 0, 1, best.ahead ? `In ${best.group}` : `Best so far: ${best.value} in ${best.group}`);
  };

  return {
    ctx,
    mine,
    beers,
    drinks,
    outings,
    bestLevel,
    myComments,
    myReactions,
    bestPostCheers,
    streak,
    bestWeekend,
    groupLead,
  };
}

const cardLevel = (d: Derived, tierIndex: number): Progress => {
  const goal = tierIndex * LEVELS_PER_TIER + 1;
  return atLeast(Math.min(d.bestLevel, goal), goal);
};

// ───────────── The badges ─────────────

export const BADGES: BadgeDef[] = [
  // Common: the basics, all in the first night or two.
  {
    id: 'first-sip',
    emoji: '🍺',
    name: 'First Sip',
    difficulty: 'common',
    howTo: 'Check in your first beer.',
    earned: 'Checked in your first beer.',
    progress: (d) => countUp(d.beers, 1),
  },
  {
    id: 'shutterbug',
    emoji: '📸',
    name: 'Shutterbug',
    difficulty: 'common',
    howTo: 'Share a post with a photo.',
    earned: 'Shared your first photo.',
    progress: (d) => countUp(d.mine.filter((p) => p.photo), 1),
  },
  {
    id: 'night-owl',
    emoji: '🌙',
    name: 'Night Owl',
    difficulty: 'common',
    howTo: 'Post a night out.',
    earned: 'Posted your first night out.',
    progress: (d) => countUp(d.mine.filter((p) => p.kind === 'night'), 1),
  },
  {
    id: 'checked-in',
    emoji: '📍',
    name: 'Checked In',
    difficulty: 'common',
    howTo: 'Post a check-in from a bar.',
    earned: 'Posted your first check-in.',
    progress: (d) => countUp(d.mine.filter((p) => p.kind === 'checkin'), 1),
  },
  {
    id: 'crew-up',
    emoji: '🤝',
    name: 'Crew Up',
    difficulty: 'common',
    howTo: 'Have 3 friends on Cheers.',
    earned: 'Built a crew of 3+ friends.',
    unit: 'friends',
    progress: (d) => atLeast(d.ctx.friendIds.length, 3),
  },
  {
    id: 'chatterbox',
    emoji: '💬',
    name: 'Chatterbox',
    difficulty: 'common',
    howTo: 'Leave 5 comments on posts.',
    earned: 'Left 5 comments.',
    unit: 'comments',
    progress: (d) => countUp(d.myComments, 5),
  },
  {
    id: 'hype-machine',
    emoji: '🙌',
    name: 'Hype Machine',
    difficulty: 'common',
    howTo: 'React to your friends’ posts 10 times.',
    earned: 'Hyped up your friends 10 times.',
    unit: 'reactions',
    progress: (d) => atLeast(d.myReactions, 10),
  },
  {
    id: 'squad-goals',
    emoji: '👯',
    name: 'Squad Goals',
    difficulty: 'common',
    howTo: 'Create or join a group.',
    earned: 'Joined a group.',
    progress: (d) => atLeast(d.ctx.groups.length, 1),
  },

  // Rare: takes a few outings.
  {
    id: 'style-hopper',
    emoji: '🎨',
    name: 'Style Hopper',
    difficulty: 'rare',
    howTo: 'Check in 5 different beer styles.',
    earned: 'Tried 5 different styles.',
    unit: 'styles',
    progress: (d) => countUp(d.beers, 5, (p) => (p.style && p.style !== 'Beer' ? p.style : undefined)),
  },
  {
    id: 'explorer',
    emoji: '🧭',
    name: 'Explorer',
    difficulty: 'rare',
    howTo: 'Check in 10 different beers.',
    earned: 'Tried 10 different beers.',
    unit: 'beers',
    progress: (d) => countUp(d.beers, 10, (p) => p.beerId),
  },
  {
    id: 'brewery-tour',
    emoji: '🏭',
    name: 'Brewery Tour',
    difficulty: 'rare',
    howTo: 'Drink beers from 5 different breweries.',
    earned: 'Drank from 5 breweries.',
    unit: 'breweries',
    progress: (d) => countUp(d.beers, 5, (p) => (p.brewery && p.brewery !== 'Unknown brewery' ? p.brewery : undefined)),
  },
  {
    id: 'city-hopper',
    emoji: '🚕',
    name: 'City Hopper',
    difficulty: 'rare',
    howTo: 'Post from 3 different cities.',
    earned: 'Posted from 3 cities.',
    unit: 'cities',
    progress: (d) => countUp(d.mine, 3, (p) => normalize(p.city) || undefined),
  },
  {
    id: 'silver-sipper',
    emoji: '🥈',
    name: 'Silver Sipper',
    difficulty: 'rare',
    howTo: 'Level any beer card up to Silver (Lv 6).',
    earned: 'Got a beer card to Silver.',
    unit: 'card level',
    progress: (d) => cardLevel(d, 1),
  },
  {
    id: 'crowd-pleaser',
    emoji: '🔥',
    name: 'Crowd Pleaser',
    difficulty: 'rare',
    howTo: 'Get 5 reactions from friends on a single post.',
    earned: 'Got 5+ reactions on one post.',
    unit: 'reactions on your best post',
    progress: (d) => atLeast(d.bestPostCheers, 5),
  },
  {
    id: 'drinking-buddies',
    emoji: '🍻',
    name: 'Drinking Buddies',
    difficulty: 'rare',
    howTo: 'Drink with a friend: post from the same bar as a friend within 3 hours of each other. Add the venue to your post!',
    earned: 'Had a drink with a friend at the same bar.',
    progress: (d) => {
      const first = d.outings.find((o) => o.buddies.size > 0);
      return { value: first ? 1 : 0, goal: 1, earnedAt: first?.post.createdAt, detail: first?.post.venue && `At ${first.post.venue}` };
    },
  },
  {
    id: 'weekend-warrior',
    emoji: '📅',
    name: 'Weekend Warrior',
    difficulty: 'rare',
    howTo: 'Post on the Friday, Saturday and Sunday of the same weekend.',
    earned: 'Posted all three days of a weekend.',
    unit: 'days of one weekend',
    progress: (d) => atLeast(d.bestWeekend, 3),
  },
  {
    id: 'honest-critic',
    emoji: '🧐',
    name: 'Honest Critic',
    difficulty: 'rare',
    howTo: 'Use every rating from 1 to 5 on your beers.',
    earned: 'Gave out every rating from 1 to 5.',
    unit: 'different ratings',
    progress: (d) => countUp(d.beers, 5, (p) => (p.rating ? String(p.rating) : undefined)),
  },
  {
    id: 'challenger',
    emoji: '🏁',
    name: 'Challenger',
    difficulty: 'rare',
    howTo: 'Complete a challenge.',
    earned: 'Completed a challenge.',
    progress: (d) => atLeast(d.ctx.challengesDone, 1),
  },

  // Epic: weeks of going out, or beating your friends.
  {
    id: 'gold-standard',
    emoji: '🥇',
    name: 'Gold Standard',
    difficulty: 'epic',
    howTo: 'Level any beer card up to Gold (Lv 11).',
    earned: 'Got a beer card to Gold.',
    unit: 'card level',
    progress: (d) => cardLevel(d, 2),
  },
  {
    id: 'globetrotter',
    emoji: '🌍',
    name: 'Globetrotter',
    difficulty: 'epic',
    howTo: 'Post from 10 different cities.',
    earned: 'Posted from 10 cities.',
    unit: 'cities',
    progress: (d) => countUp(d.mine, 10, (p) => normalize(p.city) || undefined),
  },
  {
    id: 'half-century',
    emoji: '🍾',
    name: 'Half Century',
    difficulty: 'epic',
    howTo: 'Log 50 beers (beer check-ins plus beers counted on nights out).',
    earned: 'Logged 50 beers.',
    unit: 'beers',
    progress: (d) => countUp(d.drinks, 50),
  },
  {
    id: 'regular',
    emoji: '🗓️',
    name: 'The Regular',
    difficulty: 'epic',
    howTo: 'Post at least once a week for 8 weeks in a row.',
    earned: 'Posted every week for 8 weeks straight.',
    unit: 'weeks in a row (your best)',
    progress: (d) => atLeast(d.streak, 8),
  },
  {
    id: 'group-mvp',
    emoji: '🦸',
    name: 'Group MVP',
    difficulty: 'epic',
    howTo: 'Have more nights out than anyone else in a group of 3+ (at least 3 nights, all time).',
    earned: 'Out more nights than anyone else in your group.',
    progress: (d) => d.groupLead('nights', 3),
  },
  {
    id: 'top-of-the-taps',
    emoji: '🏆',
    name: 'Top of the Taps',
    difficulty: 'epic',
    howTo: 'Drink more beers than anyone else in a group of 3+ (at least 10, all time).',
    earned: 'Drank the most beers in your group.',
    progress: (d) => d.groupLead('beers', 10),
  },
  {
    id: 'party-starter',
    emoji: '🎉',
    name: 'Party Starter',
    difficulty: 'epic',
    howTo: 'Get 3 friends out with you: they each post from the same bar within 3 hours of your post.',
    earned: 'Had 3 friends out at the same bar with you.',
    unit: 'friends at one bar (your best)',
    progress: (d) => {
      const best = d.outings.reduce((b, o) => (o.buddies.size > (b?.buddies.size ?? 0) ? o : b), d.outings[0]);
      const value = best?.buddies.size ?? 0;
      const first = d.outings.find((o) => o.buddies.size >= 3);
      return { value, goal: 3, earnedAt: first?.post.createdAt, detail: first?.post.venue && `At ${first.post.venue}` };
    },
  },

  // Legendary: long-haul.
  {
    id: 'platinum-pour',
    emoji: '💠',
    name: 'Platinum Pour',
    difficulty: 'legendary',
    howTo: 'Level any beer card up to Platinum (Lv 16).',
    earned: 'Got a beer card to Platinum.',
    unit: 'card level',
    progress: (d) => cardLevel(d, 3),
  },
  {
    id: 'legend',
    emoji: '👑',
    name: 'Legend',
    difficulty: 'legendary',
    howTo: 'Level any beer card up to Legendary (Lv 21).',
    earned: 'Got a beer card to Legendary.',
    unit: 'card level',
    progress: (d) => cardLevel(d, 4),
  },
  {
    id: 'centurion',
    emoji: '💯',
    name: 'Centurion',
    difficulty: 'legendary',
    howTo: 'Log 100 beers.',
    earned: 'Logged 100 beers.',
    unit: 'beers',
    progress: (d) => countUp(d.drinks, 100),
  },
  {
    id: 'encyclopedia',
    emoji: '📚',
    name: 'Beer Encyclopedia',
    difficulty: 'legendary',
    howTo: 'Check in 50 different beers.',
    earned: 'Tried 50 different beers.',
    unit: 'beers',
    progress: (d) => countUp(d.beers, 50, (p) => p.beerId),
  },
  {
    id: 'challenge-champion',
    emoji: '🎖️',
    name: 'Challenge Champion',
    difficulty: 'legendary',
    howTo: 'Complete 5 challenges.',
    earned: 'Completed 5 challenges.',
    unit: 'challenges',
    progress: (d) => atLeast(d.ctx.challengesDone, 5),
  },
];

/** Every badge with its current progress, in catalog order (easiest first). */
export function evaluateBadges(ctx: BadgeContext): Badge[] {
  const d = derive(ctx);
  return BADGES.map(({ progress, ...def }) => {
    const p = progress(d);
    return { ...def, ...p, value: Math.min(p.value, p.goal), unlocked: p.value >= p.goal };
  });
}

/** Badges unlocked in `after` that weren't in `before`, for celebrations. */
export function newlyUnlocked(before: Badge[], after: Badge[]) {
  const had = new Set(before.filter((b) => b.unlocked).map((b) => b.id));
  return after.filter((b) => b.unlocked && !had.has(b.id));
}
