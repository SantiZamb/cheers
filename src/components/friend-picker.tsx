import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { User } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

/** Tap friends to pick them: avatar + first name pills that fill in when selected. */
export function FriendPicker({
  friends,
  selected,
  onChange,
}: {
  friends: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const theme = useTheme();
  const feedback = useFeedback();

  return (
    <View style={styles.wrap}>
      {friends.map((f) => {
        const on = selected.includes(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => {
              feedback.select();
              onChange(on ? selected.filter((id) => id !== f.id) : [...selected, f.id]);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={f.name}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: on ? theme.text : theme.backgroundElement,
                borderColor: on ? theme.text : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <Avatar user={f} size={24} />
            <ThemedText type="smallBold" numberOfLines={1} style={{ color: on ? theme.background : theme.text }}>
              {on ? '✓ ' : ''}
              {f.name.split(' ')[0]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 180,
  },
  pressed: {
    opacity: 0.75,
  },
});
