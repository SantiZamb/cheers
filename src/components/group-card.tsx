import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { FriendPicker } from '@/components/friend-picker';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { fetchGroupLeaderboard } from '@/data/api';
import { keys, useStore } from '@/data/store';
import type { Group, GroupLeaderboard, GroupMetric, GroupPeriod, User } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

const PERIODS: { id: GroupPeriod; label: string; phrase: string }[] = [
  { id: 'week', label: 'This week', phrase: 'this week' },
  { id: 'month', label: 'This month', phrase: 'this month' },
  { id: 'all', label: 'All time', phrase: 'all time' },
];

const METRICS: { id: GroupMetric; label: string; unit: (n: number) => string }[] = [
  { id: 'beers', label: '🍺 Beers', unit: (n) => (n === 1 ? 'beer' : 'beers') },
  { id: 'posts', label: '📸 Posts', unit: (n) => (n === 1 ? 'post' : 'posts') },
  { id: 'nights', label: '🌙 Nights', unit: (n) => (n === 1 ? 'night out' : 'nights out') },
  { id: 'uniqueBeers', label: '🧭 New beers', unit: (n) => (n === 1 ? 'different beer' : 'different beers') },
  { id: 'avgRating', label: '⭐ Avg rating', unit: () => 'avg rating' },
  { id: 'cheers', label: '🍻 Cheers got', unit: (n) => (n === 1 ? 'reaction' : 'reactions') },
];

type Standing = GroupLeaderboard['standings'][number];

const valueOf = (s: Standing, metric: GroupMetric) => (metric === 'avgRating' ? (s.avgRating ?? 0) : s[metric]);
const format = (value: number, metric: GroupMetric) => (metric === 'avgRating' ? (value ? value.toFixed(1) : '–') : String(value));

/** A group: photo, name and members; tap for its leaderboard and settings. */
export function GroupCard({ group }: { group: Group }) {
  const theme = useTheme();
  const { userById } = useStore();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<GroupPeriod>('month');
  const [metric, setMetric] = useState<GroupMetric>('beers');
  const feedback = useFeedback();

  const board = useQuery({
    queryKey: keys.groupBoard(group.id, period),
    queryFn: () => fetchGroupLeaderboard(group.id, period),
    staleTime: 30 * 1000,
  });

  const standings = [...(board.data?.standings ?? [])].sort((a, b) => valueOf(b, metric) - valueOf(a, metric));
  const leader = standings[0] && valueOf(standings[0], metric) > 0 ? standings[0] : null;
  const metricInfo = METRICS.find((m) => m.id === metric)!;
  const periodInfo = PERIODS.find((p) => p.id === period)!;
  const members = group.memberIds.map(userById);

  return (
    <Card style={[styles.gap, open && { borderColor: theme.accent }]}>
      <Pressable
        onPress={() => {
          feedback.select();
          setOpen((o) => !o);
        }}
        style={styles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Avatar user={{ id: group.id, name: group.name, username: '', city: '', photo: group.photo }} size={52} />
        <View style={styles.flex}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {group.name}
          </ThemedText>
          <ThemedText type="small" themeColor={leader ? 'accentEnd' : 'textSecondary'} numberOfLines={1}>
            {leader
              ? `👑 ${userById(leader.userId).name.split(' ')[0]} leads · ${format(valueOf(leader, metric), metric)} ${metricInfo.unit(valueOf(leader, metric))} ${periodInfo.phrase}`
              : `${members.length} ${members.length === 1 ? 'member' : 'members'} · no posts ${periodInfo.phrase} yet`}
          </ThemedText>
        </View>
        <MemberStack members={members} />
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.gap}>
          <View style={styles.row}>
            {PERIODS.map((p) => (
              <Chip key={p.id} large label={p.label} selected={period === p.id} onPress={() => setPeriod(p.id)} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {METRICS.map((m) => (
              <Chip key={m.id} label={m.label} selected={metric === m.id} onPress={() => setMetric(m.id)} />
            ))}
          </ScrollView>

          {board.isError ? (
            <ThemedText type="small" themeColor="textSecondary">
              Couldn’t load the leaderboard. Pull down to try again.
            </ThemedText>
          ) : !board.data ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading the leaderboard…
            </ThemedText>
          ) : (
            <>
              <View style={styles.gapSm}>
                {standings.map((s, i) => (
                  <Animated.View key={s.userId} layout={LinearTransition.duration(200)}>
                    <StandingRow user={userById(s.userId)} rank={i} value={valueOf(s, metric)} metric={metric} />
                  </Animated.View>
                ))}
              </View>
              <View style={[styles.totals, { backgroundColor: theme.backgroundSelected }]}>
                <Total label="Beers" value={board.data.beers} />
                <Total label="Posts" value={board.data.posts} />
                <Total label="Cities" value={board.data.cities} />
              </View>
            </>
          )}

          <GroupSettings group={group} />
        </Animated.View>
      )}
    </Card>
  );
}

