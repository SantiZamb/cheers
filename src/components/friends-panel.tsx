import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { GradientButton } from '@/components/gradient-button';
import { PostCard } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { KIND_LABELS, ME, ME_ID, USERS } from '@/data/seed';
import { postHeadline, timeAgo, useStore } from '@/data/store';
import type { LocationSharing, User } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { useTheme } from '@/hooks/use-theme';

const OUT_NOW_MS = 3 * 60 * 60 * 1000;

/** Whether a friend posted recently enough to count as "out now". */
export function useOutNow() {
  const { state } = useStore();
  return (userId: string) =>
    state.posts.some((p) => p.userId === userId && Date.now() - p.createdAt < OUT_NOW_MS);
}

export function FriendsPanel({
  focusedId,
  onFocus,
}: {
  focusedId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const theme = useTheme();
  const { state, addFriend } = useStore();
  const isOut = useOutNow();
  const [query, setQuery] = useState('');

  const friends = state.friendIds
    .map((id) => USERS[id])
    .sort((a, b) => Number(isOut(b.id)) - Number(isOut(a.id)));
  const q = query.trim().toLowerCase();
  const suggestions = Object.values(USERS).filter(
    (u) =>
      u.id !== ME_ID &&
      !state.friendIds.includes(u.id) &&
      (!q || u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q))
  );

  return (
    <View style={styles.gap}>
      <SharingCard />

      <View style={styles.sectionHead}>
        <ThemedText type="defaultSemiBold">Your crew</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {friends.filter((f) => isOut(f.id)).length} out now
        </ThemedText>
      </View>
      {friends.map((f) => (
        <Animated.View key={f.id} layout={LinearTransition.duration(200)}>
          <FriendRow
            friend={f}
            open={focusedId === f.id}
            onToggle={() => onFocus(focusedId === f.id ? null : f.id)}
          />
        </Animated.View>
      ))}

      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        Add friends
      </ThemedText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or city"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
      />
      {suggestions.map((u) => (
        <Animated.View key={u.id} layout={LinearTransition.duration(200)} entering={FadeIn.duration(150)}>
          <Card style={styles.row}>
            <Avatar user={u} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{u.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {u.city}
              </ThemedText>
            </View>
            <GradientButton size="sm" label="Add" onPress={() => addFriend(u.id)} accessibilityLabel={`Add ${u.name}`} />
          </Card>
        </Animated.View>
      ))}
      {suggestions.length === 0 && q ? (
        <ThemedText type="small" themeColor="textSecondary">
          No one matching “{query}”.
        </ThemedText>
      ) : null}
    </View>
  );
}

const SHARING_OPTIONS: { id: LocationSharing; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'city', label: 'City only' },
  { id: 'precise', label: 'Exact spot' },
];

function SharingCard() {
  const theme = useTheme();
  const { state, setSharing, myCity } = useStore();
  const [busy, setBusy] = useState(false);
  const { sharing, me } = state.location;

  const status =
    sharing === 'off'
      ? 'Hidden. Friends can’t see where you are.'
      : sharing === 'city'
        ? `${state.friendIds.length} friends see you’re in ${myCity}.`
        : `${state.friendIds.length} friends see your exact spot${me ? ` · updated ${timeAgo(me.updatedAt)}` : ''}.`;

  return (
    <Card>
      <View style={styles.sharingHead}>
        <View style={[styles.liveDot, { backgroundColor: sharing === 'off' ? theme.border : theme.accentEnd }]} />
        <View style={styles.flex}>
          <ThemedText type="defaultSemiBold">Share my location</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {busy ? 'Finding you…' : status}
          </ThemedText>
        </View>
      </View>
      <View style={styles.segment}>
        {SHARING_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            large
            label={o.label}
            selected={sharing === o.id}
            onPress={async () => {
              if (busy || o.id === sharing) return;
              setBusy(true);
              await setSharing(o.id);
              setBusy(false);
            }}
          />
        ))}
      </View>
    </Card>
  );
}

function FriendRow({ friend, open, onToggle }: { friend: User; open: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const { state } = useStore();
  const feedback = useFeedback();
  const isOut = useOutNow();
  const posts = state.posts
    .filter((p) => p.userId === friend.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const latest = posts[0];
  const rated = posts.filter((p) => p.kind === 'beer' && p.rating);
  const avg = rated.length ? (rated.reduce((s, p) => s + p.rating!, 0) / rated.length).toFixed(1) : '–';
  const me = state.location.me ?? ME;
  const away = formatDistance(distanceMeters(me, friend));
  const out = isOut(friend.id);

  return (
    <Card style={[styles.friendCard, open && { borderColor: theme.accent }]}>
      <Pressable onPress={onToggle} style={styles.rowInner} accessibilityRole="button">
        <View>
          <Avatar user={friend} />
          {out && <View style={[styles.outBadge, { backgroundColor: theme.accentEnd, borderColor: theme.backgroundElement }]} />}
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {friend.name}
            <ThemedText type="small" themeColor="textSecondary">
              {'  '}
              {friend.city} · {away}
            </ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor={out ? 'accentEnd' : 'textSecondary'} numberOfLines={1}>
            {latest
              ? `${out ? 'Out now · ' : ''}${KIND_LABELS[latest.kind].emoji} ${postHeadline(latest)} · ${timeAgo(latest.createdAt)}`
              : 'No posts yet'}
          </ThemedText>
        </View>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.expanded}>
          <View style={styles.stats}>
            <MiniStat label="Posts" value={String(posts.length)} />
            <MiniStat label="Avg rating" value={avg} />
            <MiniStat label="Away" value={away} />
          </View>
          <Pressable
            onPress={() =>
              feedback.toast({ emoji: '👋', title: `You nudged ${friend.name}`, body: `“Beer later?” sent to ${friend.city}` })
            }
            style={({ pressed }) => [styles.nudge, { borderColor: theme.border }, pressed && styles.pressed]}
            accessibilityRole="button">
            <ThemedText type="smallBold">👋 Nudge for a beer</ThemedText>
          </Pressable>
          {latest ? <PostCard post={latest} /> : null}
        </Animated.View>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  sharingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  segment: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  search: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  friendCard: {
    paddingVertical: Spacing.two + Spacing.one,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  outBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  expanded: {
    gap: Spacing.three,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.sm,
  },
  nudge: {
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
