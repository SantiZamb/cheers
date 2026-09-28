import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, ZoomIn } from 'react-native-reanimated';

import { BeerCardView } from '@/components/beer-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { LEVELS_PER_TIER, MAX_LEVEL, TIERS, type BeerCard } from '@/data/cards';
import { useTheme } from '@/hooks/use-theme';

/** Full-size card with what it takes to reach the next level and tier. */
export function CardViewer({ card, onClose }: { card: BeerCard | null; onClose: () => void }) {
  const theme = useTheme();
  if (!card) return null;

  const nextTierLevel = (card.tierIndex + 1) * LEVELS_PER_TIER + 1;
  const nextTier = TIERS[card.tierIndex + 1];

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close card">
        <Animated.View entering={ZoomIn.duration(220).easing(Easing.out(Easing.back(1.4)))}>
          <BeerCardView card={card} size="lg" />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(120).duration(180)}
          style={[styles.details, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="defaultSemiBold">
            {card.maxed ? 'Maxed out. Legendary status.' : `Level ${card.level} of ${MAX_LEVEL}`}
          </ThemedText>
          {!card.maxed && (
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.fill, { width: `${Math.max(card.progress, 0.04) * 100}%`, backgroundColor: theme.accentEnd }]} />
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Had {card.count} {card.count === 1 ? 'time' : 'times'}
            {card.breweryCount ? ` · +${card.breweryCount} from other ${card.beer.brewery} beers` : ''}
          </ThemedText>
          {!card.maxed && (
            <ThemedText type="small" themeColor="textSecondary">
              Another {card.beer.name} = +1 level · another {card.beer.brewery} beer = +½ level (up to as
              many as you’ve had of this one).
              {nextTier ? ` ${nextTier.name} unlocks at Lv ${nextTierLevel}.` : ''}
            </ThemedText>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  details: {
    width: 300,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
