import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { User } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

/** Profile photo, or the user's initial on a gradient when there's no photo (or it fails to load). */
export function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  const theme = useTheme();
  const uri = user.photo;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        onError={() => setFailedUri(uri)}
        accessibilityLabel={user.name}
      />
    );
  }

  const initial = (user.name.trim().charAt(0) || '?').toUpperCase();
  return (
    <LinearGradient colors={[theme.accent, theme.accentEnd]} style={[shape, styles.center]}>
      <Text style={[styles.initial, { fontSize: size * 0.42, color: theme.onAccent }]}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '800',
  },
});
