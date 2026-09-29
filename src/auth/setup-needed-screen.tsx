import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Shown instead of crashing when the Supabase keys haven't been configured yet. */
export function SetupNeededScreen() {
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={[styles.fill, styles.center]}>
        <Card style={styles.card}>
          <Text style={styles.emoji}>🔌</Text>
          <ThemedText type="defaultSemiBold">Connect Supabase</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Copy .env.example to .env.local, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            from your Supabase project, then restart the dev server.
          </ThemedText>
        </Card>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    maxWidth: 400,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
  },
});
