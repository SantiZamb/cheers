import { useQueries, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-provider';
import * as api from '@/data/api';
import { evaluateBadges, newlyUnlocked, type Badge } from '@/data/badges';
import { type Beer } from '@/data/beers';
import { cardsFor, tierOf } from '@/data/cards';
import { challengeStatus, formatProgress } from '@/data/challenges';
import { KIND_LABELS } from '@/data/seed';
import type { AppState, Challenge, Group, GroupLeaderboard, LocationSharing, MyLocation, Post, Reaction, User } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import type { CelebrationContent } from '@/feedback/celebration';
import type { ToastContent } from '@/feedback/toast';
import { getMyLocation } from '@/lib/location';
import { getPushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

/**
 * The app's data layer. Everything comes from Supabase through TanStack Query, whose cache is
 * persisted on the device (src/lib/query-client.tsx): screens render instantly from cache and
 * refresh in the background. Writes are optimistic — the cache is updated first, the server
 * second, and rolled back with a message if the server says no. Supabase Realtime keeps the
 * cache fresh and powers the "Maya reacted…" banners.
 */

export type NewPost = Pick<Post, 'kind' | 'photo' | 'rating' | 'title' | 'beersCount' | 'venue' | 'note'> & {
  /** The beer checked in (for `beer` posts). Custom beers are saved for everyone to pick next time. */
  beer?: Beer;
};

export const keys = {
  profile: (uid: string) => ['profile', uid] as const,
  friends: (uid: string) => ['friends', uid] as const,
  posts: (uid: string) => ['posts', uid] as const,
  beers: () => ['beers'] as const,
  challenges: (uid: string) => ['challenges', uid] as const,
  groups: (uid: string) => ['groups', uid] as const,
  /** Prefix of every group leaderboard query (they're keyed by group and period). */
  groupBoard: (groupId: string, period: string) => ['groupBoard', groupId, period] as const,
  myLocation: (uid: string) => ['myLocation', uid] as const,
};

type Store = {
  myId: string;
  me: User;
  state: AppState;
  /** Posts from the user and their friends, newest first. */
  feed: Post[];
  /** Anyone the app knows about (you, friends, requests, comment authors, challenge members). */
  userById: (id: string) => User;
  friends: User[];
  incomingRequests: User[];
  outgoingRequests: User[];
  /** The 30 profile badges with progress (src/data/badges.ts). */
  badges: Badge[];
  /** True while the first load (with nothing cached) is in flight. */
  loading: boolean;
  /** Whether the profile is loaded, and whether the user still needs to pick a name. */
  profileStatus: 'loading' | 'needsOnboarding' | 'ready';
  addPost: (input: NewPost) => void;
  setProfilePhoto: (uri: string) => void;
  updateProfile: (patch: { name?: string; city?: string }) => Promise<void>;
  toggleReaction: (postId: string, reaction: Reaction) => void;
  addComment: (postId: string, text: string) => void;
  sendFriendRequest: (user: User) => void;
  acceptFriend: (user: User) => void;
  removeFriend: (user: User) => void;
  joinChallenge: (challengeId: string) => void;
  startChallenge: (template: api.ChallengeTemplate, inviteeIds: string[]) => Promise<void>;
  /** Resolves true once the group exists on the server. */
  createGroup: (input: { name: string; memberIds: string[]; photo?: string }) => Promise<boolean>;
  renameGroup: (groupId: string, name: string) => void;
  setGroupPhoto: (groupId: string, uri: string) => void;
  addGroupMembers: (groupId: string, memberIds: string[]) => void;
  leaveGroup: (groupId: string) => void;
  /** The intro tutorial: shown once after sign-up, and again on request from Profile. */
  tutorialOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
  /** Pull-to-refresh: refetch everything. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** City posts are tagged with: from the device location when known, else the profile city. */
  myCity: string;
  refreshMyLocation: (options?: { silent?: boolean }) => Promise<MyLocation | null>;
  setSharing: (mode: LocationSharing) => Promise<void>;
  /** Venue to prefill on the Share screen, e.g. after tapping "Check in here" on a bar. */
  draftVenue: string | null;
  setDraftVenue: (venue: string | null) => void;
  /** Friend the Map tab should center on next time it's shown. */
  mapFocus: string | null;
  setMapFocus: (friendId: string | null) => void;
};

const StoreContext = createContext<Store | null>(null);

export function postHeadline(post: Post) {
  if (post.kind === 'beer') return post.beer ?? 'a beer';
  if (post.kind === 'night') return post.title ?? 'a night out';
  return post.venue ? `a check-in at ${post.venue}` : 'a check-in';
}

const UNKNOWN_USER: Omit<User, 'id'> = { name: 'Someone', username: '', city: '' };

type PostsData = Awaited<ReturnType<typeof api.fetchPosts>>;
type ChallengesData = Awaited<ReturnType<typeof api.fetchChallenges>>;
type GroupsData = Awaited<ReturnType<typeof api.fetchGroups>>;

export function StoreProvider({ myId, children }: { myId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const feedback = useFeedback();
  const { signOut } = useAuth();

  const profileQ = useQuery({ queryKey: keys.profile(myId), queryFn: () => api.fetchProfile(myId) });
  const friendsQ = useQuery({ queryKey: keys.friends(myId), queryFn: () => api.fetchFriendships(myId) });
  const postsQ = useQuery({ queryKey: keys.posts(myId), queryFn: api.fetchPosts });
  const beersQ = useQuery({ queryKey: keys.beers(), queryFn: api.fetchBeers, staleTime: 60 * 60 * 1000 });
  const challengesQ = useQuery({ queryKey: keys.challenges(myId), queryFn: () => api.fetchChallenges(myId) });
  const groupsQ = useQuery({ queryKey: keys.groups(myId), queryFn: api.fetchGroups });
  const myLocQ = useQuery({ queryKey: keys.myLocation(myId), queryFn: () => api.fetchMyLocation(myId) });

  // All-time group leaderboards feed the group badges (same cache entries the group cards use).
  const groupBoards = useQueries({
    queries: (groupsQ.data?.groups ?? []).map((g) => ({
      queryKey: keys.groupBoard(g.id, 'all'),
      queryFn: () => api.fetchGroupLeaderboard(g.id, 'all'),
      staleTime: 60 * 1000,
    })),
  });

  const [deviceLocation, setDeviceLocation] = useState<MyLocation | undefined>();
  const [localAvatar, setLocalAvatar] = useState<string | undefined>();
  const [draftVenue, setDraftVenue] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [tutorialReplay, setTutorialReplay] = useState(false);

  // ── Assemble what screens read ──
  const friendships = friendsQ.data ?? { friends: [], incoming: [], outgoing: [] };
  const posts = postsQ.data?.posts ?? [];
  const challenges = challengesQ.data?.challenges ?? [];
  const groups = groupsQ.data?.groups ?? [];
  const customBeers = (beersQ.data ?? []).filter((b) => b.id.startsWith('custom-'));
  const myLoc = myLocQ.data;
  const sharing: LocationSharing = myLoc?.sharing ?? 'off';
  const location: MyLocation | undefined =
    deviceLocation ??
    (myLoc?.lat != null && myLoc?.lng != null
      ? { lat: myLoc.lat, lng: myLoc.lng, city: myLoc.city ?? undefined, updatedAt: Date.parse(myLoc.updated_at) }
      : undefined);

  const profile = profileQ.data;
  const me: User = {
    ...(profile ? api.toUser(profile) : { id: myId, ...UNKNOWN_USER, name: 'You' }),
    ...(localAvatar && { photo: localAvatar }),
    lat: location?.lat,
    lng: location?.lng,
  };
  const myCity = location?.city ?? profile?.city ?? '';

  const users = new Map<string, User>();
  for (const u of challengesQ.data?.members ?? []) users.set(u.id, u);
  for (const u of groupsQ.data?.members ?? []) users.set(u.id, u);
  for (const u of postsQ.data?.commentAuthors ?? []) users.set(u.id, u);
  for (const u of [...friendships.incoming, ...friendships.outgoing, ...friendships.friends]) users.set(u.id, u);
  users.set(myId, me);
  const userById = (id: string): User => users.get(id) ?? { id, ...UNKNOWN_USER };
  // Realtime handlers are registered once; they read the latest lookups through refs.
  const usersRef = useRef(userById);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    usersRef.current = userById;
    feedbackRef.current = feedback;
  });

  const state: AppState = {
    posts,
    friendIds: friendships.friends.map((f) => f.id),
    challenges,
    groups,
    profilePhoto: me.photo,
    customBeers,
    location: { sharing, me: location },
  };
  const feed = [...posts].sort((a, b) => b.createdAt - a.createdAt);

  const boards = new Map<string, GroupLeaderboard>();
  groups.forEach((g, i) => {
    const board = groupBoards[i]?.data;
    if (board) boards.set(g.id, board);
  });
  const badgesFor = (ps: Post[], beers: Beer[] = customBeers) =>
    evaluateBadges({
      myId,
      posts: ps,
      friendIds: state.friendIds,
      customBeers: beers,
      groups,
      boards,
      challengesDone: challenges.filter((c) => challengeStatus(c, ps, myId, userById).done).length,
    });
  const badges = badgesFor(posts);

  // ── Optimistic helpers ──
  const updatePosts = (fn: (posts: Post[]) => Post[]) =>
    qc.setQueryData<PostsData>(keys.posts(myId), (old) => ({
      posts: fn(old?.posts ?? []),
      commentAuthors: old?.commentAuthors ?? [],
    }));

  /** Snapshot → apply → server call; restore the snapshot and explain if the server refuses. */
  const optimistic = async (key: QueryKey, apply: () => void, run: () => Promise<unknown>, failure: string) => {
    await qc.cancelQueries({ queryKey: key });
    const snapshot = qc.getQueryData(key);
    apply();
    try {
      await run();
    } catch (e) {
      qc.setQueryData(key, snapshot);
      feedback.toast({ emoji: '⚠️', title: failure, body: e instanceof Error ? e.message : undefined });
    } finally {
      qc.invalidateQueries({ queryKey: key });
    }
  };

  // ── Actions ──
  const addPost = ({ beer, photo, ...input }: NewPost) => {
    const post: Post = {
      ...input,
      ...(beer && { beerId: beer.id, beer: beer.name, brewery: beer.brewery, style: beer.style }),
      id: Crypto.randomUUID(),
      userId: myId,
      createdAt: Date.now(),
      city: myCity,
      photo,
      pending: true,
      reactions: {},
      comments: [],
    };
    const next = [post, ...posts];

    // Celebrate immediately from local data: challenge progress, new cards, level-ups.
    const lines: NonNullable<CelebrationContent['lines']> = [];
    for (const ch of challenges) {
      const before = challengeStatus(ch, posts, myId, userById);
      if (!before.active || !before.joined) continue;
      const after = challengeStatus(ch, next, myId, userById);
      if (after.done && !before.done) {
        lines.push({ emoji: ch.badge.emoji, text: `Challenge complete: ${ch.title}! Badge unlocked`, highlight: true });
      } else if (after.myValue !== before.myValue) {
        lines.push({ emoji: '🏁', text: `${ch.title}: ${formatProgress(ch, after)}` });
      }
    }
    const isNewCustom = !!beer && beer.id.startsWith('custom-') && !customBeers.some((b) => b.id === beer.id);
    const allCustom = isNewCustom ? [...customBeers, beer] : customBeers;
    const cardsBefore = cardsFor(posts, myId, customBeers);
    const cardsAfter = cardsFor(next, myId, allCustom);
    const mainCard = cardsAfter.find((c) => c.beer.id === post.beerId);
    for (const card of cardsAfter) {
      const before = cardsBefore.find((c) => c.beer.id === card.beer.id);
      if (!before) lines.unshift({ emoji: '🃏', text: `New card: ${card.beer.name}!`, highlight: true });
      else if (card.tierIndex > before.tierIndex)
        lines.unshift({ emoji: '⬆️', text: `${card.beer.name} reached ${tierOf(card.level).tier.name}!`, highlight: true });
      else if (card.level > before.level) lines.unshift({ emoji: '🃏', text: `${card.beer.name} card → Lv ${card.level}` });
      else if (card.xp > before.xp && card.beer.id !== post.beerId)
        lines.push({ emoji: '🃏', text: `${card.beer.name} card +½ level (same brewery)` });
      else if (card.xp > before.xp) lines.unshift({ emoji: '🃏', text: `${card.beer.name} card: halfway to Lv ${card.level + 1}` });
    }
    for (const b of newlyUnlocked(badges, badgesFor(next, allCustom))) {
      lines.unshift({ emoji: b.emoji, text: `Badge unlocked: ${b.name}!`, highlight: true });
    }

    feedback.celebrate({
      card: mainCard,
      emoji: post.kind === 'night' ? '🌙' : '🍻',
      title: 'Cheers!',
      subtitle: `Your ${KIND_LABELS[post.kind].label.toLowerCase()} is live for ${state.friendIds.length} friends`,
      lines: lines.slice(0, 4),
    });

    if (isNewCustom) qc.setQueryData<Beer[]>(keys.beers(), (old) => [...(old ?? []), beer]);
    optimistic(
      keys.posts(myId),
      () => updatePosts((ps) => [post, ...ps]),
      async () => {
        if (isNewCustom) await api.ensureCustomBeer(myId, beer);
        await api.createPost(post, photo);
        qc.invalidateQueries({ queryKey: keys.challenges(myId) });
      },
      'Couldn’t share your post'
    );
  };

  const toggleReaction = (postId: string, reaction: Reaction) => {
    feedback.pop();
    const current = posts.find((p) => p.id === postId);
    const on = !(current?.reactions[reaction] ?? []).includes(myId);
    optimistic(
      keys.posts(myId),
      () =>
        updatePosts((ps) =>
          ps.map((p) => {
            if (p.id !== postId) return p;
            const users = p.reactions[reaction] ?? [];
            return {
              ...p,
              reactions: { ...p.reactions, [reaction]: on ? [...users, myId] : users.filter((id) => id !== myId) },
            };
          })
        ),
      () => api.setReaction(postId, reaction, on, myId),
      'Couldn’t save your reaction'
    );
  };

  const addComment = (postId: string, text: string) => {
    feedback.pop();
    const comment = { id: Crypto.randomUUID(), userId: myId, text, createdAt: Date.now() };
    optimistic(
      keys.posts(myId),
      () => updatePosts((ps) => ps.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p))),
      () => api.addComment(comment.id, postId, text),
      'Couldn’t post your comment'
    );
  };

  const setFriendships = (fn: (f: api.Friendships) => api.Friendships) =>
    qc.setQueryData<api.Friendships>(keys.friends(myId), (old) => fn(old ?? { friends: [], incoming: [], outgoing: [] }));

  const sendFriendRequest = (user: User) => {
    feedback.toast({ user, emoji: '👋', title: `Friend request sent to ${user.name}`, body: 'You’ll see their nights once they accept.' });
    optimistic(
      keys.friends(myId),
      () => setFriendships((f) => ({ ...f, outgoing: [...f.outgoing, user] })),
      () => api.sendFriendRequest(myId, user.id),
      'Couldn’t send the request'
    );
  };

  const acceptFriend = (user: User) => {
    feedback.toast({ user, emoji: '🍻', title: `You and ${user.name} are now friends`, body: 'Their nights out now show in your feed.' });
    optimistic(
      keys.friends(myId),
      () => setFriendships((f) => ({ ...f, incoming: f.incoming.filter((u) => u.id !== user.id), friends: [...f.friends, user] })),
      async () => {
        await api.acceptFriendRequest(myId, user.id);
        qc.invalidateQueries({ queryKey: keys.posts(myId) });
      },
      'Couldn’t accept the request'
    );
  };

  const removeFriend = (user: User) => {
    optimistic(
      keys.friends(myId),
      () =>
        setFriendships((f) => ({
          friends: f.friends.filter((u) => u.id !== user.id),
          incoming: f.incoming.filter((u) => u.id !== user.id),
          outgoing: f.outgoing.filter((u) => u.id !== user.id),
        })),
      async () => {
        await api.removeFriendship(myId, user.id);
        qc.invalidateQueries({ queryKey: keys.posts(myId) });
      },
      'Couldn’t update your friends'
    );
  };

  const joinChallenge = (challengeId: string) => {
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge) return;
    feedback.celebrate({
      emoji: '🏁',
      title: 'You’re in!',
      subtitle: challenge.title,
      lines: [{ emoji: challenge.badge.emoji, text: `Finish it to earn “${challenge.badge.name}”` }],
    });
    optimistic(
      keys.challenges(myId),
      () =>
        qc.setQueryData<ChallengesData>(keys.challenges(myId), (old) =>
          old && {
            ...old,
            challenges: old.challenges.map((c) =>
              c.id === challengeId ? { ...c, participantIds: [...c.participantIds, myId], invitedBy: undefined } : c
            ),
          }
        ),
      () => api.joinChallenge(myId, challengeId),
      'Couldn’t join the challenge'
    );
  };

  const startChallenge = async (template: api.ChallengeTemplate, inviteeIds: string[]) => {
    try {
      await api.createChallenge(template, inviteeIds);
      await qc.invalidateQueries({ queryKey: keys.challenges(myId) });
      feedback.celebrate({
        emoji: template.badge.emoji,
        title: 'Challenge on!',
        subtitle: `${template.title} · ${inviteeIds.length} ${inviteeIds.length === 1 ? 'friend' : 'friends'} invited`,
      });
    } catch (e) {
      feedback.toast({ emoji: '⚠️', title: 'Couldn’t start the challenge', body: e instanceof Error ? e.message : undefined });
    }
  };

  const updateGroups = (fn: (groups: Group[]) => Group[]) =>
    qc.setQueryData<GroupsData>(keys.groups(myId), (old) => ({ groups: fn(old?.groups ?? []), members: old?.members ?? [] }));
  const patchGroup = (groupId: string, patch: Partial<Group>) =>
    updateGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));

  const createGroup = async ({ name, memberIds, photo }: { name: string; memberIds: string[]; photo?: string }) => {
    try {
      await api.createGroup(myId, name, memberIds, photo);
      await qc.invalidateQueries({ queryKey: keys.groups(myId) });
      feedback.celebrate({
        emoji: '👯',
        title: 'Group created!',
        subtitle: `${name} · ${memberIds.length + 1} ${memberIds.length ? 'people' : 'person'}`,
        lines: [{ emoji: '🏆', text: 'Post beers to climb the group leaderboard' }],
      });
      return true;
    } catch (e) {
      feedback.toast({ emoji: '⚠️', title: 'Couldn’t create the group', body: e instanceof Error ? e.message : undefined });
      return false;
    }
  };

  const renameGroup = (groupId: string, name: string) => {
    optimistic(
      keys.groups(myId),
      () => patchGroup(groupId, { name }),
      () => api.updateGroup(groupId, { name }),
      'Couldn’t rename the group'
    );
  };

  const setGroupPhoto = (groupId: string, uri: string) => {
    feedback.pop();
    optimistic(
      keys.groups(myId),
      () => patchGroup(groupId, { photo: uri }),
      () => api.uploadGroupPhoto(myId, groupId, uri),
      'Couldn’t update the group photo'
    );
  };

  const addGroupMembers = (groupId: string, memberIds: string[]) => {
    feedback.pop();
    optimistic(
      keys.groups(myId),
      () =>
        updateGroups((gs) =>
          gs.map((g) => (g.id === groupId ? { ...g, memberIds: [...new Set([...g.memberIds, ...memberIds])] } : g))
        ),
      async () => {
        await api.addGroupMembers(groupId, memberIds);
        qc.invalidateQueries({ queryKey: ['groupBoard', groupId] });
      },
      'Couldn’t add to the group'
    );
  };

  const leaveGroup = (groupId: string) => {
    optimistic(
      keys.groups(myId),
      () => updateGroups((gs) => gs.filter((g) => g.id !== groupId)),
      () => api.leaveGroup(myId, groupId),
      'Couldn’t leave the group'
    );
  };

  const closeTutorial = () => {
    setTutorialReplay(false);
    if (profile?.tutorial_seen !== false) return;
    qc.setQueryData<api.MyProfileRow>(keys.profile(myId), (old) => old && { ...old, tutorial_seen: true });
    // If this fails the tutorial just shows again next launch; not worth bothering the user.
    api.updateProfile(myId, { tutorial_seen: true }).catch(() => {});
  };

  const setProfilePhoto = (uri: string) => {
    setLocalAvatar(uri);
    feedback.pop();
    api
      .uploadAvatar(myId, uri)
      .then(() => qc.invalidateQueries({ queryKey: keys.profile(myId) }))
      .catch((e) => {
        setLocalAvatar(undefined);
        feedback.toast({ emoji: '⚠️', title: 'Couldn’t update your photo', body: e instanceof Error ? e.message : undefined });
      });
  };

  const updateProfile = async (patch: { name?: string; city?: string }) => {
    await api.updateProfile(myId, patch);
    await qc.invalidateQueries({ queryKey: keys.profile(myId) });
  };

  const refreshMyLocation = async (options?: { silent?: boolean }) => {
    const result = await getMyLocation(options);
    if (!result.ok) return null;
    setDeviceLocation(result.location);
    // Keep what friends see up to date while sharing is on.
    if (sharing !== 'off') api.publishLocation(myId, sharing, result.location).catch(() => {});
    return result.location;
  };

  const setSharing = async (mode: LocationSharing) => {
    let loc = location;
    if (mode !== 'off') {
      loc = (await refreshMyLocation()) ?? undefined;
      if (!loc) {
        feedback.toast({ emoji: '📍', title: 'Location is off', body: 'Allow location access in Settings to share where you are.' });
        return;
      }
    }
    feedback.select();
    await optimistic(
      keys.myLocation(myId),
      () =>
        qc.setQueryData(keys.myLocation(myId), {
          user_id: myId,
          sharing: mode,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          city: loc?.city ?? null,
          updated_at: new Date().toISOString(),
        }),
      () => api.publishLocation(myId, mode, loc),
      'Couldn’t update location sharing'
    );
  };

  const refresh = async () => {
    await Promise.all(
      [keys.posts(myId), keys.friends(myId), keys.challenges(myId), keys.groups(myId), ['groupBoard'], keys.profile(myId)].map((queryKey) =>
        qc.invalidateQueries({ queryKey })
      )
    );
  };

  // ── Push token: register once per session (no-op until the app has an EAS project id) ──
  useEffect(() => {
    getPushToken().then((token) => {
      if (token) api.savePushToken(myId, token).catch(() => {});
    });
  }, [myId]);

  // ── Realtime: refresh caches and announce what friends do ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();
    const invalidateSoon = (...names: Exclude<keyof typeof keys, 'beers' | 'myLocation' | 'profile'>[]) => {
      names.forEach((n) => pending.add(n));
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        for (const n of pending) qc.invalidateQueries({ queryKey: [n] });
        pending.clear();
      }, 400);
    };
    const toast = (content: ToastContent) => feedbackRef.current.toast(content);
    const person = (id: string) => usersRef.current(id);
    const myPost = (postId: string) =>
      qc.getQueryData<PostsData>(keys.posts(myId))?.posts.find((p) => p.id === postId && p.userId === myId);

    const channel = supabase
      .channel(`cheers-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        invalidateSoon('posts');
        const row = payload.new as { post_id?: string; user_id?: string; emoji?: string };
        const post = row.post_id ? myPost(row.post_id) : undefined;
        if (payload.eventType === 'INSERT' && row.user_id && row.user_id !== myId && post) {
          const user = person(row.user_id);
          toast({ user, emoji: row.emoji, title: `${user.name} reacted ${row.emoji}`, body: postHeadline(post) });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        invalidateSoon('posts');
        const row = payload.new as { post_id: string; user_id: string; text: string };
        if (row.user_id !== myId && myPost(row.post_id)) {
          const user = person(row.user_id);
          toast({ user, emoji: '💬', title: `${user.name} commented`, body: row.text });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        invalidateSoon('posts', 'challenges', 'groupBoard');
        const row = payload.new as { user_id: string; kind: Post['kind'] };
        if (row.user_id !== myId) {
          const user = person(row.user_id);
          toast({
            user,
            emoji: KIND_LABELS[row.kind].emoji,
            title: `${user.name} just posted`,
            body: `A new ${KIND_LABELS[row.kind].label.toLowerCase()}`,
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
        invalidateSoon('friends', 'posts');
        const row = payload.new as { requester_id?: string; addressee_id?: string; status?: string };
        if (payload.eventType === 'INSERT' && row.addressee_id === myId) {
          toast({ emoji: '👋', title: 'New friend request', body: 'Open the Map tab to accept' });
        } else if (payload.eventType === 'UPDATE' && row.requester_id === myId && row.status === 'accepted') {
          toast({ emoji: '🍻', title: 'Friend request accepted', body: 'Their nights now show in your feed' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, (payload) => {
        invalidateSoon('challenges');
        const row = payload.new as { user_id?: string; status?: string };
        if (payload.eventType === 'INSERT' && row.user_id === myId && row.status === 'invited') {
          toast({ emoji: '🏁', title: 'You’ve been invited to a challenge', body: 'Open Challenges to join' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => invalidateSoon('groups'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, (payload) => {
        invalidateSoon('groups', 'groupBoard');
        const row = payload.new as { user_id?: string; added_by?: string };
        if (payload.eventType === 'INSERT' && row.user_id === myId && row.added_by && row.added_by !== myId) {
          const user = person(row.added_by);
          toast({ user, emoji: '👯', title: `${user.name} added you to a group`, body: 'Open Challenges to see the leaderboard' });
        }
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [myId, qc]);

  return (
    <StoreContext.Provider
      value={{
        myId,
        me,
        state,
        feed,
        userById,
        friends: friendships.friends,
        incomingRequests: friendships.incoming,
        outgoingRequests: friendships.outgoing,
        badges,
        loading: postsQ.isPending && !postsQ.data,
        profileStatus: !profile ? 'loading' : profile.name ? 'ready' : 'needsOnboarding',
        addPost,
        setProfilePhoto,
        updateProfile,
        toggleReaction,
        addComment,
        sendFriendRequest,
        acceptFriend,
        removeFriend,
        joinChallenge,
        startChallenge,
        createGroup,
        renameGroup,
        setGroupPhoto,
        addGroupMembers,
        leaveGroup,
        tutorialOpen: tutorialReplay || (!!profile?.name && profile.tutorial_seen === false),
        openTutorial: () => setTutorialReplay(true),
        closeTutorial,
        refresh,
        signOut,
        myCity,
        refreshMyLocation,
        setSharing,
        draftVenue,
        setDraftVenue,
        mapFocus,
        setMapFocus,
      }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

/** Challenge status for the signed-in user (wraps challengeStatus with the store's context). */
export function useChallengeStatus() {
  const { state, myId, userById } = useStore();
  return (challenge: Challenge) => challengeStatus(challenge, state.posts, myId, userById);
}

export function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 24 * hour) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / (24 * hour))}d ago`;
}
