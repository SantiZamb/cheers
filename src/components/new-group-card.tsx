import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { FriendPicker } from '@/components/friend-picker';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';

/** Inline "new group" form: photo, name, pick friends. */
export function NewGroupCard({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { friends, createGroup } = useStore();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Couldn’t open your photos', 'Allow photo access for Cheers in Settings.');
    }
  };

  const create = async () => {
    setBusy(true);
    const ok = await createGroup({ name: name.trim(), memberIds, photo });
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <Card style={styles.gap}>
      <View style={styles.head}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a group photo">
          <Avatar user={{ id: 'new-group', name: name || 'Group', username: '', city: '', photo }} size={64} />
          <View style={[styles.cameraBadge, { backgroundColor: theme.text }]}>
            <Text style={styles.cameraEmoji}>📷</Text>
          </View>
        </Pressable>
        <View style={styles.flex}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Group name
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tuesday Crew"
            placeholderTextColor={theme.textSecondary}
            maxLength={40}
            autoFocus
            style={[styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
          />
        </View>
      </View>

      <ThemedText type="smallBold" themeColor="textSecondary">
        Who’s in? {memberIds.length ? `· ${memberIds.length} picked` : ''}
      </ThemedText>
      {friends.length ? (
        <FriendPicker friends={friends} selected={memberIds} onChange={setMemberIds} />
      ) : (
        <Pressable onPress={() => router.navigate('/map')} accessibilityRole="button">
          <ThemedText type="small" themeColor="textSecondary">
            You need friends to fill a group.{' '}
            <ThemedText type="smallBold" themeColor="accentEnd">
              Find friends on the Map ›
            </ThemedText>
          </ThemedText>
        </Pressable>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onDone} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
        <GradientButton
          size="sm"
          label={busy ? 'Creating…' : 'Create group'}
          onPress={create}
          disabled={!name.trim() || !memberIds.length || busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraEmoji: {
    fontSize: 12,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.four,
  },
});
