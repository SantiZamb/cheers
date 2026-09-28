import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Avatar } from '@/components/avatar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { User } from '@/data/types';
import type { Bar } from '@/lib/bars';

export type MapFriend = { user: User; outNow: boolean };

export type CheersMapProps = {
  mode: 'friends' | 'bars';
  me?: { lat: number; lng: number };
  friends: MapFriend[];
  bars: Bar[];
  radius: number;
  selectedBarId: string | null;
  focusFriendId: string | null;
  onSelectBar: (id: string) => void;
  onSelectFriend: (id: string) => void;
  /** Space covered by overlays (header on top, sheet at the bottom) so fitting avoids them. */
  edgePadding: { top: number; bottom: number };
  style?: StyleProp<ViewStyle>;
};

const METERS_PER_DEGREE = 111_000;

export function CheersMap({
  mode,
  me,
  friends,
  bars,
  radius,
  selectedBarId,
  focusFriendId,
  onSelectBar,
  onSelectFriend,
  edgePadding,
  style,
}: CheersMapProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  // Frame the map for the current mode. Friends are spread across the world, bars are local.
  useEffect(() => {
    if (!ready || !map.current) return;
    if (mode === 'bars' && me) {
      const delta = ((radius * 2.6) / METERS_PER_DEGREE) * 1.1;
      map.current.animateToRegion(
        { latitude: me.lat, longitude: me.lng, latitudeDelta: delta, longitudeDelta: delta },
        350
      );
    } else if (mode === 'friends') {
      const points = friends.map((f) => ({ latitude: f.user.lat, longitude: f.user.lng }));
      if (me) points.push({ latitude: me.lat, longitude: me.lng });
      if (points.length) {
        map.current.fitToCoordinates(points, {
          edgePadding: { top: edgePadding.top + 40, bottom: edgePadding.bottom + 40, left: 50, right: 50 },
          animated: true,
        });
      }
    }
    // Re-frame only when the mode, radius or own position change, not on every friend update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, radius, me?.lat, me?.lng]);

  useEffect(() => {
    if (!ready || !map.current || !focusFriendId) return;
    const friend = friends.find((f) => f.user.id === focusFriendId);
    if (!friend) return;
    map.current.animateToRegion(
      { latitude: friend.user.lat, longitude: friend.user.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      450
    );
  }, [ready, focusFriendId, friends]);

  useEffect(() => {
    if (!ready || !map.current || !selectedBarId) return;
    const bar = bars.find((b) => b.id === selectedBarId);
    if (!bar) return;
    map.current.animateToRegion(
      { latitude: bar.lat, longitude: bar.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      350
    );
  }, [ready, selectedBarId, bars]);

  return (
    <MapView
      ref={map}
      style={style}
      onMapReady={() => setReady(true)}
      userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      initialRegion={{
        latitude: me?.lat ?? 40,
        longitude: me?.lng ?? -40,
        latitudeDelta: 80,
        longitudeDelta: 80,
      }}>
      {mode === 'bars' && me && (
        <Circle
          center={{ latitude: me.lat, longitude: me.lng }}
          radius={radius}
          strokeColor={theme.accentEnd}
          strokeWidth={2}
          fillColor={scheme === 'dark' ? 'rgba(255,178,63,0.12)' : 'rgba(255,159,10,0.12)'}
        />
      )}

      {mode === 'friends' &&
        friends.map((f) => (
          <Marker
            key={f.user.id}
            coordinate={{ latitude: f.user.lat, longitude: f.user.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSelectFriend(f.user.id)}>
            <FriendPin friend={f} selected={focusFriendId === f.user.id} />
          </Marker>
        ))}

      {mode === 'bars' &&
        bars.map((b, i) => (
          <Marker
            key={b.id}
            coordinate={{ latitude: b.lat, longitude: b.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSelectBar(b.id)}
            zIndex={selectedBarId === b.id ? 100 : 50 - i}>
            <BarPin rank={i + 1} selected={selectedBarId === b.id} />
          </Marker>
        ))}

      {me && (
        <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} anchor={{ x: 0.5, y: 0.5 }} zIndex={200}>
          <View style={[styles.me, { borderColor: theme.backgroundElement, backgroundColor: theme.accentEnd }]} />
        </Marker>
      )}
    </MapView>
  );
}

function FriendPin({ friend, selected }: { friend: MapFriend; selected: boolean }) {
  const theme = useTheme();
  const ring = friend.outNow ? [theme.accent, theme.accentEnd] as const : [theme.border, theme.border] as const;
  return (
    <View style={styles.pinWrap}>
      <LinearGradient colors={ring} style={[styles.ring, selected && styles.ringSelected]}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          <Avatar user={friend.user} size={38} />
        </View>
      </LinearGradient>
      <View style={[styles.nameTag, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.nameText, { color: theme.text }]}>{friend.user.name}</Text>
      </View>
    </View>
  );
}

/** Top 3 get gradient pins, up to 10 get numbered pins, the rest are small dots to keep the map calm. */
function BarPin({ rank, selected }: { rank: number; selected: boolean }) {
  const theme = useTheme();
  if (!selected && rank > 10) {
    return <View style={[styles.barDot, { backgroundColor: theme.textSecondary, borderColor: theme.backgroundElement }]} />;
  }
  if (selected || rank <= 3) {
    return (
      <LinearGradient
        colors={[theme.accent, theme.accentEnd]}
        style={[styles.barPin, selected && styles.barPinSelected]}>
        <Text style={[styles.barRank, { color: theme.onAccent }]}>{rank}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.barPin, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }]}>
      <Text style={[styles.barRank, { color: theme.text }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  me: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  pinWrap: {
    alignItems: 'center',
  },
  ring: {
    padding: 2.5,
    borderRadius: 26,
  },
  ringSelected: {
    transform: [{ scale: 1.15 }],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameTag: {
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barPin: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  barPinSelected: {
    transform: [{ scale: 1.3 }],
  },
  barRank: {
    fontSize: 12,
    fontWeight: '800',
  },
});
