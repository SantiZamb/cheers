import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BeerCardView } from '@/components/beer-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { beerColor, customBeerId, searchBeers, type Beer } from '@/data/beers';
import { cardsFor, levelForXp, tierOf, type BeerCard } from '@/data/cards';
import { ME_ID } from '@/data/seed';
import { useStore } from '@/data/store';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

const MAX_RESULTS = 6;

/** Search-and-select for the beer being checked in, previewing the card it earns or upgrades. */
export function BeerPicker({ value, onChange }: { value: Beer | null; onChange: (beer: Beer | null) => void }) {
  const theme = useTheme();
  const { state } = useStore();
  const feedback = useFeedback();
  const [query, setQuery] = useState('');

  const cards = cardsFor(state.posts, ME_ID, state.customBeers);
  const cardFor = (beer: Beer) => cards.find((c) => c.beer.id === beer.id);

  if (value) {
    const current = cardFor(value);
    return (
      <Animated.View entering={FadeIn.duration(150)} style={[styles.selected, { backgroundColor: theme.backgroundSelected }]}>
        <BeerCardView card={current ?? previewCard(value)} size="sm" />
        <View style={styles.selectedInfo}>
          <ThemedText type="overline" themeColor="accentEnd">
            {current ? 'Levels up your card' : 'New card!'}
          </ThemedText>
          <ThemedText type="defaultSemiBold">{value.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {value.brewery} · {value.style}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {current ? nextLevelLabel(current) : 'Check in to collect it'}
          </ThemedText>
          <Pressable
            onPress={() => {
              onChange(null);
              feedback.select();
            }}
            hitSlop={8}
            accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accentEnd }}>
              Change beer
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  const results = searchBeers(query, state.customBeers)
    // Beers you already have cards for come first when not searching.
    .sort((a, b) => (query ? 0 : (cardFor(b)?.xp ?? 0) - (cardFor(a)?.xp ?? 0)))
    .slice(0, MAX_RESULTS);
  const typed = query.trim();
  const exact = results.some((b) => b.name.toLowerCase() === typed.toLowerCase());

  const choose = (beer: Beer) => {
    onChange(beer);
    setQuery('');
    feedback.pop();
  };

  return (
    <View style={styles.gap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Which beer? Search by name or brewery"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
      />
      <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        {results.map((beer, i) => {
          const card = cardFor(beer);
          return (
            <Pressable
              key={beer.id}
              onPress={() => choose(beer)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}
              accessibilityRole="button">
              <View style={[styles.dot, { backgroundColor: beerColor(beer.style) }]} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {beer.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {beer.brewery} · {beer.style}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color: card ? theme.accentEnd : theme.textSecondary }}>
                {card ? `Lv ${card.level}` : 'New'}
              </ThemedText>
            </Pressable>
          );
        })}
        {typed && !exact ? (
          <Pressable
            onPress={() =>
              choose({ id: customBeerId(typed), name: typed, brewery: 'Unknown brewery', style: 'Beer' })
            }
            style={[styles.row, results.length > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accentEnd }}>
              + Add “{typed}”
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function nextLevelLabel(card: BeerCard) {
  if (card.maxed) return 'Card is maxed out';
  const nextXp = card.xp + 2;
  const level = levelForXp(nextXp);
  const { tier } = tierOf(level);
  return level > card.level ? `Lv ${card.level} → Lv ${level} ${tier.name}` : `Lv ${card.level}, halfway to ${card.level + 1}`;
}

/** What the card will look like after the first check-in. */
function previewCard(beer: Beer): BeerCard {
  return {
    beer,
    count: 1,
    breweryCount: 0,
    xp: 2,
    level: 1,
    tierIndex: 0,
    levelInTier: 1,
    progress: 0,
    maxed: false,
    firstAt: 0,
  };
}

const styles = StyleSheet.create({
  gap: {
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
    fontSize: 16,
  },
  list: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  selected: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  selectedInfo: {
    flex: 1,
    gap: Spacing.one,
  },
});
