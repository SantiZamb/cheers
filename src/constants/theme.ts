/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Clean & bold by day, nightlife by night: warm off-white with white cards in light mode,
 * near-black with lifted surfaces in dark mode. Amber → orange gradient (`accent` → `accentEnd`)
 * is reserved for primary actions, progress and highlights.
 */
export const Colors = {
  light: {
    text: '#111113',
    background: '#F6F5F2',
    /** Card / surface color. */
    backgroundElement: '#FFFFFF',
    /** Subtle fill: inputs, tracks, unselected chips. */
    backgroundSelected: '#EDEBE6',
    textSecondary: '#6E6D73',
    border: '#E7E4DE',
    accent: '#FF9F0A',
    accentEnd: '#FF5E1A',
    accentSoft: '#FFF0DC',
    onAccent: '#FFFFFF',
    glass: 'rgba(255,255,255,0.78)',
    shadow: 'rgba(17,17,19,0.08)',
  },
  dark: {
    text: '#F5F5F7',
    background: '#0A0A0C',
    backgroundElement: '#17171B',
    backgroundSelected: '#232329',
    textSecondary: '#9C9CA6',
    border: '#26262D',
    accent: '#FFB23F',
    accentEnd: '#FF6A2B',
    accentSoft: '#2B1D0C',
    onAccent: '#140B00',
    glass: 'rgba(23,23,27,0.72)',
    shadow: 'rgba(0,0,0,0.5)',
  },
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
