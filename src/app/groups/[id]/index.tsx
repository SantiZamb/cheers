import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import {
  groupAsUser,
  Leaderboard,
  MetricPicker,
  PERIODS,
  PeriodPicker,
  StatTiles,
} from '@/components/group-parts';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchGroupLeaderboard } from '@/data/api';
import { keys, useStore } from '@/data/store';
import type { GroupMetric, GroupPeriod } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

const sinceLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** A group's page: who's in it, its numbers and its leaderboard. */
export default function GroupScreen() {
  const theme = useTheme();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, userById, myId, leaveGroup, refresh } = useStore();
  const [period, setPeriod] = useState<GroupPeriod>('month');
  const [metric, setMetric] = useState<GroupMetric>('beers');
  const [refreshing, setRefreshing] = useState(false);
  const group = state.groups.find((g) => g.id === id);

  const board = useQuery({
    queryKey: keys.groupBoard(id, period),
    queryFn: () => fetchGroupLeaderboard(id, period),
    enabled: !!group,
    staleTime: 30 * 1000,
  });

  if (!group) {
    return (
      <View style={styles.missing}>
        <ThemedText type="defaultSemiBold">This group isn’t available</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          You may have left it, or it was removed.
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" themeColor="accentEnd">
            Back to groups
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const members = group.memberIds.map(userById);
  const periodPhrase = PERIODS.find((p) => p.id === period)!.phrase;

  const confirmLeave = () =>
    Alert.alert(`Leave ${group.name}?`, 'Anyone still in the group can add you back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          leaveGroup(group.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                feedback.select();
                router.push({ pathname: '/groups/[id]/edit', params: { id: group.id } });
              }}
              hitSlop={10}
              accessibilityRole="button">
              <ThemedText type="defaultSemiBold" themeColor="accentEnd">
                Edit
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
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
        <Animated.View entering={FadeIn.duration(200)} style={styles.hero}>
          <Avatar user={groupAsUser(group)} size={120} />
          <ThemedText type="subtitle" style={styles.center}>
            {group.name}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {members.length} {members.length === 1 ? 'member' : 'members'} · since {sinceLabel(group.createdAt)}
          </ThemedText>
        </Animated.View>

        <View style={styles.section}>
          <ThemedText type="overline" themeColor="textSecondary">
            The numbers
          </ThemedText>
          <PeriodPicker value={period} onChange={setPeriod} />
          <StatTiles board={board.data} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ThemedText type="overline" themeColor="textSecondary">
              Leaderboard
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {periodPhrase}
            </ThemedText>
          </View>
          <MetricPicker value={metric} onChange={setMetric} />
          {board.isError ? (
            <ThemedText themeColor="textSecondary">Couldn’t load the leaderboard. Pull down to try again.</ThemedText>
          ) : board.data ? (
            <Leaderboard board={board.data} metric={metric} />
          ) : (
            <ThemedText themeColor="textSecondary">Loading the leaderboard…</ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ThemedText type="overline" themeColor="textSecondary">
              Members · {members.length}
            </ThemedText>
            <Pressable
              onPress={() => router.push({ pathname: '/groups/[id]/edit', params: { id: group.id } })}
              hitSlop={8}
              accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="accentEnd">
                Add or remove
              </ThemedText>
            </Pressable>
          </View>
          <Card style={styles.members}>
            {members.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.member}>
                  <Avatar user={m} size={48} />
                  <View style={styles.flex}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                      {m.name}
                      {m.id === myId ? ' (you)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {m.username ? `@${m.username}` : ''}
                      {m.city ? ` · ${m.city}` : ''}
                    </ThemedText>
                  </View>
                  {m.id === group.createdBy && (
                    <View style={[styles.tag, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="smallBold" themeColor="accentEnd">
                        Creator
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </View>

        <Pressable onPress={confirmLeave} style={styles.leave} accessibilityRole="button">
          <ThemedText type="smallBold" themeColor="textSecondary">
            Leave group
          </ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.five,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  center: {
    textAlign: 'center',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  members: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48 + Spacing.three,
  },
  tag: {
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  leave: {
    alignSelf: 'center',
    padding: Spacing.three,
  },
});
