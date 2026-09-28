import { StyleSheet, Text, View } from 'react-native';

import type { User } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentSoft },
      ]}>
      <Text style={{ fontSize: size * 0.55 }}>{user.avatar}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
