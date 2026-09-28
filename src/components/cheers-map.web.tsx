import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CheersMapProps } from './cheers-map';

/** react-native-maps has no web support; the lists below the map still work. */
export function CheersMap({ style, mode }: CheersMapProps) {
  const theme = useTheme();
  return (
    <LinearGradient colors={[theme.accentSoft, theme.background]} style={[styles.fill, style]}>
      <View style={styles.center}>
        <Text style={styles.emoji}>{mode === 'bars' ? '🍻' : '🗺️'}</Text>
        <ThemedText type="smallBold" themeColor="textSecondary">
          The map is available in the mobile app
        </ThemedText>
      </View>
    </LinearGradient>
  );
}

export type { CheersMapProps, MapFriend } from './cheers-map';

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  emoji: {
    fontSize: 40,
  },
});
