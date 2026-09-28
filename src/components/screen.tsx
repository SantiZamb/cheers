import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Shared tab-screen shell: themed background, top safe area, capped content width. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

/** Big bold screen title with a small overline above it and an optional element on the right. */
export function ScreenHeader({
  overline,
  title,
  subtitle,
  right,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {overline ? (
          <ThemedText type="overline" themeColor="accentEnd">
            {overline}
          </ThemedText>
        ) : null}
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
});
