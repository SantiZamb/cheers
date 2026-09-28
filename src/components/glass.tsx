import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Frosted-glass surface for things floating over content (toasts, map overlays).
 * Real blur on iOS; Android/web get a translucent fill, since blur there needs extra wiring.
 */
export function Glass({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  const scheme = useColorScheme();

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={60}
        tint={scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
        style={[styles.base, { borderColor: theme.border }, style]}
        {...rest}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.base, { backgroundColor: theme.glass, borderColor: theme.border }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
