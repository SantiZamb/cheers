import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { beerColor, isDarkBeer, type Beer } from '@/data/beers';
import { LEVELS_PER_TIER, TIERS, type BeerCard } from '@/data/cards';

const SIZES = {
  sm: { width: 118, name: 13, meta: 10, pad: 8, radius: 14 },
  md: { width: 150, name: 15, meta: 11, pad: 10, radius: 16 },
  lg: { width: 280, name: 24, meta: 14, pad: 16, radius: 24 },
} as const;

/** A collectible beer card, colored by tier (Bronze → Legendary) with level pips. */
export function BeerCardView({ card, size = 'md' }: { card: BeerCard; size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  const tier = TIERS[card.tierIndex];

  return (
    <LinearGradient
      colors={tier.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: s.width, padding: s.pad, borderRadius: s.radius, gap: s.pad * 0.7 }]}>
      <View style={styles.top}>
        <Text style={[styles.tier, { color: tier.ink, fontSize: s.meta }]}>{tier.name.toUpperCase()}</Text>
        <Text style={[styles.level, { color: tier.ink, fontSize: s.meta + 1 }]}>Lv {card.level}</Text>
      </View>

      <View style={[styles.art, { borderRadius: s.radius - s.pad / 2 }]}>
        {card.photo ? (
          <Image source={{ uri: card.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <GlassArt beer={card.beer} scale={s.width / 150} />
        )}
      </View>

      <View style={styles.info}>
        <Text
          numberOfLines={2}
          style={[styles.name, { color: tier.ink, fontSize: s.name, lineHeight: s.name * 1.2, minHeight: s.name * 2.4 }]}>
          {card.beer.name}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: tier.ink, fontSize: s.meta }]}>
          {card.beer.brewery}
          {card.beer.abv ? ` · ${card.beer.abv}%` : ''}
        </Text>
      </View>

      <View style={styles.pips}>
        {Array.from({ length: LEVELS_PER_TIER }, (_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              {
                backgroundColor: tier.ink,
                opacity: i < card.levelInTier ? 1 : 0.25,
                height: size === 'lg' ? 6 : 4,
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

/** Stylized pint in the beer's color, used when there's no photo of it yet. */
export function GlassArt({ beer, scale = 1 }: { beer: Beer; scale?: number }) {
  const color = beerColor(beer.style);
  const dark = isDarkBeer(beer.style);
  return (
    <View style={styles.glassWrap}>
      <View style={[styles.glass, { width: 46 * scale, height: 62 * scale, borderRadius: 8 * scale }]}>
        <View style={[styles.foam, { height: 12 * scale, backgroundColor: dark ? '#E9D9C0' : '#FFFDF6' }]} />
        <LinearGradient
          colors={[color, dark ? '#0D0805' : shade(color)]}
          style={styles.liquid}
        />
      </View>
      <Text style={[styles.style, { fontSize: 10 * scale }]}>{beer.style}</Text>
    </View>
  );
}

/** Slightly darker version of a hex color for the bottom of the glass. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.7));
  const r = f(n >> 16);
  const g = f((n >> 8) & 0xff);
  const b = f(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tier: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  level: {
    fontWeight: '800',
  },
  art: {
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  info: {
    gap: 1,
  },
  name: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  meta: {
    fontWeight: '600',
    opacity: 0.8,
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    flex: 1,
    borderRadius: 3,
  },
  glassWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  glass: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderTopWidth: 0,
  },
  foam: {
    width: '100%',
  },
  liquid: {
    flex: 1,
  },
  style: {
    fontWeight: '700',
    color: 'rgba(0,0,0,0.55)',
    letterSpacing: 0.5,
  },
});
