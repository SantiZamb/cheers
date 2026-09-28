import { ME_ID, USERS } from '@/data/seed';
import type { Challenge, Post, User } from '@/data/types';

export type Standing = { user: User; value: number; detail?: string };

export type ChallengeStatus = {
  active: boolean;
  joined: boolean;
  /** For group challenges (`cities`) this is the group's shared total. */
  myValue: number;
  done: boolean;
  isGroup: boolean;
  /** Sorted best first. */
  standings: Standing[];
};

export type ChallengeRecap = {
  posts: number;
  beers: number;
  cities: string[];
  mvp?: User;
  finishers: User[];
  earnedBadge: boolean;
};

function postsInWindow(challenge: Challenge, posts: Post[]) {
  return posts.filter(
    (p) =>
      p.createdAt >= challenge.startsAt &&
      p.createdAt < challenge.endsAt &&
      challenge.participantIds.includes(p.userId)
  );
}

function valueFor(challenge: Challenge, posts: Post[], userId: string): Standing {
  const mine = posts.filter((p) => p.userId === userId);
  const user = USERS[userId];
  switch (challenge.kind) {
    case 'newBeers': {
      const beers = new Set(
        mine.filter((p) => p.kind === 'beer' && p.beer).map((p) => p.beer!.toLowerCase())
      );
      return { user, value: beers.size };
    }
    case 'nights':
      return { user, value: mine.filter((p) => p.kind === 'night').length };
    case 'topRated': {
      const best = mine
        .filter((p) => p.kind === 'beer' && p.rating)
        .sort((a, b) => b.rating! - a.rating!)[0];
      return { user, value: best?.rating ?? 0, detail: best?.beer };
    }
    case 'cities':
      return { user, value: new Set(mine.map((p) => p.city)).size };
  }
}

export function challengeStatus(challenge: Challenge, allPosts: Post[], now = Date.now()) {
  const posts = postsInWindow(challenge, allPosts);
  const standings = challenge.participantIds
    .map((id) => valueFor(challenge, posts, id))
    .sort((a, b) => b.value - a.value);
  const isGroup = challenge.kind === 'cities';
  const joined = challenge.participantIds.includes(ME_ID);
  const myValue = isGroup
    ? new Set(posts.map((p) => p.city)).size
    : (standings.find((s) => s.user.id === ME_ID)?.value ?? 0);
  const done = joined && (challenge.kind === 'topRated' ? myValue > 0 : myValue >= challenge.goal);

  const status: ChallengeStatus = {
    active: now < challenge.endsAt,
    joined,
    myValue,
    done,
    isGroup,
    standings,
  };
  return status;
}

export function challengeRecap(challenge: Challenge, allPosts: Post[]): ChallengeRecap {
  const posts = postsInWindow(challenge, allPosts);
  const status = challengeStatus(challenge, allPosts, challenge.endsAt);
  const counts = new Map<string, number>();
  posts.forEach((p) => counts.set(p.userId, (counts.get(p.userId) ?? 0) + 1));
  const mvpId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const finishers = status.standings
    .filter((s) => (challenge.kind === 'topRated' ? s.value > 0 : s.value >= challenge.goal))
    .map((s) => s.user);

  return {
    posts: posts.length,
    beers: new Set(posts.filter((p) => p.beer).map((p) => p.beer!.toLowerCase())).size,
    cities: [...new Set(posts.map((p) => p.city))],
    mvp: mvpId ? USERS[mvpId] : undefined,
    finishers,
    earnedBadge: status.done,
  };
}

export function formatProgress(challenge: Challenge, status: ChallengeStatus) {
  if (challenge.kind === 'topRated') {
    return status.myValue > 0 ? `Your best: ${status.myValue}/5` : 'Rate a beer to enter';
  }
  return `${Math.min(status.myValue, challenge.goal)}/${challenge.goal}`;
}

export function timeLeft(endsAt: number, now = Date.now()) {
  const diff = endsAt - now;
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d left`;
  const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
  return `${hours}h left`;
}
