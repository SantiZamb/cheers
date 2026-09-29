import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * The Groups tab is a stack: the list pushes a group's page; creating and editing open as
 * sheets over it.
 */
export default function GroupsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accentEnd,
        headerTitleStyle: { color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: '', headerBackTitle: 'Groups' }} />
      <Stack.Screen name="new" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="[id]/edit" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}
