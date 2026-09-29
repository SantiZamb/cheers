import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { GradientButton } from '@/components/gradient-button';
import { PostCard } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { searchProfiles } from '@/data/api';
import { KIND_LABELS } from '@/data/seed';
import { postHeadline, timeAgo, useStore } from '@/data/store';
import type { LocationSharing, User } from '@/data/types';
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
  onSearchFocus,
  onSearchBlur,
}: {
  focusedId: string | null;
  onFocus: (id: string | null) => void;
  /** Called with the search box's offset in the panel, so the screen can make room and scroll to it. */
  onSearchFocus?: (y: number) => void;
  onSearchBlur?: (query: string) => void;
}) {
  const theme = useTheme();
  const { myId, friends: all, incomingRequests, outgoingRequests, sendFriendRequest, acceptFriend, removeFriend } =
    useStore();
  const isOut = useOutNow();
  const [query, setQuery] = useState('');
  const [searchY, setSearchY] = useState(0);
  const q = query.trim();

  // Server-side people search; results are cached per query, so retyping is instant.
  const search = useQuery({
    queryKey: ['profileSearch', q],
    queryFn: () => searchProfiles(q, myId),
    enabled: q.length >= 2,
    staleTime: 60 * 1000,
  });
  const known = new Set([...all, ...incomingRequests, ...outgoingRequests].map((u) => u.id));
  const results = (search.data ?? []).filter((u) => !known.has(u.id));

  const friends = [...all].sort((a, b) => Number(isOut(b.id)) - Number(isOut(a.id)));

  return (
    <View style={styles.gap}>
      <SharingCard />

      {incomingRequests.length > 0 && (
        <>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Friend requests
          </ThemedText>
          {incomingRequests.map((u) => (
            <Animated.View key={u.id} layout={LinearTransition.duration(200)} entering={FadeIn.duration(150)}>
              <Card style={styles.row}>
                <Avatar user={u} />
                <PersonText user={u} />
                <Pressable onPress={() => removeFriend(u)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Decline ${u.name}`}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Decline
                  </ThemedText>
                </Pressable>
                <GradientButton size="sm" label="Accept" onPress={() => acceptFriend(u)} accessibilityLabel={`Accept ${u.name}`} />
              </Card>
            </Animated.View>
          ))}
        </>
      )}

      <View style={styles.sectionHead}>
        <ThemedText type="defaultSemiBold">Your crew</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {friends.length ? `${friends.filter((f) => isOut(f.id)).length} out now` : ''}
        </ThemedText>
      </View>
      {friends.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No friends yet. Search below to find people you know.
        </ThemedText>
      )}
      {friends.map((f) => (
        <Animated.View key={f.id} layout={LinearTransition.duration(200)}>
          <FriendRow
            friend={f}
            open={focusedId === f.id}
            onToggle={() => onFocus(focusedId === f.id ? null : f.id)}
          />
        </Animated.View>
      ))}

      <View style={styles.searchBlock} onLayout={(e) => setSearchY(e.nativeEvent.layout.y)}>
        <ThemedText type="defaultSemiBold">Add friends</ThemedText>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => onSearchFocus?.(searchY)}
          onBlur={() => onSearchBlur?.(query)}
          placeholder="Search by name, @username or city"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[styles.search, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
        />
      </View>
      {outgoingRequests.map((u) => (
        <Card key={u.id} style={styles.row}>
          <Avatar user={u} />
          <PersonText user={u} />
          <Pressable onPress={() => removeFriend(u)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="textSecondary">
              Requested · Cancel
            </ThemedText>
          </Pressable>
        </Card>
      ))}
      {results.map((u) => (
        <Animated.View key={u.id} layout={LinearTransition.duration(200)} entering={FadeIn.duration(150)}>
          <Card style={styles.row}>
            <Avatar user={u} />
            <PersonText user={u} />
            <GradientButton size="sm" label="Add" onPress={() => sendFriendRequest(u)} accessibilityLabel={`Add ${u.name}`} />
          </Card>
        </Animated.View>
      ))}
      {q.length >= 2 && search.isSuccess && results.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No one matching “{q}”.
        </ThemedText>
      ) : null}
      {q.length > 0 && q.length < 2 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Keep typing…
        </ThemedText>
      ) : null}
    </View>
  );
}

function PersonText({ user }: { user: User }) {
  return (
    <View style={styles.flex}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {user.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        @{user.username}
        {user.city ? ` · ${user.city}` : ''}
      </ThemedText>
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
  const { state, me, removeFriend } = useStore();
  const isOut = useOutNow();
  const posts = state.posts
    .filter((p) => p.userId === friend.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const latest = posts[0];
  const rated = posts.filter((p) => p.kind === 'beer' && p.rating);
  const avg = rated.length ? (rated.reduce((s, p) => s + p.rating!, 0) / rated.length).toFixed(1) : '–';
  // Distance only when both of you are sharing a position.
  const away =
    me.lat != null && me.lng != null && friend.lat != null && friend.lng != null
      ? formatDistance(distanceMeters({ lat: me.lat, lng: me.lng }, { lat: friend.lat, lng: friend.lng }))
      : null;
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
              {[friend.city, away && `${away} away`].filter(Boolean).join(' · ')}
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
            <MiniStat label="Away" value={away ?? 'Hidden'} />
          </View>
          {latest ? <PostCard post={latest} /> : null}
          <Pressable
            onPress={() =>
              Alert.alert(`Remove ${friend.name}?`, 'You’ll stop seeing each other’s posts and locations.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeFriend(friend) },
              ])
            }
            style={styles.removeLink}
            accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              Remove friend
            </ThemedText>
          </Pressable>
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
  searchBlock: {
    gap: Spacing.three,
    marginTop: Spacing.two,
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
  removeLink: {
    alignSelf: 'center',
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.75,
  },
});
