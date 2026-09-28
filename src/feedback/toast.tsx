import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { User } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export type ToastContent = {
  /** Shown on its own, or as a small badge on the user's photo. */
  emoji?: string;
  /** The friend this is about; shows their photo. */
  user?: User;
  title: string;
  body?: string;
};

export function Toast({ content }: { content: ToastContent }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + Spacing.one }]}>
      <Animated.View
        entering={SlideInUp.duration(220)}
        exiting={FadeOutUp.duration(160)}
        style={styles.shadow}>
        <Glass style={styles.toast}>
          {content.user ? (
            <View>
              <Avatar user={content.user} size={36} />
              {content.emoji ? (
                <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={styles.badgeEmoji}>{content.emoji}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emoji}>{content.emoji}</Text>
          )}
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {content.title}
            </ThemedText>
            {content.body ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {content.body}
              </ThemedText>
            ) : null}
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  shadow: {
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  emoji: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 12,
  },
  text: {
    flex: 1,
  },
});
