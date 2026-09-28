import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { challengeStatus, formatProgress } from '@/data/challenges';
import { clearPhotos, loadState, persistPhoto, saveState } from '@/data/persistence';
import {
  createSeedState,
  FRIEND_COMMENTS,
  FRIEND_POST_POOL,
  KIND_LABELS,
  ME,
  ME_ID,
  poolPost,
  USERS,
} from '@/data/seed';
import type { AppState, LocationSharing, MyLocation, Post, Reaction } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import type { CelebrationContent } from '@/feedback/celebration';
import { getMyLocation } from '@/lib/location';
import { cancelScheduledNotifications, ensureNotificationPermission, notifyLater } from '@/lib/notifications';

export type NewPost = Pick<
  Post,
  'kind' | 'photo' | 'rating' | 'beer' | 'brewery' | 'style' | 'title' | 'beersCount' | 'venue' | 'note'
>;

type Store = {
  state: AppState;
  /** Posts from the user and their friends, newest first. */
  feed: Post[];
  addPost: (input: NewPost) => void;
  toggleReaction: (postId: string, reaction: Reaction) => void;
  addComment: (postId: string, text: string) => void;
  addFriend: (userId: string) => void;
  joinChallenge: (challengeId: string) => void;
  /** Reveals the next simulated friend post. Returns false when there are none left. */
  refreshFeed: () => boolean;
  resetDemo: () => void;
  /** City posts are tagged with: from the device location when known. */
  myCity: string;
  /** Fetches the device location (asking permission unless `silent`). Null if unavailable. */
  refreshMyLocation: (options?: { silent?: boolean }) => Promise<MyLocation | null>;
  setSharing: (mode: LocationSharing) => Promise<void>;
  /** Venue to prefill on the Share screen, e.g. after tapping "Check in" on a bar. */
  draftVenue: string | null;
  setDraftVenue: (venue: string | null) => void;
  /** Friend the Map tab should center on next time it's shown. */
  mapFocus: string | null;
  setMapFocus: (friendId: string | null) => void;
};

