import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'friends';

let permission: Promise<boolean> | null = null;

/**
 * While the app is open, friend activity arrives through Realtime and is shown with the in-app
 * toast, so system banners are suppressed in the foreground (they still land in the list).
 */
export function configureNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks once, at the first moment it matters. */
export function ensureNotificationPermission() {
  if (Platform.OS === 'web') return Promise.resolve(false);
  permission ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Friend activity',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch {
      return false;
    }
  })();
  return permission;
}

/**
 * Gets this device's Expo push token so the database can push friend activity to it.
 * Needs an EAS project id (run `npx eas-cli@latest init` once); without it, returns null and
 * the app still gets live in-app updates through Supabase Realtime.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return null;
  if (!(await ensureNotificationPermission())) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('Push token unavailable', e);
    return null;
  }
}
