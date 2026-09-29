import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False until .env.local has the project URL and publishable key; the app shows setup help instead. */
export const isSupabaseConfigured = !!url && !!key;

/** The session is kept in SQLite-backed localStorage, so users stay signed in across launches. */
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground (recommended for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const POST_PHOTOS_BUCKET = 'post-photos';
export const AVATARS_BUCKET = 'avatars';

export function avatarUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}
