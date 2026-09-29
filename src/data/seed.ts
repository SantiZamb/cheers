import type { PostKind } from '@/data/types';

export const KIND_LABELS: Record<PostKind, { emoji: string; label: string }> = {
  beer: { emoji: '🍺', label: 'Beer' },
  night: { emoji: '🌙', label: 'Night out' },
  checkin: { emoji: '📍', label: 'Check-in' },
};
