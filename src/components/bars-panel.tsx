import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useFeedback } from '@/feedback/feedback';
import { BAR_KIND_LABELS, type Bar } from '@/lib/bars';
import { formatDistance, formatWalk } from '@/lib/geo';
import { useTheme } from '@/hooks/use-theme';

export const RADII = [500, 1000, 2000, 5000];

export type BarSearch =
  | { status: 'idle' }
  | { status: 'locating' | 'loading' }
  | { status: 'denied' | 'error' }
  | { status: 'done'; bars: Bar[] };

type BarsPanelProps = {
  radius: number;
  search: BarSearch;
  selectedId: string | null;
  onRadius: (meters: number) => void;
  onSearch: () => void;
  onSelect: (id: string) => void;
};

export function BarsPanel({ radius, search, selectedId, onRadius, onSearch, onSelect }: BarsPanelProps) {
  const feedback = useFeedback();

  return (
    <View style={styles.gap}>
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <Chip
            key={r}
            large
            label={r < 1000 ? `${r} m` : `${r / 1000} km`}
            selected={radius === r}
            onPress={() => {
              feedback.select();
              onRadius(r);
            }}
          />
        ))}
      </View>

      {search.status === 'idle' && (
        <Card style={styles.center}>
          <Text style={styles.bigEmoji}>🍻</Text>
          <ThemedText type="defaultSemiBold" style={styles.textCenter}>
            Where should we go tonight?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.textCenter}>
            Pick a radius and we’ll rank the bars, pubs and clubs around you.
          </ThemedText>
          <GradientButton label="Find the best spots" onPress={onSearch} style={styles.stretch} />
        </Card>
      )}

      {(search.status === 'locating' || search.status === 'loading') && (
        <View style={styles.gap}>
          <ThemedText type="small" themeColor="textSecondary">
            {search.status === 'locating' ? 'Finding you…' : 'Asking OpenStreetMap…'}
          </ThemedText>
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      )}

      {search.status === 'denied' && (
        <Message
          emoji="📍"
          title="Location needed"
          body="Allow location access for Cheers in Settings to find bars around you."
          action="Open Settings"
          onAction={() => Linking.openSettings()}
        />
      )}

      {search.status === 'error' && (
        <Message
          emoji="😵‍💫"
          title="OpenStreetMap is busy"
          body="The free public map server is overloaded right now. Give it a minute and try again."
          action="Try again"
          onAction={onSearch}
        />
      )}

      {search.status === 'done' && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {search.bars.length
              ? `${search.bars.length} spots within ${radius < 1000 ? `${radius} m` : `${radius / 1000} km`} · best first`
              : 'Nothing mapped here yet. Try a bigger radius.'}
          </ThemedText>
          {search.bars.map((bar, i) => (
            <Animated.View key={bar.id} entering={FadeInDown.delay(Math.min(i, 6) * 30).duration(180)}>
              <BarRow bar={bar} rank={i + 1} selected={selectedId === bar.id} onPress={() => onSelect(bar.id)} />
            </Animated.View>
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
            Places © OpenStreetMap contributors. Ranked by Cheers ratings, then by what each listing
            offers and how close it is.
          </ThemedText>
        </>
      )}
    </View>
  );
}

function BarRow({ bar, rank, selected, onPress }: { bar: Bar; rank: number; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { setDraftVenue } = useStore();
  const kind = BAR_KIND_LABELS[bar.kind];

  const directions = () => {
    const label = encodeURIComponent(bar.name);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${bar.lat},${bar.lng}&q=${label}&dirflg=w`
        : `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}&travelmode=walking`;
    Linking.openURL(url);
  };

  return (
    <Card style={[styles.barCard, selected && { borderColor: theme.accent, borderWidth: 1.5 }]}>
      <Pressable onPress={onPress} style={styles.barHead} accessibilityRole="button">
        <View style={[styles.rank, { backgroundColor: rank <= 3 ? theme.accentSoft : theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={rank <= 3 ? { color: theme.accentEnd } : undefined}>
            {rank}
          </ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {bar.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {kind.emoji} {kind.label} · {formatDistance(bar.distance)} · {formatWalk(bar.distance)}
          </ThemedText>
        </View>
        <View style={styles.score}>
          <ThemedText type="defaultSemiBold" style={{ color: theme.accentEnd }}>
            {bar.score}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.scoreLabel}>
            score
          </ThemedText>
        </View>
      </Pressable>

      {bar.reasons.length > 0 && (
        <View style={styles.tags}>
          {bar.reasons.map((r) => (
            <View key={r} style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small">{r}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {selected && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.actions}>
          <GradientButton
            size="sm"
            label="Check in here"
            style={styles.flex}
            onPress={() => {
              setDraftVenue(bar.name);
              router.navigate('/post');
            }}
          />
          <Pressable
            onPress={directions}
            style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}
            accessibilityRole="button">
            <ThemedText type="smallBold">Directions</ThemedText>
          </Pressable>
        </Animated.View>
      )}
    </Card>
  );
}

function Message({
  emoji,
  title,
  body,
  action,
  onAction,
}: {
  emoji: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <Card style={styles.center}>
      <Text style={styles.bigEmoji}>{emoji}</Text>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.textCenter}>
        {body}
      </ThemedText>
      <GradientButton size="sm" label={action} onPress={onAction} />
    </Card>
  );
}

function SkeletonRow() {
  const theme = useTheme();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 650 }), -1, true));
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View style={style}>
      <Card style={styles.barHead}>
        <View style={[styles.rank, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.flex, styles.skeletonLines]}>
          <View style={[styles.skeletonLine, { width: '60%', backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.backgroundSelected }]} />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  center: {
    alignItems: 'center',
  },
  textCenter: {
    textAlign: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  bigEmoji: {
    fontSize: 36,
  },
  barCard: {
    gap: Spacing.two + Spacing.one,
  },
  barHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondary: {
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  attribution: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: Spacing.two,
  },
  skeletonLines: {
    gap: Spacing.two,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});
