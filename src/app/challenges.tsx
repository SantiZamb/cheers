import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/card';
import { ChallengeCard } from '@/components/challenge-card';
import { GroupCard } from '@/components/group-card';
import { NewGroupCard } from '@/components/new-group-card';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { ChallengeTemplate } from '@/data/api';
import { CHALLENGE_TEMPLATES } from '@/data/seed';
import { useChallengeStatus, useStore } from '@/data/store';

export default function ChallengesScreen() {
  const { state, friends, startChallenge, refresh } = useStore();
  const statusOf = useChallengeStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const withStatus = state.challenges.map((c) => ({ c, s: statusOf(c) }));
  const invites = withStatus.filter(({ s }) => s.active && !s.joined);
  const active = withStatus.filter(({ s }) => s.active && s.joined);
  const ended = withStatus.filter(({ s }) => !s.active);

  const sections = [
    { title: 'Invites', items: invites },
    { title: 'In progress', items: active },
    { title: 'Past challenges', items: ended },
  ].filter((section) => section.items.length > 0);

  const start = (template: ChallengeTemplate) => {
    if (!friends.length) {
      Alert.alert('Add friends first', 'Challenges are more fun together. Find friends on the Map tab.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Find friends', onPress: () => router.navigate('/map') },
      ]);
      return;
    }
    Alert.alert(
      `Start “${template.title}”?`,
      `Runs for ${template.days} days. All ${friends.length} of your friends get an invite.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setStarting(template.id);
            await startChallenge(
              template,
              friends.map((f) => f.id)
            );
            setStarting(null);
          },
        },
      ]
    );
  };

  let i = 0;
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }>
        <ScreenHeader
          overline="Together"
          title="Challenges"
          subtitle="Your groups and challenges. Do it together, wherever you are."
        />

        <View style={styles.sectionHead}>
          <ThemedText type="overline" themeColor="textSecondary">
            Your groups
          </ThemedText>
          {!creatingGroup && (
            <Pressable onPress={() => setCreatingGroup(true)} hitSlop={8} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="accentEnd">
                + New group
              </ThemedText>
            </Pressable>
          )}
        </View>
        {creatingGroup && (
          <Animated.View entering={FadeIn.duration(200)}>
            <NewGroupCard onDone={() => setCreatingGroup(false)} />
          </Animated.View>
        )}
        {state.groups.length === 0 && !creatingGroup && (
          <Pressable
            onPress={() => setCreatingGroup(true)}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}>
            <Card style={styles.template}>
              <Text style={styles.templateEmoji}>👯</Text>
              <View style={styles.flex}>
                <ThemedText type="defaultSemiBold">Start a group</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Name your crew, add a photo and see who drinks the most beers, posts the most and more.
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="accentEnd">
                Create
              </ThemedText>
            </Card>
          </Pressable>
        )}
        {state.groups.map((g) => (
          <Animated.View key={g.id} entering={FadeInDown.duration(200)}>
            <GroupCard group={g} />
          </Animated.View>
        ))}
        {sections.map((section) => [
          <ThemedText key={section.title} type="overline" themeColor="textSecondary" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>,
          ...section.items.map(({ c }) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i++ * 40).duration(200)}>
              <ChallengeCard challenge={c} />
            </Animated.View>
          )),
        ])}

        <ThemedText type="overline" themeColor="textSecondary" style={styles.sectionTitle}>
          Start a challenge
        </ThemedText>
        {CHALLENGE_TEMPLATES.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => start(t)}
            disabled={!!starting}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}>
            <Card style={styles.template}>
              <Text style={styles.templateEmoji}>{t.badge.emoji}</Text>
              <View style={styles.flex}>
                <ThemedText type="defaultSemiBold">{t.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.description}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="accentEnd">
                {starting === t.id ? '…' : 'Start'}
              </ThemedText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  template: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  templateEmoji: {
    fontSize: 30,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
