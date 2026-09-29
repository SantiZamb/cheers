import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { BeerCardView } from '@/components/beer-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { BeerCard } from '@/data/cards';
import { useTheme } from '@/hooks/use-theme';

export type CelebrationContent = {
  emoji: string;
  title: string;
  subtitle?: string;
  /** Extra rows, e.g. new cards and badges this action unlocked. */
  lines?: { emoji: string; text: string; highlight?: boolean }[];
  /** Beer card earned or upgraded by this action; shown instead of the emoji badge. */
  card?: BeerCard;
};

const CONFETTI = ['🍺', '🍻', '✨', '🎉', '⭐️'];
const PARTICLES = 20;
const BURST_MS = 900;
/** Auto-dismiss; a bit longer when there are extra lines to read. */
const DURATION_MS = 1500;
const DURATION_WITH_LINES_MS = 2300;

export function Celebration({
  content,
  onDone,
}: {
  content: CelebrationContent;
  onDone: () => void;
}) {
  const theme = useTheme();
  const hasLines = !!content.lines?.length;

  useEffect(() => {
    const t = setTimeout(onDone, hasLines ? DURATION_WITH_LINES_MS : DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone, hasLines]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDone} accessibilityLabel="Dismiss">
        <View style={styles.burst} pointerEvents="none">
          {Array.from({ length: PARTICLES }, (_, i) => (
            <Particle key={i} index={i} />
          ))}
        </View>

        <Animated.View
          entering={ZoomIn.duration(220).easing(Easing.out(Easing.back(1.6)))}
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {content.card ? (
            <View style={styles.cardWrap}>
              <BeerCardView card={content.card} size="sm" />
            </View>
          ) : (
            <LinearGradient
              colors={[theme.accent, theme.accentEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emojiBadge}>
              <Text style={styles.bigEmoji}>{content.emoji}</Text>
            </LinearGradient>
          )}
          <ThemedText type="subtitle" style={styles.center}>
            {content.title}
          </ThemedText>
          {content.subtitle ? (
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {content.subtitle}
            </ThemedText>
          ) : null}
          {content.lines?.map((line, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(80 + i * 50).duration(200)}
              style={[
                styles.line,
                { backgroundColor: line.highlight ? theme.accentSoft : theme.backgroundSelected },
              ]}>
              <Text style={styles.lineEmoji}>{line.emoji}</Text>
              <ThemedText
                type="smallBold"
                style={[styles.lineText, line.highlight && { color: theme.accentEnd }]}>
                {line.text}
              </ThemedText>
            </Animated.View>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Particle({ index }: { index: number }) {
  // Random trajectory fixed for the particle's lifetime.
  const [params] = useState(() => ({
    emoji: CONFETTI[index % CONFETTI.length],
    angle: (index / PARTICLES) * Math.PI * 2 + Math.random() * 0.4,
    distance: 120 + Math.random() * 110,
    spin: (Math.random() - 0.5) * 540,
    size: 18 + Math.random() * 14,
    delay: Math.random() * 60,
  }));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(params.delay, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) }))
    );
  }, [progress, params.delay]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4,
      transform: [
        { translateX: Math.cos(params.angle) * params.distance * p },
        // Fly outwards, then fall a little like real confetti.
        { translateY: Math.sin(params.angle) * params.distance * p + 120 * p * p },
        { rotate: `${params.spin * p}deg` },
        { scale: 0.5 + p * 0.7 },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.particle, { fontSize: params.size }, style]}>
      {params.emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg + 6,
  },
  emojiBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  cardWrap: {
    marginTop: -Spacing.six,
    marginBottom: Spacing.one,
    transform: [{ rotate: '-4deg' }],
  },
  bigEmoji: {
    fontSize: 40,
  },
  center: {
    textAlign: 'center',
  },
  line: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
  },
  lineEmoji: {
    fontSize: 16,
  },
  lineText: {
    flex: 1,
  },
});
