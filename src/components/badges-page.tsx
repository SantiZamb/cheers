import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, ZoomIn } from 'react-native-reanimated';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { DIFFICULTIES, type Badge, type BadgeDifficulty } from '@/data/badges';
import { useChallengeStatus, useStore } from '@/data/store';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'unlocked' | 'locked';

/** Badges you get for finishing challenges, shown after the 30 regular ones. */
type ChallengeBadge = { id: string; emoji: string; name: string; challenge: string; endsAt: number };

const difficultyOf = (id: BadgeDifficulty) => DIFFICULTIES.find((d) => d.id === id)!;

const formatDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Full-page badge collection, opened from Profile. Locked badges stay greyed out behind a lock. */
export function BadgesPage({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const feedback = useFeedback();
  const { badges, state } = useStore();
  const statusOf = useChallengeStatus();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const unlocked = badges.filter((b) => b.unlocked).length;
  const open = badges.find((b) => b.id === openId) ?? null;
  const challengeBadges: ChallengeBadge[] = state.challenges
    .filter((c) => statusOf(c).done)
    .map((c) => ({ id: c.id, ...c.badge, challenge: c.title, endsAt: c.endsAt }));
  const openChallenge = challengeBadges.find((b) => b.id === openId) ?? null;

  const shown = (b: Badge) => filter === 'all' || (filter === 'unlocked') === b.unlocked;

  const select = (id: string) => {
    feedback.select();
    setOpenId(id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <ThemedText type="overline" themeColor="accentEnd">
                Your collection
              </ThemedText>
              <ThemedText type="subtitle">Badges</ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <ThemedText type="defaultSemiBold" themeColor="accentEnd">
                Done
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.summary}>
            <ThemedText type="smallBold">
              {unlocked} of {badges.length} unlocked
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <LinearGradient
                colors={[theme.accent, theme.accentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.trackFill, { width: `${Math.max(unlocked / badges.length, 0.03) * 100}%` }]}
              />
            </View>
          </View>

          <View style={styles.filters}>
            {(['all', 'unlocked', 'locked'] as const).map((f) => (
              <Chip
                key={f}
                large
                label={f === 'all' ? 'All' : f === 'unlocked' ? 'Unlocked' : 'Locked'}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>

          {DIFFICULTIES.map((d) => {
            const all = badges.filter((b) => b.difficulty === d.id);
            const list = all.filter(shown);
            if (!list.length) return null;
            return (
              <View key={d.id} style={styles.section}>
                <View style={styles.sectionHead}>
                  <DifficultyPill difficulty={d.id} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {all.filter((b) => b.unlocked).length} / {all.length}
                  </ThemedText>
                </View>
                <View style={styles.grid}>
                  {list.map((b) => (
                    <BadgeTile key={b.id} badge={b} onPress={() => select(b.id)} />
                  ))}
                </View>
              </View>
            );
          })}

          {challengeBadges.length > 0 && filter !== 'locked' && (
            <View style={styles.section}>
              <ThemedText type="overline" themeColor="textSecondary">
                Challenge badges
              </ThemedText>
              <View style={styles.grid}>
                {challengeBadges.map((b) => (
                  <Pressable key={b.id} onPress={() => select(b.id)} style={styles.tile} accessibilityRole="button">
                    <Medal emoji={b.emoji} colors={[theme.accent, theme.accentEnd]} />
                    <ThemedText type="small" style={styles.tileName} numberOfLines={2}>
                      {b.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {(open || openChallenge) && (
          <Pressable style={styles.backdrop} onPress={() => setOpenId(null)} accessibilityLabel="Close badge">
            <Animated.View
              entering={ZoomIn.duration(220).easing(Easing.out(Easing.back(1.4)))}
              style={[styles.detail, { backgroundColor: theme.backgroundElement }]}>
              {open ? <BadgeDetail badge={open} /> : openChallenge ? <ChallengeBadgeDetail badge={openChallenge} /> : null}
            </Animated.View>
          </Pressable>
        )}
      </ThemedView>
    </Modal>
  );
}

function BadgeTile({ badge, onPress }: { badge: Badge; onPress: () => void }) {
  const theme = useTheme();
  const d = difficultyOf(badge.difficulty);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${badge.name}, ${badge.unlocked ? 'unlocked' : 'locked'}`}>
      {badge.unlocked ? <Medal emoji={badge.emoji} colors={d.colors} /> : <LockedMedal />}
      <ThemedText
        type="small"
        themeColor={badge.unlocked ? 'text' : 'textSecondary'}
        style={styles.tileName}
        numberOfLines={2}>
        {badge.name}
      </ThemedText>
      {!badge.unlocked && badge.value > 0 && (
        <View style={[styles.miniTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.trackFill, { width: `${(badge.value / badge.goal) * 100}%`, backgroundColor: theme.textSecondary }]} />
        </View>
      )}
    </Pressable>
  );
}

function Medal({ emoji, colors, size = 68 }: { emoji: string; colors: readonly [string, string]; size?: number }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.medal, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text>
    </LinearGradient>
  );
}

/** Greyed-out disc: the badge art stays hidden until it's earned. */
function LockedMedal({ size = 68 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.medal,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        styles.lockedMedal,
      ]}>
      <Text style={[styles.lockEmoji, { fontSize: size * 0.36 }]}>🔒</Text>
    </View>
  );
}

function DifficultyPill({ difficulty }: { difficulty: BadgeDifficulty }) {
  const d = difficultyOf(difficulty);
  return (
    <LinearGradient colors={d.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill}>
      <ThemedText type="smallBold" style={{ color: d.ink }}>
        {d.label}
      </ThemedText>
    </LinearGradient>
  );
}

function BadgeDetail({ badge }: { badge: Badge }) {
  const theme = useTheme();
  const d = difficultyOf(badge.difficulty);
  return (
    <>
      {badge.unlocked ? <Medal emoji={badge.emoji} colors={d.colors} size={112} /> : <LockedMedal size={112} />}
      <ThemedText type="subtitle" style={styles.center}>
        {badge.name}
      </ThemedText>
      <DifficultyPill difficulty={badge.difficulty} />

      {badge.unlocked ? (
        <Animated.View entering={FadeIn.delay(100).duration(180)} style={styles.detailText}>
          <ThemedText type="overline" themeColor="accentEnd" style={styles.center}>
            Unlocked{badge.earnedAt ? ` · ${formatDate(badge.earnedAt)}` : ''}
          </ThemedText>
          <ThemedText style={styles.center}>{badge.earned}</ThemedText>
          {badge.detail ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {badge.detail}
            </ThemedText>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.delay(100).duration(180)} style={styles.detailText}>
          <ThemedText type="overline" themeColor="textSecondary" style={styles.center}>
            How to unlock
          </ThemedText>
          <ThemedText style={styles.center}>{badge.howTo}</ThemedText>
          {badge.goal > 1 && (
            <>
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <LinearGradient
                  colors={[theme.accent, theme.accentEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.trackFill, { width: `${Math.max(badge.value / badge.goal, 0.03) * 100}%` }]}
                />
              </View>
              <ThemedText type="smallBold" style={styles.center}>
                {badge.value} / {badge.goal}
                {badge.unit ? ` ${badge.unit}` : ''}
              </ThemedText>
            </>
          )}
          {badge.detail ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {badge.detail}
            </ThemedText>
          ) : null}
        </Animated.View>
      )}
    </>
  );
}

function ChallengeBadgeDetail({ badge }: { badge: ChallengeBadge }) {
  const theme = useTheme();
  return (
    <>
      <Medal emoji={badge.emoji} colors={[theme.accent, theme.accentEnd]} size={112} />
      <ThemedText type="subtitle" style={styles.center}>
        {badge.name}
      </ThemedText>
      <View style={styles.detailText}>
        <ThemedText type="overline" themeColor="accentEnd" style={styles.center}>
          Challenge badge
        </ThemedText>
        <ThemedText style={styles.center}>Completed “{badge.challenge}”.</ThemedText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  summary: {
    gap: Spacing.two,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.four,
  },
  tile: {
    width: '33.33%',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  tileName: {
    textAlign: 'center',
  },
  miniTrack: {
    width: 48,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  medal: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMedal: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockEmoji: {
    opacity: 0.45,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  detail: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
  detailText: {
    gap: Spacing.two,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
