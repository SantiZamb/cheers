import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { BeerCardView } from '@/components/beer-card';
import { Card } from '@/components/card';
import { BadgesPage } from '@/components/badges-page';
import { CardViewer } from '@/components/card-viewer';
import { Chip } from '@/components/chip';
import { Rating } from '@/components/rating';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { cardsFor } from '@/data/cards';
import { KIND_LABELS } from '@/data/seed';
import { postHeadline, useStore } from '@/data/store';
import type { Post } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'beer' | 'night' | 'photos';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'beer', label: '🍺 Beers' },
  { id: 'night', label: '🌙 Nights' },
  { id: 'photos', label: '📸 Photos' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { state, me, myId, signOut, myCity, setProfilePhoto, openTutorial, badges } = useStore();
  const feedback = useFeedback();
  const [filter, setFilter] = useState<Filter>('all');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [badgesOpen, setBadgesOpen] = useState(false);

  const unlockedBadges = badges.filter((b) => b.unlocked).sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0));
  // Closest locked badge that's already under way: a nudge for what to do next.
  const nextBadge = badges
    .filter((b) => !b.unlocked && b.value > 0)
    .sort((a, b) => b.value / b.goal - a.value / a.goal)[0];

  const cards = cardsFor(state.posts, myId, state.customBeers);
  const openCard = cards.find((c) => c.beer.id === openCardId) ?? null;

  const pickProfilePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setProfilePhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Couldn’t open your photos', 'Allow photo access for Cheers in Settings.');
    }
  };

  const mine = state.posts
    .filter((p) => p.userId === myId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const beers = mine.filter((p) => p.kind === 'beer');
  const uniqueBeers = new Set(beers.map((p) => p.beer?.toLowerCase())).size;
  const nights = mine.filter((p) => p.kind === 'night').length;
  const rated = mine.filter((p) => p.rating);
  const avg = rated.length ? (rated.reduce((s, p) => s + p.rating!, 0) / rated.length).toFixed(1) : '–';
  const cheersReceived = mine.reduce(
    (sum, p) => sum + Object.values(p.reactions).reduce((s, users) => s + (users?.length ?? 0), 0),
    0
  );


  const filtered =
    filter === 'all'
      ? mine
      : filter === 'photos'
        ? mine.filter((p) => p.photo)
        : mine.filter((p) => p.kind === filter);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your posts stay safe in your account. Sign back in with your email anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[theme.accent, theme.accentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Pressable
            onPress={pickProfilePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={[styles.heroAvatar, { borderColor: theme.onAccent }]}>
            <Avatar user={me} size={72} />
            <View style={[styles.cameraBadge, { backgroundColor: theme.onAccent }]}>
              <Text style={styles.cameraEmoji}>📷</Text>
            </View>
          </Pressable>
          <View style={styles.flex}>
            <ThemedText type="overline" style={[styles.heroSoft, { color: theme.onAccent }]}>
              {me.name}
            </ThemedText>
            <ThemedText type="subtitle" style={{ color: theme.onAccent }}>
              {mine.length} posts
            </ThemedText>
            <ThemedText type="small" style={[styles.heroSoft, { color: theme.onAccent }]}>
              @{me.username}
              {myCity ? ` · 📍 ${myCity}` : ''} · {state.location.sharing === 'off' ? 'location hidden' : 'sharing location'}
            </ThemedText>
          </View>
        </LinearGradient>

        <View style={styles.stats}>
          <Stat label="Beers tried" value={String(uniqueBeers)} />
          <Stat label="Nights out" value={String(nights)} />
          <Stat label="Avg rating" value={avg} />
          <Stat label="Cheers got" value={String(cheersReceived)} />
        </View>

        <View style={styles.sectionHead}>
          <ThemedText type="overline" themeColor="textSecondary">
            Beer cards · {cards.length}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Drink it again to level up
          </ThemedText>
        </View>
        {cards.length === 0 ? (
          <ThemedText themeColor="textSecondary">Check in a beer to collect your first card.</ThemedText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {cards.map((c) => (
              <Pressable
                key={c.beer.id}
                onPress={() => {
                  feedback.select();
                  setOpenCardId(c.beer.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${c.beer.name} card, level ${c.level}`}
                style={({ pressed }) => pressed && styles.pressed}>
                <BeerCardView card={c} size="sm" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <ThemedText type="overline" themeColor="textSecondary">
          Badges
        </ThemedText>
        <Pressable
          onPress={() => {
            feedback.select();
            setBadgesOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Badges, ${unlockedBadges.length} of ${badges.length} unlocked`}
          style={({ pressed }) => pressed && styles.pressed}>
          <Card style={styles.badgesCard}>
            <View style={styles.badgeRow}>
              {unlockedBadges.length ? (
                unlockedBadges.slice(0, 5).map((b, i) => (
                  <Animated.View key={b.id} entering={ZoomIn.delay(i * 40).duration(180)}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                  </Animated.View>
                ))
              ) : (
                <Text style={[styles.badgeEmoji, styles.locked]}>🔒</Text>
              )}
              <View style={styles.flex} />
              <ThemedText type="smallBold" themeColor="accentEnd">
                See all ›
              </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold">
              {unlockedBadges.length} of {badges.length} unlocked
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {nextBadge
                ? `Next up: ${nextBadge.name} · ${nextBadge.value}/${nextBadge.goal}${nextBadge.unit ? ` ${nextBadge.unit}` : ''}`
                : 'Post, react and go out with friends to unlock them'}
            </ThemedText>
          </Card>
        </Pressable>
        <BadgesPage visible={badgesOpen} onClose={() => setBadgesOpen(false)} />

        <ThemedText type="overline" themeColor="textSecondary">
          History
        </ThemedText>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => {
                setFilter(f.id);
                feedback.select();
              }}
            />
          ))}
        </View>

        {filtered.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {filter === 'photos' ? 'No photos yet. Snap your next pint!' : 'Nothing here yet. Go make some memories 🍻'}
          </ThemedText>
        ) : filter === 'photos' ? (
          <View style={styles.grid}>
            {filtered.map((p) => (
              <Image key={p.id} source={{ uri: p.photo }} style={styles.gridPhoto} contentFit="cover" />
            ))}
          </View>
        ) : (
          groupByDay(filtered).map(([day, posts]) => (
            <Animated.View key={day} entering={FadeIn.duration(150)} style={styles.day}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {day.toUpperCase()}
              </ThemedText>
              {posts.map((p) => (
                <TimelineRow key={p.id} post={p} />
              ))}
            </Animated.View>
          ))
        )}

        <CardViewer card={openCard} onClose={() => setOpenCardId(null)} />

        <Pressable onPress={openTutorial} style={styles.reset} accessibilityRole="button">
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            How Cheers works
          </ThemedText>
        </Pressable>
        <Pressable onPress={confirmSignOut} style={styles.reset} accessibilityRole="button">
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Sign out
          </ThemedText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function TimelineRow({ post }: { post: Post }) {
  const theme = useTheme();
  const reactions = Object.values(post.reactions).reduce((s, u) => s + (u?.length ?? 0), 0);
  return (
    <Card style={styles.timelineRow}>
      {post.photo ? (
        <Image source={{ uri: post.photo }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmoji, { backgroundColor: theme.accentSoft }]}>
          <Text style={styles.thumbEmojiText}>{KIND_LABELS[post.kind].emoji}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {postHeadline(post).replace(/^your /, '')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {[post.brewery, post.venue, post.city].filter(Boolean).join(' · ')}
        </ThemedText>
        <View style={styles.rowMeta}>
          {post.rating ? (
            <Rating value={post.rating} size={12} emoji={post.kind === 'night' ? '🌟' : '🍺'} />
          ) : (
            <View />
          )}
          {reactions > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              🍻 {reactions} · 💬 {post.comments.length}
            </ThemedText>
          )}
        </View>
      </View>
    </Card>
  );
}

function groupByDay(posts: Post[]): [string, Post[]][] {
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const label = (d: Date) =>
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const groups = new Map<string, Post[]>();
  for (const p of posts) {
    const key = label(new Date(p.createdAt));
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()];
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.stat}>
      <ThemedText type="defaultSemiBold" style={[styles.statValue, { color: theme.accentEnd }]}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    marginTop: Spacing.three,
  },
  heroAvatar: {
    borderWidth: 3,
    borderRadius: 40,
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
    fontSize: 13,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cards: {
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  heroSoft: {
    opacity: 0.85,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 0,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.md,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  center: {
    textAlign: 'center',
  },
  badgesCard: {
    gap: Spacing.one,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  badgeEmoji: {
    fontSize: 30,
  },
  locked: {
    opacity: 0.4,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  gridPhoto: {
    width: '32.6%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
  },
  day: {
    gap: Spacing.two,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Spacing.two + Spacing.one,
  },
  thumbEmoji: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmojiText: {
    fontSize: 26,
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.half,
  },
  reset: {
    alignSelf: 'center',
    padding: Spacing.three,
  },
});