function MemberStack({ members }: { members: User[] }) {
  const theme = useTheme();
  const shown = members.slice(0, 3);
  return (
    <View style={styles.stack}>
      {shown.map((m, i) => (
        <View key={m.id} style={[styles.stackItem, { marginLeft: i ? -10 : 0, borderColor: theme.backgroundElement }]}>
          <Avatar user={m} size={24} />
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

function StandingRow({ user, rank, value, metric }: { user: User; rank: number; value: number; metric: GroupMetric }) {
  const theme = useTheme();
  const { myId } = useStore();
  const isMe = user.id === myId;
  const medal = value > 0 ? ['👑', '🥈', '🥉'][rank] : undefined;
  return (
    <View style={[styles.standing, isMe && { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold" style={styles.rank}>
        {medal ?? rank + 1}
      </ThemedText>
      <Avatar user={user} size={32} />
      <ThemedText type="small" style={styles.flex} numberOfLines={1}>
        {user.name}
        {isMe ? ' (you)' : ''}
      </ThemedText>
      <ThemedText type="defaultSemiBold" style={rank === 0 && value > 0 ? { color: theme.accentEnd } : undefined}>
        {format(value, metric)}
      </ThemedText>
    </View>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <ThemedText type="defaultSemiBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Add friends, rename, change the photo, leave. */
function GroupSettings({ group }: { group: Group }) {
  const theme = useTheme();
  const { friends, renameGroup, setGroupPhoto, addGroupMembers, leaveGroup } = useStore();
  const [panel, setPanel] = useState<'none' | 'add' | 'rename'>('none');
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(group.name);
  const addable = friends.filter((f) => !group.memberIds.includes(f.id));

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setGroupPhoto(group.id, result.assets[0].uri);
    } catch {
      Alert.alert('Couldn’t open your photos', 'Allow photo access for Cheers in Settings.');
    }
  };

  const toggle = (next: typeof panel) => setPanel((cur) => (cur === next ? 'none' : next));

  return (
    <View style={styles.gap}>
      <View style={styles.links}>
        <SettingLink label="➕ Add friends" onPress={() => toggle('add')} active={panel === 'add'} />
        <SettingLink label="📷 Photo" onPress={pickPhoto} />
        <SettingLink label="✏️ Rename" onPress={() => toggle('rename')} active={panel === 'rename'} />
        <SettingLink
          label="Leave"
          onPress={() =>
            Alert.alert(`Leave ${group.name}?`, 'You can be added back by anyone in the group.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => leaveGroup(group.id) },
            ])
          }
        />
      </View>

      {panel === 'add' && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.gap}>
          {addable.length ? (
            <>
              <FriendPicker friends={addable} selected={picked} onChange={setPicked} />
              <GradientButton
                size="sm"
                label={picked.length ? `Add ${picked.length}` : 'Pick friends to add'}
                disabled={!picked.length}
                onPress={() => {
                  addGroupMembers(group.id, picked);
                  setPicked([]);
                  setPanel('none');
                }}
              />
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              All your friends are already in this group.
            </ThemedText>
          )}
        </Animated.View>
      )}

      {panel === 'rename' && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.renameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
            style={[styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
          />
          <GradientButton
            size="sm"
            label="Save"
            disabled={!name.trim() || name.trim() === group.name}
            onPress={() => {
              renameGroup(group.id, name.trim());
              setPanel('none');
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

function SettingLink({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      <ThemedText type="smallBold" themeColor={active ? 'accentEnd' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.three,
  },
  gapSm: {
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
    borderRadius: 14,
  },
  more: {
    marginLeft: Spacing.one,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
  totals: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  total: {
    flex: 1,
    alignItems: 'center',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
  },
});
