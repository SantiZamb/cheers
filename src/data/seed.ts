import type { ChallengeTemplate } from '@/data/api';
import type { PostKind } from '@/data/types';

export const KIND_LABELS: Record<PostKind, { emoji: string; label: string }> = {
  beer: { emoji: '🍺', label: 'Beer' },
  night: { emoji: '🌙', label: 'Night out' },
  checkin: { emoji: '📍', label: 'Check-in' },
};

/** Challenges a user can start and invite friends to. */
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'new-beers',
    title: 'Three new beers',
    description: 'Everyone tries three beers they’ve never had this week.',
    kind: 'newBeers',
    goal: 3,
    days: 7,
    badge: { emoji: '🧭', name: 'Beer Explorer' },
  },
  {
    id: 'two-nights',
    title: 'Two nights out',
    description: 'Post two night-out recaps this week.',
    kind: 'nights',
    goal: 2,
    days: 7,
    badge: { emoji: '🌙', name: 'Night Owl' },
  },
  {
    id: 'best-pour',
    title: 'Weekend’s best pour',
    description: 'Rate a beer this weekend. Highest rating takes the crown.',
    kind: 'topRated',
    goal: 1,
    days: 3,
    badge: { emoji: '👑', name: 'Best Pour' },
  },
  {
    id: 'globe',
    title: 'Cheers across the globe',
    description: 'Together, check in from three different cities this week.',
    kind: 'cities',
    goal: 3,
    days: 7,
    badge: { emoji: '🌍', name: 'Globetrotters' },
  },
];
