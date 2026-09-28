import type { Beer } from '@/data/beers';

export type User = {
  id: string;
  name: string;
  /** Profile photo URL. Missing → initials. */
  photo?: string;
  city: string;
  /** Where the friend was last seen out (their shared location). */
  lat: number;
  lng: number;
};

/** What friends can see of the user's location. */
export type LocationSharing = 'off' | 'city' | 'precise';

export type MyLocation = {
  lat: number;
  lng: number;
  city?: string;
  updatedAt: number;
};

/** The three kinds of post: a single beer rated, a whole night out, or a casual check-in. */
export type PostKind = 'beer' | 'night' | 'checkin';

export const REACTIONS = ['🍻', '🔥', '😂', '🤤'] as const;
export type Reaction = (typeof REACTIONS)[number];

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
};

export type Post = {
  id: string;
  userId: string;
  kind: PostKind;
  createdAt: number;
  /** Local file URI of the attached photo, if any. */
  photo?: string;
  /** 1–5. Rates the beer for `beer` posts and the night for `night` posts. */
  rating?: number;
  /** Catalog or custom beer id; drives beer cards. */
  beerId?: string;
  beer?: string;
  brewery?: string;
  style?: string;
  /** Headline for a night-out recap, e.g. "Friday at the Tap Room". */
  title?: string;
  beersCount?: number;
  venue?: string;
  city: string;
  note: string;
  /** Reaction emoji → ids of users who reacted with it. */
  reactions: Partial<Record<Reaction, string[]>>;
  comments: Comment[];
};

/**
 * How progress on a challenge is measured, always over posts inside [startsAt, endsAt):
 * - newBeers: distinct beers rated by each participant
 * - nights: night-out posts by each participant
 * - topRated: each participant's highest beer rating (goal = rate at least one beer)
 * - cities: distinct cities posted from by the whole group together
 */
export type ChallengeKind = 'newBeers' | 'nights' | 'topRated' | 'cities';

export type Challenge = {
  id: string;
  title: string;
  description: string;
  kind: ChallengeKind;
  goal: number;
  startsAt: number;
  endsAt: number;
  participantIds: string[];
  /** Set when a friend invited the current user and they haven't joined yet. */
  invitedBy?: string;
  badge: { emoji: string; name: string };
};

export type AppState = {
  version: number;
  posts: Post[];
  friendIds: string[];
  challenges: Challenge[];
  /** The user's own profile photo (local file URI). */
  profilePhoto?: string;
  /** Beers the user typed that aren't in the catalog. */
  customBeers: Beer[];
  location: {
    sharing: LocationSharing;
    me?: MyLocation;
  };
  /** Index into FRIEND_POST_POOL of the next simulated friend post to reveal on refresh. */
  nextPoolIndex: number;
};
