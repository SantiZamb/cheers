import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { StoreProvider } from '@/data/store';
import { FeedbackProvider } from '@/feedback/feedback';
import { configureNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Tapping a friend-activity notification opens the relevant tab.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/' || url === '/challenges') router.navigate(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <FeedbackProvider>
        <StoreProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </StoreProvider>
      </FeedbackProvider>
    </ThemeProvider>
  );
}
