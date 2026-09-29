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

function inWindow(challenge: Challenge, p: Post) {
  return p.createdAt >= challenge.startsAt && p.createdAt < challenge.endsAt;
}

/** The user's own value, from their local posts so it updates the instant they post. */
function valueFor(challenge: Challenge, posts: Post[], userId: string): { value: number; detail?: string } {
  const mine = posts.filter((p) => p.userId === userId && inWindow(challenge, p));
  switch (challenge.kind) {
    case 'newBeers':
      return { value: new Set(mine.filter((p) => p.kind === 'beer' && p.beerId).map((p) => p.beerId)).size };
    case 'nights':
      return { value: mine.filter((p) => p.kind === 'night').length };
    case 'topRated': {
      const best = mine.filter((p) => p.kind === 'beer' && p.rating).sort((a, b) => b.rating! - a.rating!)[0];
      return { value: best?.rating ?? 0, detail: best?.beer };
    }
    case 'cities':
      return { value: new Set(mine.map((p) => p.city).filter(Boolean)).size };
  }
}

/**
 * Standings come from the server summary (it can see participants who aren't your friends);
 * your own row and the group total are recomputed from local posts so progress feels instant.
 */
export function challengeStatus(
  challenge: Challenge,
  posts: Post[],
  myId: string,
  userById: (id: string) => User,
  now = Date.now()
): ChallengeStatus {
  const joined = challenge.participantIds.includes(myId);
  const mine = valueFor(challenge, posts, myId);
  const server = challenge.summary?.standings ?? [];

  const standings: Standing[] = challenge.participantIds.map((id) => {
    if (id === myId) return { user: userById(id), value: mine.value, detail: mine.detail };
    const row = server.find((s) => s.userId === id);
    return { user: userById(id), value: row?.value ?? 0, detail: row?.detail ?? undefined };
  });
  standings.sort((a, b) => b.value - a.value);

  const isGroup = challenge.kind === 'cities';
  const groupCities = new Set([
    ...(challenge.summary?.groupCities ?? []),
    ...posts.filter((p) => p.userId === myId && inWindow(challenge, p) && p.city).map((p) => p.city),
  ]);
  const myValue = isGroup ? groupCities.size : mine.value;
  const done = joined && (challenge.kind === 'topRated' ? myValue > 0 : myValue >= challenge.goal);

  return { active: now < challenge.endsAt, joined, myValue, done, isGroup, standings };
}

export function challengeRecap(
  challenge: Challenge,
  posts: Post[],
  myId: string,
  userById: (id: string) => User
): ChallengeRecap {
  const status = challengeStatus(challenge, posts, myId, userById, challenge.endsAt);
  const summary = challenge.summary;
  const mvpRow = [...(summary?.standings ?? [])].sort((a, b) => b.posts - a.posts)[0];
  const finishers = status.standings
    .filter((s) => (challenge.kind === 'topRated' ? s.value > 0 : s.value >= challenge.goal))
    .map((s) => s.user);

  return {
    posts: summary?.posts ?? 0,
    beers: summary?.beers ?? 0,
    cities: summary?.groupCities ?? [],
    mvp: mvpRow && mvpRow.posts > 0 ? userById(mvpRow.userId) : undefined,
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
