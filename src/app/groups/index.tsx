import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { groupAsUser, MemberStack, ranked } from '@/components/group-parts';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { fetchGroupLeaderboard } from '@/data/api';
import { keys, useStore } from '@/data/store';
import type { Group } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

/** Your groups, roomy cards; tap one for its page. */
export default function GroupsScreen() {
  const { state, refresh } = useStore();
  const feedback = useFeedback();
  const [refreshing, setRefreshing] = useState(false);

  const newGroup = () => {
    feedback.select();
    router.push('/groups/new');
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }>
        <ScreenHeader
          overline="Your crews"
          title="Groups"
          subtitle="See who’s drinking the most, posting the most and going out the most."
        />

        {state.groups.length > 0 && <GradientButton label="＋  New group" onPress={newGroup} />}

        {state.groups.map((g, i) => (
          <Animated.View key={g.id} entering={FadeInDown.delay(i * 40).duration(200)}>
            <GroupRow group={g} />
          </Animated.View>
        ))}

        {state.groups.length === 0 && (
          <Card style={styles.empty}>
            <Text style={styles.emptyEmoji}>👯</Text>
            <ThemedText type="defaultSemiBold" style={styles.center}>
              No groups yet
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Make one for your crew: give it a name and a photo, add friends, and battle it out on the
              leaderboard.
            </ThemedText>
            <GradientButton label="Create your first group" onPress={newGroup} />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function GroupRow({ group }: { group: Group }) {
  const theme = useTheme();
  const feedback = useFeedback();
  const { userById, myId } = useStore();
  const members = group.memberIds.map(userById);
  const board = useQuery({
    queryKey: keys.groupBoard(group.id, 'month'),
    queryFn: () => fetchGroupLeaderboard(group.id, 'month'),
    staleTime: 30 * 1000,
  });
  const standings = ranked(board.data, 'beers');
  const leader = standings[0]?.beers ? standings[0] : null;
  const myRank = standings.findIndex((s) => s.userId === myId);

  return (
    <Pressable
      onPress={() => {
        feedback.select();
        router.push({ pathname: '/groups/[id]', params: { id: group.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${members.length} members`}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Avatar user={groupAsUser(group)} size={64} />
          <View style={styles.flex}>
            <ThemedText type="defaultSemiBold" style={styles.name} numberOfLines={1}>
              {group.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </ThemedText>
          </View>
          <ThemedText type="subtitle" themeColor="textSecondary" style={styles.chevron}>
            ›
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.foot}>
          <MemberStack members={members} />
          <ThemedText
            type="small"
            themeColor={leader ? 'accentEnd' : 'textSecondary'}
            style={styles.flexRight}
            numberOfLines={2}>
            {!board.data
              ? ' '
              : leader
                ? leader.userId === myId
                  ? `👑 You lead with ${leader.beers} beers this month`
                  : `👑 ${userById(leader.userId).name.split(' ')[0]} leads · ${leader.beers} beers${myRank > 0 ? ` · you’re #${myRank + 1}` : ''}`
                : 'No beers this month yet'}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  flexRight: {
    flex: 1,
    textAlign: 'right',
  },
  center: {
    textAlign: 'center',
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    fontSize: 20,
    lineHeight: 26,
  },
  chevron: {
    fontSize: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  emptyEmoji: {
    fontSize: 56,
  },
  pressed: {
    opacity: 0.8,
  },
});
