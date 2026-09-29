import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarsPanel, type BarSearch } from '@/components/bars-panel';
import { CheersMap, type MapFriend } from '@/components/cheers-map';
import { FriendsPanel, useOutNow } from '@/components/friends-panel';
import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useFeedback } from '@/feedback/feedback';
import { findBestBars } from '@/lib/bars';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'friends' | 'bars';

const LOCATION_FRESH_MS = 5 * 60 * 1000;
const SHEET_OVERLAP = 28;
/** Room left above the sheet for the Friends / Bars switch when the map is tucked away. */
const COLLAPSED_BAR = 60;

const isFresh = (updatedAt: number) => Date.now() - updatedAt < LOCATION_FRESH_MS;

/** Friends around the world and the best bars around you, on one map. */
export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { state, friends: allFriends, refreshMyLocation, mapFocus, setMapFocus } = useStore();
  const feedback = useFeedback();
  const isOut = useOutNow();

  const [mode, setMode] = useState<Mode>('friends');
  const [radius, setRadius] = useState(1000);
  const [search, setSearch] = useState<BarSearch>({ status: 'idle' });
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sheetScroll = useRef<ScrollView>(null);

  // "List only": the map slides up out of the way, e.g. while searching for friends.
  const [listOnly, setListOnlyState] = useState(false);
  const collapse = useSharedValue(0);
  const setListOnly = (next: boolean) => {
    setListOnlyState(next);
    collapse.set(withTiming(next ? 1 : 0, { duration: 250 }));
  };

  // Arriving from the feed with a friend to show: switch to the friends view.
  const [lastFocus, setLastFocus] = useState(mapFocus);
  if (mapFocus !== lastFocus) {
    setLastFocus(mapFocus);
    if (mapFocus) setMode('friends');
  }

  // Show "you" on the map without prompting: only if location access was granted before.
  useEffect(() => {
    if (!state.location.me) refreshMyLocation({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapHeight = Math.round(height * 0.44);
  const collapsedHeight = insets.top + COLLAPSED_BAR;
  const mapBoxStyle = useAnimatedStyle(() => ({
    height: interpolate(collapse.get(), [0, 1], [mapHeight, collapsedHeight]) + SHEET_OVERLAP,
  }));
  const mapFadeStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.get() }));

  const me = state.location.me;
  // Only friends currently sharing their location have a position to plot.
  const friends: MapFriend[] = allFriends.flatMap((user) =>
    user.lat != null && user.lng != null ? [{ user: { ...user, lat: user.lat, lng: user.lng }, outNow: isOut(user.id) }] : []
  );
  const bars = search.status === 'done' ? search.bars : [];

  const runSearch = async (r = radius) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSelectedBarId(null);

    let location = me && isFresh(me.updatedAt) ? me : undefined;
    if (!location) {
      setSearch({ status: 'locating' });
      location = (await refreshMyLocation()) ?? undefined;
      if (controller.signal.aborted) return;
      if (!location) {
        setSearch({ status: 'denied' });
        return;
      }
    }

    setSearch({ status: 'loading' });
    try {
      const found = await findBestBars(location, r, state.posts, controller.signal);
      if (controller.signal.aborted) return;
      setSearch({ status: 'done', bars: found });
      feedback.pop();
    } catch {
      if (!controller.signal.aborted) setSearch({ status: 'error' });
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    feedback.select();
    setMode(next);
    // Bars are all about the map.
    if (next === 'bars' && listOnly) setListOnly(false);
    if (next === 'bars' && search.status === 'idle' && me) runSearch();
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.mapBox, mapBoxStyle]}>
        <Animated.View style={mapFadeStyle} pointerEvents={listOnly ? 'none' : 'auto'}>
          <CheersMap
            style={{ height: mapHeight + SHEET_OVERLAP }}
            mode={mode}
            me={me}
            friends={friends}
            bars={bars}
            radius={radius}
            selectedBarId={selectedBarId}
            focusFriendId={mapFocus}
            onSelectBar={(id) => {
              feedback.select();
              setSelectedBarId(id);
            }}
            onSelectFriend={(id) => {
              feedback.select();
              setMapFocus(id);
            }}
            edgePadding={{ top: insets.top + 56, bottom: SHEET_OVERLAP }}
          />
        </Animated.View>
      </Animated.View>

      <View style={[styles.segmentWrap, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
        <Glass style={styles.segment}>
          {(['friends', 'bars'] as const).map((m) => {
            const selected = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.segmentItem, selected && { backgroundColor: theme.text }]}>
                <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
                  {m === 'friends' ? '👥 Friends' : '🍻 Best bars nearby'}
                </ThemedText>
              </Pressable>
            );
          })}
        </Glass>
      </View>

      <ThemedView style={[styles.sheet, { marginTop: -SHEET_OVERLAP }]}>
        {mode === 'friends' && (
          <Pressable
            onPress={() => {
              feedback.select();
              if (listOnly) Keyboard.dismiss();
              setListOnly(!listOnly);
            }}
            hitSlop={8}
            style={styles.handle}
            accessibilityRole="button"
            accessibilityLabel={listOnly ? 'Show the map' : 'Hide the map'}>
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {listOnly ? '⌄  Show map' : '⌃  Friends only'}
            </ThemedText>
          </Pressable>
        )}
        <ScrollView
          ref={sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets>
          <Animated.View key={mode} entering={FadeIn.duration(150)}>
            {mode === 'friends' ? (
              <FriendsPanel
                focusedId={mapFocus}
                onFocus={setMapFocus}
                onSearchFocus={(y) => {
                  if (!listOnly) setListOnly(true);
                  // Bring the search box to the top, results appear right under it.
                  sheetScroll.current?.scrollTo({ y, animated: true });
                }}
                onSearchBlur={(query) => {
                  if (!query.trim()) setListOnly(false);
                }}
              />
            ) : (
              <BarsPanel
                radius={radius}
                search={search}
                selectedId={selectedBarId}
                onRadius={(r) => {
                  setRadius(r);
                  if (search.status !== 'idle') runSearch(r);
                }}
                onSearch={() => runSearch()}
                onSelect={(id) => setSelectedBarId((cur) => (cur === id ? null : id))}
              />
            )}
          </Animated.View>
        </ScrollView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapBox: {
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  segmentWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Radius.pill,
    gap: Spacing.one,
  },
  segmentItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    overflow: 'hidden',
  },
  sheetContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
