import type { Beer } from '@/data/beers';

export type User = {
  id: string;
  name: string;
  username: string;
  /** Profile photo URL. Missing → initials. */
  photo?: string;
  city: string;
  /** Shared location, only present while the user shares it with you. */
  lat?: number;
  lng?: number;
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
  /** Displayable URI of the attached photo (signed URL, or a local file while uploading). */
  photo?: string;
  /** Stable storage path, used as the image cache key since signed URLs change. */
  photoKey?: string;
  /** True while an optimistic post is still being saved. */
  pending?: boolean;
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

/** A named crew of friends with a photo and its own leaderboard. */
export type Group = {
  id: string;
  name: string;
  /** Public URL of the group photo. Missing → initial on a gradient. */
  photo?: string;
  createdBy?: string;
  createdAt: number;
  memberIds: string[];
};

/** What a group leaderboard can rank by. */
export type GroupMetric = 'beers' | 'posts' | 'nights' | 'uniqueBeers' | 'avgRating' | 'cheers';

export type GroupPeriod = 'week' | 'month' | 'all';

export type GroupLeaderboard = {
  standings: ({ userId: string; avgRating: number | null } & Record<Exclude<GroupMetric, 'avgRating'>, number>)[];
  posts: number;
  beers: number;
  cities: number;
};

/** The data the screens read, assembled from cached Supabase queries by the store. */
export type AppState = {
  posts: Post[];
  friendIds: string[];
  groups: Group[];
  /** The user's own profile photo (local file URI). */
  profilePhoto?: string;
  /** Beers the user typed that aren't in the catalog. */
  customBeers: Beer[];
  location: {
    sharing: LocationSharing;
    me?: MyLocation;
  };
};
