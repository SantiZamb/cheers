import { ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ChallengeCard } from '@/components/challenge-card';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { challengeStatus } from '@/data/challenges';
import { useStore } from '@/data/store';

export default function ChallengesScreen() {
  const { state } = useStore();
  const withStatus = state.challenges.map((c) => ({ c, s: challengeStatus(c, state.posts) }));
  const invites = withStatus.filter(({ s }) => s.active && !s.joined);
  const active = withStatus.filter(({ s }) => s.active && s.joined);
  const ended = withStatus.filter(({ s }) => !s.active);

  const sections = [
    { title: 'Invites', items: invites },
    { title: 'This week', items: active },
    { title: 'Past challenges', items: ended },
  ].filter((section) => section.items.length > 0);

  let i = 0;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          overline="Together"
          title="Challenges"
          subtitle="Do it together, wherever you are. Finish to earn a badge."
        />
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
  sectionTitle: {
    marginTop: Spacing.two,
  },
});
