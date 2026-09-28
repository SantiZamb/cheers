import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ME_ID } from '@/data/seed';
import type { User } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

/** The current user's own photo; provided by the store (kept separate to avoid an import cycle). */
export const ProfilePhotoContext = createContext<string | undefined>(undefined);

/** Profile photo, or the user's initial on a gradient when there's no photo (or it fails to load). */
export function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  const theme = useTheme();
  const profilePhoto = useContext(ProfilePhotoContext);
  const uri = user.id === ME_ID ? profilePhoto : user.photo;
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

  const initial = user.id === ME_ID ? 'Me' : user.name.charAt(0).toUpperCase();
  return (
    <LinearGradient colors={[theme.accent, theme.accentEnd]} style={[shape, styles.center]}>
      <Text style={[styles.initial, { fontSize: size * (initial.length > 1 ? 0.34 : 0.42), color: theme.onAccent }]}>
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
