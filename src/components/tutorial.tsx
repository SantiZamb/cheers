import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { Rating } from '@/components/rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { TIERS } from '@/data/cards';
import { useStore } from '@/data/store';
import { REACTIONS, type Reaction } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

type Step = {
  emoji: string;
  overline: string;
  title: string;
  body: string;
  /** Where in the app this lives, and how it works. */
  points: { emoji: string; text: string }[];
  /** A tiny hands-on moment so it sticks. */
  tryIt?: ReactNode;
};

/**
 * Intro walkthrough, shown once after sign-up (and from Profile → "How Cheers works").
 * Swipe or tap Next; the last page jumps straight into sharing a beer or finding friends.
 */
export function Tutorial() {
  const { tutorialOpen, closeTutorial, me } = useStore();
  const theme = useTheme();
  const feedback = useFeedback();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const firstName = me.name.split(' ')[0];
  const steps: Step[] = [
    {
      emoji: '🍻',
      overline: 'Welcome',
      title: `Cheers, ${firstName}!`,
      body: 'Cheers is where your crew logs nights out: what you drank, where, and how good it was.',
      points: [
        { emoji: '📸', text: 'Snap and rate what you’re drinking' },
        { emoji: '👀', text: 'See what your friends are up to' },
        { emoji: '🏆', text: 'Battle your crew on group leaderboards' },
      ],
    },
    {
      emoji: '📸',
      overline: 'Share tab',
      title: 'Post in seconds',
      body: 'Tap Share in the middle of the tab bar. Add a photo, then pick what kind of post it is.',
      points: [
        { emoji: '🍺', text: 'Beer: pick it from the list (or type a new one) and rate it 1–5' },
        { emoji: '🌙', text: 'Night out: give it a title and how many beers it took' },
        { emoji: '📍', text: 'Check-in: just say where you are' },
      ],
      tryIt: <TryRating />,
    },
    {
      emoji: '🃏',
      overline: 'Profile tab',
      title: 'Every beer is a card',
      body: 'Each beer you check in becomes a card in your collection. Drink it again to level it up.',
      points: [
        { emoji: '⬆️', text: 'Same beer = full XP. Same brewery = half' },
        { emoji: '🏅', text: `${TIERS.map((t) => t.name).join(' → ')}` },
        { emoji: '🎖️', text: 'Unlock badges as you go' },
      ],
    },
    {
      emoji: '🔥',
      overline: 'Feed tab',
      title: 'Hype your friends',
      body: 'Your friends’ posts show up in the Feed. React with an emoji or leave a comment right on the post.',
      points: [
        { emoji: '🔔', text: 'You get a heads-up when friends react to yours' },
        { emoji: '🗺️', text: 'Tap a friend’s photo to see them on the map' },
      ],
      tryIt: <TryReactions />,
    },
    {
      emoji: '🗺️',
      overline: 'Map tab',
      title: 'Friends & bars nearby',
      body: 'Add friends by searching their name or @username on the Map. Then see who’s out right now.',
      points: [
        { emoji: '🔒', text: 'Location sharing is off until you pick City only or Exact spot' },
        { emoji: '🍻', text: 'Best bars nearby ranks bars by what friends rated them' },
        { emoji: '📍', text: 'Tap “Check in here” to post from a bar' },
      ],
    },
    {
      emoji: '🏆',
      overline: 'Groups tab',
      title: 'Your groups',
      body: 'Make a group with your crew, give it a name and a photo, and battle on the leaderboard.',
      points: [
        { emoji: '🥇', text: 'Rank by beers, posts, nights out, new beers and more' },
        { emoji: '👀', text: 'Tap a group to see its members and stats' },
      ],
    },
    {
      emoji: '🎉',
      overline: 'All set',
      title: 'You’re ready',
      body: 'Start with your first beer, or bring your friends in. You can replay this from your Profile anytime.',
      points: [],
    },
  ];
  const last = steps.length - 1;

  // Start from the first page every time it opens (the pager remounts with the modal).
  const [wasOpen, setWasOpen] = useState(tutorialOpen);
  if (tutorialOpen !== wasOpen) {
    setWasOpen(tutorialOpen);
    if (tutorialOpen) setPage(0);
  }

  const goTo = (next: number) => {
    feedback.select();
    setPage(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  };

  const finish = (to?: Href) => {
    closeTutorial();
    if (to) {
      feedback.pop();
      router.navigate(to);
    }
  };

  return (
    <Modal visible={tutorialOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => finish()}>
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.fill}>
          <View style={styles.top}>
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View
                  key={s.overline}
                  style={[
                    styles.dot,
                    { backgroundColor: i <= page ? theme.accentEnd : theme.border },
                    i === page && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            {page < last && (
              <Pressable onPress={() => finish()} hitSlop={12} accessibilityRole="button">
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Skip
                </ThemedText>
              </Pressable>
            )}
          </View>

          <ScrollView
            ref={scroll}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.fill}>
            {steps.map((step, i) => (
              <ScrollView key={step.overline} style={{ width }} contentContainerStyle={styles.page}>
                <Hero emoji={step.emoji} active={page === i} />
                <View style={styles.textBlock}>
                  <ThemedText type="overline" themeColor="accentEnd">
                    {step.overline}
                  </ThemedText>
                  <ThemedText type="subtitle">{step.title}</ThemedText>
                  <ThemedText themeColor="textSecondary">{step.body}</ThemedText>
                </View>
                {step.points.map((p) => (
                  <View key={p.text} style={styles.point}>
                    <Text style={styles.pointEmoji}>{p.emoji}</Text>
                    <ThemedText type="small" style={styles.flex}>
                      {p.text}
                    </ThemedText>
                  </View>
                ))}
                {step.tryIt}
                {i === last && (
                  <View style={styles.finalActions}>
                    <GradientButton label="🍺  Share my first beer" onPress={() => finish('/post')} />
                    <Pressable
                      onPress={() => finish('/map')}
                      style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}
                      accessibilityRole="button">
                      <ThemedText type="defaultSemiBold">👥  Find my friends</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => finish('/')} hitSlop={8} accessibilityRole="button" style={styles.center}>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        I’ll look around first
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            ))}
          </ScrollView>

          {page < last && (
            <View style={styles.bottom}>
              {page > 0 ? (
                <Pressable onPress={() => goTo(page - 1)} hitSlop={12} accessibilityRole="button">
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Back
                  </ThemedText>
                </Pressable>
              ) : (
                <View />
              )}
              <GradientButton label={page === 0 ? 'Show me around' : 'Next'} onPress={() => goTo(page + 1)} />
            </View>
          )}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

/** Big emoji on a gradient disc that bounces in when its page becomes active. */
function Hero({ emoji, active }: { emoji: string; active: boolean }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  useEffect(() => {
    if (!active) return;
    scale.set(withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 220 })));
  }, [active, scale]);

  return (
    <Animated.View style={[styles.heroWrap, style]}>
      <LinearGradient colors={[theme.accent, theme.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroEmoji}>{emoji}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const RATING_WORDS = ['', 'Drain pour 🫠', 'Meh', 'Solid 👍', 'Really good 😋', 'Life-changing 🤯'];

function TryRating() {
  const [value, setValue] = useState(0);
  const feedback = useFeedback();
  return (
    <TryCard label="Try it: rate this practice pint">
      <Rating
        value={value}
        size={32}
        onChange={(v) => {
          feedback.pop();
          setValue(v);
        }}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {value ? RATING_WORDS[value] : 'Tap a glass'}
      </ThemedText>
    </TryCard>
  );
}

function TryReactions() {
  const theme = useTheme();
  const feedback = useFeedback();
  const [mine, setMine] = useState<Reaction | null>(null);
  const counts: Record<Reaction, number> = { '🍻': 3, '🔥': 2, '😂': 0, '🤤': 1 };
  return (
    <TryCard label="Try it: react to Maya’s IPA">
      <View style={styles.reactions}>
        {REACTIONS.map((r) => {
          const on = mine === r;
          const n = counts[r] + (on ? 1 : 0);
          return (
            <Pressable
              key={r}
              onPress={() => {
                feedback.pop();
                setMine(on ? null : r);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.reaction,
                { backgroundColor: on ? theme.accentSoft : theme.backgroundSelected, borderColor: on ? theme.accent : 'transparent' },
              ]}>
              <Text style={styles.reactionEmoji}>{r}</Text>
              {n > 0 && <ThemedText type="smallBold">{n}</ThemedText>}
            </Pressable>
          );
        })}
      </View>
      {mine && (
        <Animated.View entering={FadeIn.duration(150)}>
          <ThemedText type="small" themeColor="accentEnd">
            Nice! Maya gets a heads-up that you reacted {mine}
          </ThemedText>
        </Animated.View>
      )}
    </TryCard>
  );
}

function TryCard({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.tryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one + Spacing.half,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
  },
  page: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  heroWrap: {
    alignSelf: 'center',
    marginVertical: Spacing.three,
  },
  hero: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 60,
  },
  textBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pointEmoji: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  tryCard: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two + Spacing.one,
    alignItems: 'flex-start',
  },
  reactions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  finalActions: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
