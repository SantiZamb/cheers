import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { FriendPicker } from '@/components/friend-picker';
import { groupAsUser } from '@/components/group-parts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Group } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

/**
 * Create or edit a group: photo, name and members. Nothing is saved until Save, so removing
 * someone can be undone before then.
 */
export function GroupForm({ group }: { group?: Group }) {
  const theme = useTheme();
  const feedback = useFeedback();
  const { friends, myId, userById, createGroup, renameGroup, setGroupPhoto, addGroupMembers, removeGroupMember } =
    useStore();
  const editing = !!group;

  const [name, setName] = useState(group?.name ?? '');
  const [newPhoto, setNewPhoto] = useState<string | undefined>();
  const [adding, setAdding] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const current = group?.memberIds ?? [myId];
  const addable = friends.filter((f) => !current.includes(f.id));
  // Only the creator removes people, unless the creator has left the group.
  const creatorStillIn = !!group?.createdBy && group.memberIds.includes(group.createdBy);
  const iCanRemove = editing && (group.createdBy === myId || !creatorStillIn);
  const canRemove = (userId: string) => iCanRemove && userId !== myId;

  const trimmed = name.trim();
  const changed =
    !editing || trimmed !== group.name || !!newPhoto || adding.length > 0 || removing.length > 0;
  const valid = trimmed.length > 0 && (editing || adding.length > 0);
  const memberCount = current.length - removing.length + adding.length;

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        feedback.pop();
        setNewPhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Couldn’t open your photos', 'Allow photo access for Cheers in Settings.');
    }
  };

  const save = async () => {
    if (!valid || !changed || busy) return;
    if (!editing) {
      setBusy(true);
      const id = await createGroup({ name: trimmed, memberIds: adding, photo: newPhoto });
      setBusy(false);
      if (id) router.replace({ pathname: '/groups/[id]', params: { id } });
      return;
    }
    if (trimmed !== group.name) renameGroup(group.id, trimmed);
    if (newPhoto) setGroupPhoto(group.id, newPhoto);
    if (adding.length) addGroupMembers(group.id, adding);
    for (const userId of removing) removeGroupMember(group.id, userId);
    feedback.toast({ emoji: '✅', title: 'Group updated', body: trimmed });
    router.back();
  };

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={[styles.bar, { borderColor: theme.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <ThemedText themeColor="textSecondary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">{editing ? 'Edit group' : 'New group'}</ThemedText>
          <Pressable
            onPress={save}
            disabled={!valid || !changed || busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid || !changed || busy }}>
            <ThemedText
              type="defaultSemiBold"
              themeColor={valid && changed && !busy ? 'accentEnd' : 'textSecondary'}>
              {busy ? 'Creating…' : editing ? 'Save' : 'Create'}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photoBlock}>
            <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Change group photo">
              <Avatar
                user={groupAsUser({ id: group?.id ?? 'new', name: trimmed || 'Group', photo: newPhoto ?? group?.photo })}
                size={120}
              />
              <View style={[styles.cameraBadge, { backgroundColor: theme.text, borderColor: theme.background }]}>
                <Text style={styles.cameraEmoji}>📷</Text>
              </View>
            </Pressable>
            <Pressable onPress={pickPhoto} hitSlop={8} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="accentEnd">
                {newPhoto || group?.photo ? 'Change photo' : 'Add a photo'}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.field}>
            <ThemedText type="overline" themeColor="textSecondary">
              Name
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Tuesday Crew"
              placeholderTextColor={theme.textSecondary}
              maxLength={40}
              autoFocus={!editing}
              returnKeyType="done"
              style={[styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="overline" themeColor="textSecondary">
              Members · {memberCount}
            </ThemedText>
            <Card style={styles.members}>
              {current.map((id, i) => {
                const user = userById(id);
                const removed = removing.includes(id);
                return (
                  <View key={id}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    <View style={[styles.member, removed && styles.removed]}>
                      <Avatar user={user} size={44} />
                      <View style={styles.flex}>
                        <ThemedText
                          type="defaultSemiBold"
                          numberOfLines={1}
                          style={removed && styles.strike}>
                          {user.name}
                          {id === myId ? ' (you)' : ''}
                        </ThemedText>
                        {user.username ? (
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            @{user.username}
                          </ThemedText>
                        ) : null}
                      </View>
                      {canRemove(id) && (
                        <Pressable
                          onPress={() => {
                            feedback.select();
                            setRemoving((r) => (removed ? r.filter((x) => x !== id) : [...r, id]));
                          }}
                          hitSlop={8}
                          style={[styles.pill, { borderColor: theme.border }]}
                          accessibilityRole="button"
                          accessibilityLabel={removed ? `Keep ${user.name}` : `Remove ${user.name}`}>
                          <ThemedText type="smallBold" themeColor={removed ? 'accentEnd' : 'textSecondary'}>
                            {removed ? 'Undo' : 'Remove'}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>
            {editing && !iCanRemove && group.memberIds.length > 1 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Only {userById(group.createdBy ?? '').name} (who made the group) can remove people. You can leave from the
                group’s page.
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText type="overline" themeColor="textSecondary">
              Add friends {adding.length ? `· ${adding.length} picked` : ''}
            </ThemedText>
            {addable.length ? (
              <Animated.View entering={FadeIn.duration(150)}>
                <FriendPicker friends={addable} selected={adding} onChange={setAdding} />
              </Animated.View>
            ) : (
              <ThemedText themeColor="textSecondary">
                {friends.length
                  ? 'All your friends are already in this group.'
                  : 'Add friends on the Map tab first, then bring them into a group.'}
              </ThemedText>
            )}
            {!editing && !adding.length && addable.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                Pick at least one friend to start the group.
              </ThemedText>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  photoBlock: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraEmoji: {
    fontSize: 16,
  },
  field: {
    gap: Spacing.three,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  members: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  removed: {
    opacity: 0.5,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44 + Spacing.three,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
