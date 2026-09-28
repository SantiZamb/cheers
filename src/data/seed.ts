import type { AppState, Challenge, Post, PostKind, User } from '@/data/types';

export const STATE_VERSION = 5;

export const ME_ID = 'me';

export const USERS: Record<string, User> = {
  me: { id: 'me', name: 'You', city: 'Chicago', lat: 41.8837, lng: -87.6325 },
  maya: { id: 'maya', name: 'Maya', photo: 'https://randomuser.me/api/portraits/women/68.jpg', city: 'Denver', lat: 39.7527, lng: -104.9993 },
  leo: { id: 'leo', name: 'Leo', photo: 'https://randomuser.me/api/portraits/men/32.jpg', city: 'Dublin', lat: 53.3455, lng: -6.2643 },
  priya: { id: 'priya', name: 'Priya', photo: 'https://randomuser.me/api/portraits/women/65.jpg', city: 'London', lat: 51.4739, lng: -0.0691 },
  sam: { id: 'sam', name: 'Sam', photo: 'https://randomuser.me/api/portraits/men/46.jpg', city: 'Austin', lat: 30.2672, lng: -97.7431 },
  // Suggested friends, not connected at first.
  jonas: { id: 'jonas', name: 'Jonas', photo: 'https://randomuser.me/api/portraits/men/85.jpg', city: 'Berlin', lat: 52.4983, lng: 13.4186 },
  aiko: { id: 'aiko', name: 'Aiko', photo: 'https://randomuser.me/api/portraits/women/12.jpg', city: 'Tokyo', lat: 35.6595, lng: 139.7005 },
  carlos: { id: 'carlos', name: 'Carlos', photo: 'https://randomuser.me/api/portraits/men/22.jpg', city: 'Mexico City', lat: 19.4194, lng: -99.1616 },
};

export const ME = USERS[ME_ID];

export const KIND_LABELS: Record<PostKind, { emoji: string; label: string }> = {
  beer: { emoji: '🍺', label: 'Beer' },
  night: { emoji: '🌙', label: 'Night out' },
  checkin: { emoji: '📍', label: 'Check-in' },
};

