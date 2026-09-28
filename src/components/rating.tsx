import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type RatingProps = {
  value: number;
  size?: number;
  /** 🍺 for beers, 🌟 for nights out. */
  emoji?: string;
  onChange?: (value: number) => void;
};

/** A 1–5 rating shown as emoji. Pass `onChange` to make it tappable; taps bounce the icons. */
export function Rating({ value, size = 14, emoji = '🍺', onChange }: RatingProps) {
  return (
    <View style={styles.row} accessibilityLabel={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <TappableIcon
            key={n}
            n={n}
            value={value}
            size={size}
            emoji={emoji}
            onPress={() => onChange(n)}
          />
        ) : (
          <Text key={n} style={{ fontSize: size, opacity: n <= value ? 1 : 0.2 }}>
            {emoji}
          </Text>
        )
      )}
    </View>
  );
}

function TappableIcon({
  n,
  value,
  size,
  emoji,
  onPress,
}: {
  n: number;
  value: number;
  size: number;
  emoji: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  // When the rating changes, ripple a bounce across every icon up to the new value.
  useEffect(() => {
    if (n > value) return;
    scale.set(
      withSequence(
        withTiming(1, { duration: n * 25 }),
        withTiming(1.35, { duration: 80 }),
        withSpring(1, { damping: 9, stiffness: 260 })
      )
    );
  }, [n, value, scale]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Rate ${n}`}>
      <Animated.Text style={[{ fontSize: size, opacity: n <= value ? 1 : 0.2 }, style]}>
        {emoji}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
});

/** Compact read-only rating, e.g. "★ 4.0". */
export function RatingPill({ value }: { value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold" style={{ color: theme.accentEnd }}>
        ★ {value.toFixed(1)}
      </ThemedText>
    </View>
  );
}