const StoreContext = createContext<Store | null>(null);

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export function postHeadline(post: Post) {
  if (post.kind === 'beer') return post.beer ?? 'a beer';
  if (post.kind === 'night') return post.title ?? 'your night out';
  return post.venue ? `your check-in at ${post.venue}` : 'your check-in';
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const feedback = useFeedback();
  const [state, setState] = useState(loadState);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const invitedNudged = useRef(false);
  const [draftVenue, setDraftVenue] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const myCity = state.location.me?.city ?? ME.city;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (seconds: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, seconds * 1000));
  };

  const updatePost = (postId: string, fn: (post: Post) => Post) =>
    setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? fn(p) : p)) }));

  /** Friends react and comment on a new post over the next few seconds (and via notifications if the app is closed). */
  const simulateFriendResponses = (post: Post) => {
    const [a, b, c] = shuffle(state.friendIds);
    const headline = postHeadline(post);
    const events = [
      { seconds: 4, userId: a, reaction: '🍻' as Reaction },
      { seconds: 9, userId: b ?? a, reaction: (post.kind === 'night' ? '🔥' : '🤤') as Reaction },
      { seconds: 15, userId: c ?? a, comment: pick(FRIEND_COMMENTS[post.kind]) },
    ];

    for (const event of events) {
      const friend = USERS[event.userId];
      const title = event.comment
        ? `${friend.name} commented on ${headline}`
        : `${friend.name} reacted ${event.reaction} to ${headline}`;
      const body = event.comment ?? `Cheers from ${friend.city}!`;

      notifyLater(`${friend.avatar} ${title}`, body, event.seconds, '/');
      later(event.seconds, () => {
        updatePost(post.id, (p) =>
          event.comment
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  { id: `c${Date.now()}`, userId: friend.id, text: event.comment, createdAt: Date.now() },
                ],
              }
            : {
                ...p,
                reactions: {
                  ...p.reactions,
                  [event.reaction!]: [...(p.reactions[event.reaction!] ?? []), friend.id],
                },
              }
        );
        feedback.toast({ emoji: event.comment ? '💬' : event.reaction!, title, body });
      });
    }

    // A pending invite gets a nudge a bit later, to pull the user into challenges.
    const invite = state.challenges.find(
      (ch) => ch.invitedBy && !ch.participantIds.includes(ME_ID) && Date.now() < ch.endsAt
    );
    if (invite && !invitedNudged.current) {
      invitedNudged.current = true;
      const from = USERS[invite.invitedBy!];
      const title = `${from.name} invited you to “${invite.title}”`;
      notifyLater(`🏁 ${title}`, invite.description, 25, '/challenges');
      later(25, () => feedback.toast({ emoji: '🏁', title, body: 'Open Challenges to join' }));
    }
  };

  const addPost = (input: NewPost) => {
    const post: Post = {
      ...input,
      photo: input.photo ? persistPhoto(input.photo) : undefined,
      id: `p${Date.now()}`,
      userId: ME_ID,
      createdAt: Date.now(),
      city: myCity,
      reactions: {},
      comments: [],
    };
    const next: AppState = { ...state, posts: [post, ...state.posts] };

    // Work out which of the user's active challenges this post moved forward.
    const lines: NonNullable<CelebrationContent['lines']> = [];
    for (const ch of state.challenges) {
      const before = challengeStatus(ch, state.posts);
      if (!before.active || !before.joined) continue;
      const after = challengeStatus(ch, next.posts);
      if (after.done && !before.done) {
        lines.push({ emoji: ch.badge.emoji, text: `Challenge complete: ${ch.title}! Badge unlocked`, highlight: true });
      } else if (after.myValue !== before.myValue) {
        lines.push({ emoji: '🏁', text: `${ch.title}: ${formatProgress(ch, after)}` });
      }
    }

    setState(next);
    const kind = KIND_LABELS[post.kind];
    feedback.celebrate({
      emoji: post.kind === 'night' ? '🌙' : '🍻',
      title: 'Cheers!',
      subtitle: `Your ${kind.label.toLowerCase()} is live for ${state.friendIds.length} friends`,
      lines,
    });

    ensureNotificationPermission().finally(() => simulateFriendResponses(post));
  };

  const toggleReaction = (postId: string, reaction: Reaction) => {
    feedback.pop();
    updatePost(postId, (p) => {
      const users = p.reactions[reaction] ?? [];
      const mine = users.includes(ME_ID);
      return {
        ...p,
        reactions: {
          ...p.reactions,
          [reaction]: mine ? users.filter((id) => id !== ME_ID) : [...users, ME_ID],
        },
      };
    });
  };

  const addComment = (postId: string, text: string) => {
    feedback.pop();
    updatePost(postId, (p) => ({
      ...p,
      comments: [...p.comments, { id: `c${Date.now()}`, userId: ME_ID, text, createdAt: Date.now() }],
    }));
  };

  const addFriend = (userId: string) => {
    if (state.friendIds.includes(userId)) return;
    setState((s) => ({ ...s, friendIds: [...s.friendIds, userId] }));
    const friend = USERS[userId];
    feedback.toast({
      emoji: friend.avatar,
      title: `You and ${friend.name} are now friends`,
      body: `Their nights out in ${friend.city} will show up in your feed.`,
    });
  };

  const joinChallenge = (challengeId: string) => {
    const challenge = state.challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.participantIds.includes(ME_ID)) return;
    setState((s) => ({
      ...s,
      challenges: s.challenges.map((c) =>
        c.id === challengeId
          ? { ...c, participantIds: [...c.participantIds, ME_ID], invitedBy: undefined }
          : c
      ),
    }));
    feedback.celebrate({
      emoji: '🏁',
      title: 'You’re in!',
      subtitle: challenge.title,
      lines: [{ emoji: challenge.badge.emoji, text: `Finish it to earn “${challenge.badge.name}”` }],
    });
  };

  const refreshFeed = () => {
    const index = state.nextPoolIndex;
    if (index >= FRIEND_POST_POOL.length) return false;
    const post = poolPost(index, Date.now());
    const friendId = post.userId;
    setState((s) => ({
      ...s,
      posts: [post, ...s.posts],
      nextPoolIndex: s.nextPoolIndex + 1,
      // Make sure the author is a friend so the post is visible.
      friendIds: s.friendIds.includes(friendId) ? s.friendIds : [...s.friendIds, friendId],
    }));
    const friend = USERS[friendId];
    feedback.toast({
      emoji: friend.avatar,
      title: `${friend.name} just posted from ${friend.city}`,
      body: postHeadline(post),
    });
    return true;
  };

  const refreshMyLocation = async (options?: { silent?: boolean }) => {
    const result = await getMyLocation(options);
    if (!result.ok) return null;
    setState((s) => ({ ...s, location: { ...s.location, me: result.location } }));
    return result.location;
  };

  const setSharing = async (mode: LocationSharing) => {
    const wasOff = state.location.sharing === 'off';
    if (mode !== 'off') {
      const loc = await refreshMyLocation();
      if (!loc) {
        feedback.toast({
          emoji: '📍',
          title: 'Location is off',
          body: 'Allow location access in Settings to share where you are.',
        });
        return;
      }
    }
    setState((s) => ({ ...s, location: { ...s.location, sharing: mode } }));
    feedback.select();

    // Friends notice when you go live.
    if (wasOff && mode !== 'off' && state.friendIds.length > 0) {
      const friend = USERS[pick(state.friendIds)];
      const city = state.location.me?.city ?? ME.city;
      later(5, () =>
        feedback.toast({
          emoji: '👀',
          title: `${friend.name} sees you're out in ${city}`,
          body: `“Save me a seat!” from ${friend.city}`,
        })
      );
    }
  };

  const resetDemo = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelScheduledNotifications();
    clearPhotos();
    setState(createSeedState());
  };

  const visible = new Set([ME_ID, ...state.friendIds]);
  const feed = state.posts
    .filter((p) => visible.has(p.userId))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <StoreContext.Provider
      value={{
        state,
        feed,
        addPost,
        toggleReaction,
        addComment,
        addFriend,
        joinChallenge,
        refreshFeed,
        resetDemo,
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

export function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 24 * hour) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / (24 * hour))}d ago`;
}
