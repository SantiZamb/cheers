import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Group, GroupLeaderboard, GroupMetric, GroupPeriod, User } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

/** Groups render through Avatar: photo, or the name's initial on the gradient. */
export const groupAsUser = (group: Pick<Group, 'id' | 'name' | 'photo'>): User => ({
  id: group.id,
  name: group.name,
  username: '',
  city: '',
  photo: group.photo,
});

export const PERIODS: { id: GroupPeriod; label: string; phrase: string }[] = [
  { id: 'week', label: 'This week', phrase: 'this week' },
  { id: 'month', label: 'This month', phrase: 'this month' },
  { id: 'all', label: 'All time', phrase: 'all time' },
];

export const METRICS: { id: GroupMetric; label: string; unit: (n: number) => string }[] = [
  { id: 'beers', label: '🍺 Beers', unit: (n) => (n === 1 ? 'beer' : 'beers') },
  { id: 'posts', label: '📸 Posts', unit: (n) => (n === 1 ? 'post' : 'posts') },
  { id: 'nights', label: '🌙 Nights', unit: (n) => (n === 1 ? 'night out' : 'nights out') },
  { id: 'uniqueBeers', label: '🧭 New beers', unit: (n) => (n === 1 ? 'different beer' : 'different beers') },
  { id: 'avgRating', label: '⭐ Avg rating', unit: () => 'avg rating' },
  { id: 'cheers', label: '🍻 Cheers got', unit: (n) => (n === 1 ? 'reaction' : 'reactions') },
];

type Standing = GroupLeaderboard['standings'][number];

export const valueOf = (s: Standing, metric: GroupMetric) => (metric === 'avgRating' ? (s.avgRating ?? 0) : s[metric]);
export const formatValue = (value: number, metric: GroupMetric) =>
  metric === 'avgRating' ? (value ? value.toFixed(1) : '–') : String(value);

export function ranked(board: GroupLeaderboard | undefined, metric: GroupMetric) {
  return [...(board?.standings ?? [])].sort((a, b) => valueOf(b, metric) - valueOf(a, metric));
}

/** Up to three overlapping member avatars, then "+N". */
export function MemberStack({ members, size = 28 }: { members: User[]; size?: number }) {
  const theme = useTheme();
  const shown = members.slice(0, 3);
  return (
    <View style={styles.stack}>
      {shown.map((m, i) => (
        <View
          key={m.id}
          style={[
            styles.stackItem,
            { marginLeft: i ? -size * 0.35 : 0, borderColor: theme.backgroundElement, borderRadius: size / 2 + 2 },
          ]}>
          <Avatar user={m} size={size} />
        </View>
      ))}
      {members.length > shown.length && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.more}>
          +{members.length - shown.length}
        </ThemedText>
      )}
    </View>
  );
}

/** Big-number tiles for a group's totals over the selected period. */
export function StatTiles({ board }: { board: GroupLeaderboard | undefined }) {
  const tiles = [
    { label: 'Beers', emoji: '🍺', value: board?.beers },
    { label: 'Posts', emoji: '📸', value: board?.posts },
    { label: 'Cities', emoji: '📍', value: board?.cities },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <Card key={t.label} style={styles.tile}>
          <ThemedText style={styles.tileEmoji}>{t.emoji}</ThemedText>
          <ThemedText type="subtitle" style={styles.tileValue}>
            {t.value ?? '–'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.label}
          </ThemedText>
        </Card>
      ))}
    </View>
  );
}

export function PeriodPicker({ value, onChange }: { value: GroupPeriod; onChange: (p: GroupPeriod) => void }) {
  return (
    <View style={styles.row}>
      {PERIODS.map((p) => (
        <Chip key={p.id} large label={p.label} selected={value === p.id} onPress={() => onChange(p.id)} />
      ))}
    </View>
  );
}

export function MetricPicker({ value, onChange }: { value: GroupMetric; onChange: (m: GroupMetric) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {METRICS.map((m) => (
        <Chip key={m.id} label={m.label} selected={value === m.id} onPress={() => onChange(m.id)} />
      ))}
    </ScrollView>
  );
}

/** Ranked members for one metric: medals for the top three, "you" highlighted. */
export function Leaderboard({ board, metric }: { board: GroupLeaderboard; metric: GroupMetric }) {
  const { userById } = useStore();
  return (
    <Card style={styles.board}>
      {ranked(board, metric).map((s, i) => (
        <Animated.View key={s.userId} layout={LinearTransition.duration(200)}>
          <StandingRow user={userById(s.userId)} rank={i} value={valueOf(s, metric)} metric={metric} />
        </Animated.View>
      ))}
    </Card>
  );
}

function StandingRow({ user, rank, value, metric }: { user: User; rank: number; value: number; metric: GroupMetric }) {
  const theme = useTheme();
  const { myId } = useStore();
  const isMe = user.id === myId;
  const medal = value > 0 ? ['👑', '🥈', '🥉'][rank] : undefined;
  const unit = METRICS.find((m) => m.id === metric)!.unit(value);
  return (
    <View style={[styles.standing, isMe && { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="defaultSemiBold" style={styles.rank}>
        {medal ?? rank + 1}
      </ThemedText>
      <Avatar user={user} size={44} />
      <View style={styles.flex}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {user.name}
          {isMe ? ' (you)' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatValue(value, metric)} {unit}
        </ThemedText>
      </View>
      <ThemedText type="subtitle" style={[styles.value, rank === 0 && value > 0 && { color: theme.accentEnd }]}>
        {formatValue(value, metric)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    borderWidth: 2,
  },
  more: {
    marginLeft: Spacing.two,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  tileEmoji: {
    fontSize: 22,
  },
  tileValue: {
    fontSize: 30,
    lineHeight: 36,
  },
  board: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  rank: {
    width: 28,
    textAlign: 'center',
  },
  value: {
    fontSize: 24,
    lineHeight: 30,
  },
});
