import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { useOutNow } from '@/components/friends-panel';
import { GradientButton } from '@/components/gradient-button';
import { PostCard } from '@/components/post-card';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { fetchGroupLeaderboard } from '@/data/api';
import { keys, useStore } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';

export default function FeedScreen() {
  const { feed, friends, refresh, loading } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const cities = new Set(friends.map((f) => f.city).filter(Boolean)).size;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) =>
          index < 4 ? (
            <Animated.View entering={FadeInDown.delay(index * 40).duration(200)}>
              <PostCard post={item} />
            </Animated.View>
          ) : (
            <PostCard post={item} />
          )
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={loading ? null : <EmptyFeed hasFriends={friends.length > 0} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              overline="Tonight"
              title="Cheers"
              subtitle={
                friends.length
                  ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}${cities ? ` · ${cities} ${cities === 1 ? 'city' : 'cities'}` : ''}`
                  : 'Add friends to see their nights'
              }
            />
            <OutNow />
            <GroupBanner />
          </View>
        }
      />
    </Screen>
  );
}

function EmptyFeed({ hasFriends }: { hasFriends: boolean }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyEmoji}>🍻</Text>
      <ThemedText type="defaultSemiBold" style={styles.center}>
        {hasFriends ? 'Quiet night so far' : 'Your feed is waiting'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {hasFriends
          ? 'Be the first to share what you’re drinking tonight.'
          : 'Add friends from the Map tab, then share your first beer.'}
      </ThemedText>
      <GradientButton label="Share a beer" onPress={() => router.navigate('/post')} style={styles.stretch} />
      {!hasFriends && (
        <Pressable onPress={() => router.navigate('/map')} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="accentEnd">
            Find friends →
          </ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

/** Stories-style row of friends; tapping one shows them on the map. */
function OutNow() {
  const theme = useTheme();
  const { friends: all, setMapFocus } = useStore();
  const isOut = useOutNow();
  const friends = [...all].sort((a, b) => Number(isOut(b.id)) - Number(isOut(a.id)));
  if (!friends.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
      {friends.map((f) => {
        const out = isOut(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => {
              setMapFocus(f.id);
              router.navigate('/map');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Show ${f.name} on the map`}
            style={styles.story}>
            <LinearGradient
              colors={out ? [theme.accent, theme.accentEnd] : [theme.border, theme.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.storyRing}>
              <View style={[styles.storyInner, { borderColor: theme.background }]}>
                <Avatar user={f} size={53} />
              </View>
            </LinearGradient>
            <ThemedText type="small" numberOfLines={1} themeColor={out ? 'text' : 'textSecondary'}>
              {f.name}
            </ThemedText>
            <ThemedText type="small" style={styles.storyCity} themeColor={out ? 'accentEnd' : 'textSecondary'}>
              {out ? 'out now' : f.city}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Where you stand in your newest group this month, one tap from its page. */
function GroupBanner() {
  const theme = useTheme();
  const { state, myId } = useStore();
  const group = state.groups[0];
  const board = useQuery({
    queryKey: keys.groupBoard(group?.id ?? '', 'month'),
    queryFn: () => fetchGroupLeaderboard(group!.id, 'month'),
    enabled: !!group,
    staleTime: 30 * 1000,
  });
  if (!group) return null;

  const standings = [...(board.data?.standings ?? [])].sort((a, b) => b.beers - a.beers);
  const rank = standings.findIndex((s) => s.userId === myId);
  const mine = standings[rank];
  const line = !board.data
    ? `${group.memberIds.length} members`
    : !mine?.beers
      ? 'No beers from you this month yet. Get on the board!'
      : rank === 0
        ? `You lead with ${mine.beers} ${mine.beers === 1 ? 'beer' : 'beers'} this month 👑`
        : `You’re #${rank + 1} with ${mine.beers} ${mine.beers === 1 ? 'beer' : 'beers'} this month`;

  return (
    <Pressable
      onPress={() => router.navigate({ pathname: '/groups/[id]', params: { id: group.id } })}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button">
      <LinearGradient
        colors={[theme.accent, theme.accentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}>
        <Avatar user={{ id: group.id, name: group.name, username: '', city: '', photo: group.photo }} size={40} />
        <View style={styles.flex}>
          <ThemedText type="overline" style={[styles.onAccent, { color: theme.onAccent }]}>
            Your group
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color: theme.onAccent }} numberOfLines={1}>
            {group.name}
          </ThemedText>
          <ThemedText type="small" style={[styles.onAccent, { color: theme.onAccent }]} numberOfLines={1}>
            {line}
          </ThemedText>
        </View>
        <ThemedText type="subtitle" style={{ color: theme.onAccent }}>
          ›
        </ThemedText>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  stories: {
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  story: {
    alignItems: 'center',
    width: 64,
  },
  storyRing: {
    padding: 2.5,
    borderRadius: 32,
    marginBottom: Spacing.one,
  },
  storyInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyCity: {
    fontSize: 11,
    lineHeight: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  onAccent: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.85,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  center: {
    textAlign: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
});
