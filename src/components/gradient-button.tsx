import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Primary action: amber → orange gradient pill. */
export function GradientButton({
  label,
  onPress,
  disabled = false,
  size = 'lg',
  icon,
  style,
  accessibilityLabel,
}: GradientButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.wrap,
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <LinearGradient
        colors={[theme.accent, theme.accentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, size === 'sm' ? styles.sm : styles.lg]}>
        {icon}
        <ThemedText
          type={size === 'sm' ? 'smallBold' : 'defaultSemiBold'}
          style={{ color: theme.onAccent }}>
          {label}
        </ThemedText>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  lg: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  sm: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