/** Canned replies friends leave on your posts, by post kind. */
export const FRIEND_COMMENTS: Record<PostKind, string[]> = {
  beer: ['Ooh I need to try that 🤤', 'Save me one!', 'Great pick 🍻', 'Adding that to my list'],
  night: ['Wish I was there!', 'Looks like a great night 🔥', "Next time I'm coming", 'Legendary 🙌'],
  checkin: ['Cheers from here! 🍻', 'Raising one to you right now', 'Enjoy!!'],
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Draft = Omit<Post, 'id' | 'createdAt' | 'reactions' | 'comments'> & {
  ago: number;
  reactions?: Post['reactions'];
  comments?: Post['comments'];
};

function build(drafts: Draft[], now: number, prefix: string): Post[] {
  return drafts.map(({ ago, reactions = {}, comments = [], ...rest }, i) => ({
    ...rest,
    id: `${prefix}${i}`,
    createdAt: now - ago,
    reactions,
    comments,
  }));
}

function seedPosts(now: number): Post[] {
  return build(
    [
      {
        userId: 'maya',
        kind: 'beer',
        beerId: 'hazy-little-thing',
        beer: 'Hazy Little Thing',
        brewery: 'Sierra Nevada',
        style: 'Hazy IPA',
        rating: 4,
        note: 'Juicy and soft. Perfect patio beer.',
        venue: 'The Tap Room',
        city: 'Denver',
        ago: 12 * MINUTE,
        reactions: { '🍻': ['leo', 'sam'], '🤤': ['priya'] },
      },
      {
        userId: 'leo',
        kind: 'night',
        title: 'Trad session at the pub',
        beersCount: 3,
        rating: 5,
        note: 'Live fiddle, three pints, zero regrets. ☘️',
        venue: "O'Malley's",
        city: 'Dublin',
        ago: 50 * MINUTE,
        reactions: { '🔥': ['maya', 'priya', 'me'], '🍻': ['sam'] },
        comments: [{ id: 'c1', userId: 'priya', text: 'Save me a seat next time!', createdAt: now - 40 * MINUTE }],
      },
      {
        userId: 'priya',
        kind: 'beer',
        beerId: 'pliny-the-elder',
        beer: 'Pliny the Elder',
        brewery: 'Russian River',
        style: 'IPA',
        rating: 5,
        note: 'Finally got my hands on one!!',
        city: 'London',
        ago: 3 * HOUR,
        reactions: { '🤤': ['maya', 'leo', 'sam'] },
      },
      {
        userId: 'sam',
        kind: 'checkin',
        note: 'Backyard BBQ, cooler full of pilsners. Who’s in?',
        venue: 'Backyard',
        city: 'Austin',
        ago: 7 * HOUR,
        reactions: { '🍻': ['maya'] },
      },
      {
        userId: 'me',
        kind: 'beer',
        beerId: 'fat-tire',
        beer: 'Fat Tire',
        brewery: 'New Belgium',
        style: 'Amber',
        rating: 4,
        note: 'Toasty and easy-drinking.',
        city: 'Chicago',
        // Just before this week's challenges started, so the first new post moves them all.
        ago: 4 * DAY,
        reactions: { '🍻': ['maya', 'leo'] },
        comments: [{ id: 'c2', userId: 'sam', text: 'Classic 🙌', createdAt: now - 4 * DAY + HOUR }],
      },
      {
        userId: 'maya',
        kind: 'night',
        title: 'Brewery crawl on Tennyson',
        beersCount: 4,
        rating: 4,
        note: 'Four stops, one very good taco truck.',
        city: 'Denver',
        ago: 2 * DAY,
        reactions: { '🔥': ['leo', 'me'] },
      },
      {
        userId: 'jonas',
        kind: 'beer',
        beerId: 'berliner-weisse',
        beer: 'Berliner Weisse',
        brewery: 'Schneeeule',
        style: 'Sour',
        rating: 5,
        note: 'Tart, bright, dangerous on a hot day.',
        city: 'Berlin',
        ago: 5 * HOUR,
      },
      {
        userId: 'aiko',
        kind: 'beer',
        beerId: 'hitachino-white',
        beer: 'Hitachino Nest White Ale',
        brewery: 'Kiuchi',
        style: 'Wheat',
        rating: 4,
        note: 'Owl on the label, coriander in the glass.',
        city: 'Tokyo',
        ago: 9 * HOUR,
      },
      // Older history (outside every challenge window) so the card collection has some depth.
      ...[16, 19, 23, 27, 31, 36].map((days, i) => ({
        userId: 'me',
        kind: 'beer' as const,
        beerId: 'fat-tire',
        beer: 'Fat Tire',
        brewery: 'New Belgium',
        style: 'Amber',
        rating: 4,
        note: ['Old reliable.', 'Friday tradition.', 'Still great.', 'Game night pour.', 'Can’t beat it.', 'First of many.'][i],
        city: 'Chicago',
        ago: days * DAY,
      })),
      ...[18, 29].map((days) => ({
        userId: 'me',
        kind: 'beer' as const,
        beerId: 'guinness-draught',
        beer: 'Guinness Draught',
        brewery: 'Guinness',
        style: 'Stout',
        rating: 5,
        note: 'Patience rewarded.',
        city: 'Chicago',
        ago: days * DAY,
      })),
      {
        userId: 'me',
        kind: 'beer',
        beerId: 'voodoo-ranger',
        beer: 'Voodoo Ranger IPA',
        brewery: 'New Belgium',
        style: 'IPA',
        rating: 3,
        note: 'Bit much for me, but counts for the Fat Tire card.',
        city: 'Chicago',
        ago: 21 * DAY,
      },
      // Last week's ended challenge ("Stout Season") draws on these.
      {
        userId: 'me',
        kind: 'beer',
        beerId: 'guinness-draught',
        beer: 'Guinness Draught',
        brewery: 'Guinness',
        style: 'Stout',
        rating: 5,
        note: 'Nothing beats a proper pour.',
        city: 'Chicago',
        ago: 9 * DAY,
      },
      {
        userId: 'me',
        kind: 'beer',
        beerId: 'founders-breakfast-stout',
        beer: 'Breakfast Stout',
        brewery: 'Founders',
        style: 'Stout',
        rating: 4,
        note: 'Coffee and chocolate for dinner.',
        city: 'Chicago',
        ago: 10 * DAY,
      },
      {
        userId: 'leo',
        kind: 'beer',
        beerId: 'murphys-stout',
        beer: 'Murphy’s Irish Stout',
        brewery: 'Heineken Ireland',
        style: 'Stout',
        rating: 4,
        note: 'The Cork loyalist in me approves.',
        city: 'Dublin',
        ago: 9 * DAY + 3 * HOUR,
      },
      {
        userId: 'priya',
        kind: 'beer',
        beerId: 'london-porter',
        beer: 'London Porter',
        brewery: "Fuller's",
        style: 'Porter',
        rating: 4,
        note: 'Close enough to a stout, right?',
        city: 'London',
        ago: 11 * DAY,
      },
      {
        userId: 'maya',
        kind: 'beer',
        beerId: 'old-rasputin',
        beer: 'Old Rasputin',
        brewery: 'North Coast',
        style: 'Stout',
        rating: 5,
        note: 'Big, roasty, perfect.',
        city: 'Denver',
        ago: 12 * DAY,
      },
    ],
    now,
    'seed'
  );
}

/** Friend posts revealed one at a time when the feed is pulled to refresh. */
export const FRIEND_POST_POOL: Omit<Draft, 'ago'>[] = [
  {
    userId: 'sam',
    kind: 'beer',
    beerId: 'shiner-bock',
    beer: 'Shiner Bock',
    brewery: 'Spoetzl',
    style: 'Lager',
    rating: 3,
    note: 'Texas tradition. Not mad at it.',
    city: 'Austin',
  },
  {
    userId: 'priya',
    kind: 'night',
    title: 'Rooftop in Peckham',
    beersCount: 2,
    rating: 5,
    note: 'Sunset, good people, cold pints.',
    venue: 'Frank’s',
    city: 'London',
  },
  {
    userId: 'leo',
    kind: 'checkin',
    note: 'Pint in hand, watching the match. Raise one with me!',
    venue: 'The Brazen Head',
    city: 'Dublin',
  },
  {
    userId: 'maya',
    kind: 'beer',
    beerId: 'juicy-haze',
    beer: 'Juicy Haze',
    brewery: 'New Belgium',
    style: 'Hazy IPA',
    rating: 4,
    note: 'Challenge beer #2 ✅',
    city: 'Denver',
  },
];

export function poolPost(index: number, now: number): Post {
  const draft = FRIEND_POST_POOL[index];
  return { ...draft, id: `pool${index}-${now}`, createdAt: now, reactions: {}, comments: [] };
}

function seedChallenges(now: number): Challenge[] {
  const weekStart = now - 3 * DAY;
  const weekEnd = now + 4 * DAY;
  return [
    {
      id: 'new-beers',
      title: 'Three new beers',
      description: 'Everyone tries three beers they’ve never had this week.',
      kind: 'newBeers',
      goal: 3,
      startsAt: weekStart,
      endsAt: weekEnd,
      participantIds: ['me', 'maya', 'leo', 'priya'],
      badge: { emoji: '🧭', name: 'Beer Explorer' },
    },
    {
      id: 'two-nights',
      title: 'Two nights out',
      description: 'Post two night-out recaps before Sunday.',
      kind: 'nights',
      goal: 2,
      startsAt: weekStart,
      endsAt: weekEnd,
      participantIds: ['me', 'leo', 'sam'],
      badge: { emoji: '🌙', name: 'Night Owl' },
    },
    {
      id: 'globe',
      title: 'Cheers across the globe',
      description: 'Together, check in from five different cities.',
      kind: 'cities',
      goal: 5,
      startsAt: weekStart,
      endsAt: weekEnd,
      participantIds: ['me', 'maya', 'leo', 'priya', 'sam'],
      badge: { emoji: '🌍', name: 'Globetrotters' },
    },
    {
      id: 'best-pour',
      title: 'Weekend’s best pour',
      description: 'Rate a beer this weekend. Highest rating takes the crown.',
      kind: 'topRated',
      goal: 1,
      startsAt: now - 1 * DAY,
      endsAt: now + 2 * DAY,
      participantIds: ['sam', 'maya'],
      invitedBy: 'sam',
      badge: { emoji: '👑', name: 'Best Pour' },
    },
    {
      id: 'stout-season',
      title: 'Stout season',
      description: 'Two new beers each (stouts encouraged), last week.',
      kind: 'newBeers',
      goal: 2,
      startsAt: now - 14 * DAY,
      endsAt: now - 7 * DAY,
      participantIds: ['me', 'maya', 'leo', 'priya'],
      badge: { emoji: '🖤', name: 'Stout Season' },
    },
  ];
}

export function createSeedState(now = Date.now()): AppState {
  return {
    version: STATE_VERSION,
    posts: seedPosts(now),
    friendIds: ['maya', 'leo', 'priya', 'sam'],
    challenges: seedChallenges(now),
    customBeers: [],
    location: { sharing: 'off' },
    nextPoolIndex: 0,
  };
}
