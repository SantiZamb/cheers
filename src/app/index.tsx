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
import { formatProgress, timeLeft } from '@/data/challenges';
import { useChallengeStatus, useStore } from '@/data/store';
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
            <ChallengeBanner />
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

/** Nudges the user towards a pending invite or their closest-to-finishing challenge. */
function ChallengeBanner() {
  const theme = useTheme();
  const { state, userById } = useStore();
  const statusOf = useChallengeStatus();
  const candidates = state.challenges
    .map((c) => ({ challenge: c, status: statusOf(c) }))
    .filter(({ status }) => status.active && (!status.joined || !status.done));
  const current = candidates.find(({ status }) => !status.joined) ?? candidates[0];
  if (!current) return null;
  const { challenge, status } = current;

  return (
    <Pressable
      onPress={() => router.navigate('/challenges')}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button">
      <LinearGradient
        colors={[theme.accent, theme.accentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}>
        <Text style={styles.bannerEmoji}>{challenge.badge.emoji}</Text>
        <View style={styles.flex}>
          <ThemedText type="overline" style={[styles.onAccent, { color: theme.onAccent }]}>
            {status.joined
              ? 'Your challenge'
              : `${challenge.invitedBy ? userById(challenge.invitedBy).name + ' invited you' : 'New challenge'}`}
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color: theme.onAccent }}>
            {challenge.title}
          </ThemedText>
          <ThemedText type="small" style={[styles.onAccent, { color: theme.onAccent }]}>
            {status.joined ? `${formatProgress(challenge, status)} · ` : 'Tap to join · '}
            {timeLeft(challenge.endsAt)}
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
  bannerEmoji: {
    fontSize: 32,
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
