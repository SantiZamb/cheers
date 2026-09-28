import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { Radius, Spacing } from '@/constants/theme';
import {
  challengeRecap,
  challengeStatus,
  formatProgress,
  timeLeft,
  type ChallengeStatus,
} from '@/data/challenges';
import { ME_ID, USERS } from '@/data/seed';
import { useStore } from '@/data/store';
import type { Challenge } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const theme = useTheme();
  const { state, joinChallenge } = useStore();
  const status = challengeStatus(challenge, state.posts);
  const [open, setOpen] = useState(false);

  const fraction =
    challenge.kind === 'topRated'
      ? status.myValue / 5
      : Math.min(1, status.myValue / challenge.goal);

  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.gap} accessibilityRole="button">
        <View style={styles.titleRow}>
          <Text style={styles.badge}>{challenge.badge.emoji}</Text>
          <View style={styles.flex}>
            <ThemedText type="defaultSemiBold">{challenge.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {challenge.description}
            </ThemedText>
          </View>
        </View>

        {status.active && !status.joined ? (
          <View style={[styles.invite, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="small" style={styles.flex}>
              {challenge.invitedBy
                ? `${USERS[challenge.invitedBy].avatar} ${USERS[challenge.invitedBy].name} invited you`
                : 'Open to join'}
              {' · '}
              {timeLeft(challenge.endsAt)}
            </ThemedText>
            <GradientButton size="sm" label="Join" onPress={() => joinChallenge(challenge.id)} />
          </View>
        ) : (
          <>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <LinearGradient
                colors={[theme.accent, theme.accentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.fill, { width: `${Math.max(fraction, 0.04) * 100}%` }]}
              />
            </View>
            <View style={styles.progressRow}>
              <ThemedText type="smallBold">
                {status.done ? `✅ Done! ${challenge.badge.name} badge earned` : progressLabel(challenge, status)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {timeLeft(challenge.endsAt)}
              </ThemedText>
            </View>
          </>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          {open ? 'Hide' : status.active ? 'See leaderboard' : 'See recap'} ›
        </ThemedText>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn} style={styles.gap}>
          {status.active ? <Leaderboard challenge={challenge} status={status} /> : <Recap challenge={challenge} />}
        </Animated.View>
      )}
    </Card>
  );
}

function progressLabel(challenge: Challenge, status: ChallengeStatus) {
  const progress = formatProgress(challenge, status);
  return status.isGroup ? `Group: ${progress} cities` : `You: ${progress}`;
}

function Leaderboard({ challenge, status }: { challenge: Challenge; status: ChallengeStatus }) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      {status.standings.map((s, i) => {
        const unit =
          challenge.kind === 'topRated'
            ? s.value
              ? `${s.value}/5 · ${s.detail}`
              : '—'
            : challenge.kind === 'cities'
              ? `${s.value} ${s.value === 1 ? 'city' : 'cities'}`
              : `${s.value}/${challenge.goal}`;
        const isMe = s.user.id === ME_ID;
        return (
          <View
            key={s.user.id}
            style={[styles.standing, isMe && { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold" style={styles.rank}>
              {i === 0 && s.value > 0 ? '👑' : `${i + 1}`}
            </ThemedText>
            <Avatar user={s.user} size={28} />
            <ThemedText type="small" style={styles.flex}>
              {s.user.name}
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.unit}>
              {unit}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function Recap({ challenge }: { challenge: Challenge }) {
  const theme = useTheme();
  const { state } = useStore();
  const recap = challengeRecap(challenge, state.posts);

  return (
    <View style={[styles.recap, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="overline" themeColor="accentEnd">
        Together you…
      </ThemedText>
      <ThemedText>
        🍺 tried <ThemedText type="defaultSemiBold">{recap.beers}</ThemedText> beers across{' '}
        <ThemedText type="defaultSemiBold">{recap.posts}</ThemedText> posts
      </ThemedText>
      <ThemedText>🌍 drank in {recap.cities.join(', ')}</ThemedText>
      {recap.mvp && (
        <ThemedText>
          ⭐️ MVP: {recap.mvp.avatar} {recap.mvp.name}
        </ThemedText>
      )}
      <ThemedText>
        🏅 Finished: {recap.finishers.map((u) => u.name).join(', ') || 'nobody (next time!)'}
      </ThemedText>
      <ThemedText type="defaultSemiBold">
        {recap.earnedBadge
          ? `You earned ${challenge.badge.emoji} ${challenge.badge.name}`
          : 'You didn’t finish this one'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.two + Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  badge: {
    fontSize: 36,
  },
  flex: {
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.one + Spacing.half,
    paddingLeft: Spacing.three,
    borderRadius: Radius.pill,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
  unit: {
    maxWidth: '50%',
  },
  recap: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
});
