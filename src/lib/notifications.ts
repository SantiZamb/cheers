import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'friends';

let permission: Promise<boolean> | null = null;

/**
 * While the app is open, friend activity is shown with the in-app toast instead,
 * so system banners are suppressed in the foreground (they still land in the list).
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

/** Asks once, at the first moment it matters (the user's first post). */
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
 * Schedules a local notification that shows up if the user has left the app by then.
 * `url` is the route to open when it's tapped.
 */
export async function notifyLater(title: string, body: string, seconds: number, url: string) {
  if (!(await ensureNotificationPermission())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { url }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        repeats: false,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // Notifications are a bonus; the in-app experience works without them.
  }
}

export function cancelScheduledNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
