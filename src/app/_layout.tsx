import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { OnboardingScreen } from '@/auth/onboarding-screen';
import { SetupNeededScreen } from '@/auth/setup-needed-screen';
import { SignInScreen } from '@/auth/sign-in-screen';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Tutorial } from '@/components/tutorial';
import { StoreProvider, useStore } from '@/data/store';
import { FeedbackProvider } from '@/feedback/feedback';
import { configureNotifications } from '@/lib/notifications';
import { QueryProvider } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Tapping a push notification opens the relevant tab.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/' || url === '/challenges' || url === '/map') router.navigate(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryProvider>
        <AuthProvider>
          <FeedbackProvider>
            <AnimatedSplashOverlay />
            <Gate />
          </FeedbackProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

/** Setup help → sign-in → onboarding → the app (with the intro tutorial on top, once). */
function Gate() {
  const { loading, userId } = useAuth();
  if (!isSupabaseConfigured) return <SetupNeededScreen />;
  if (loading) return null;
  if (!userId) return <SignInScreen />;
  return (
    // Keyed by user so switching accounts starts from a clean store.
    <StoreProvider key={userId} myId={userId}>
      <SignedIn />
    </StoreProvider>
  );
}

function SignedIn() {
  const { profileStatus } = useStore();
  if (profileStatus === 'loading') return null;
  if (profileStatus === 'needsOnboarding') return <OnboardingScreen />;
  return (
    <>
      <AppTabs />
      {/* Over the tabs, so its last page can drop you straight into Share or Map. */}
      <Tutorial />
    </>
  );
}
