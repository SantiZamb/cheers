import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Storage from 'expo-sqlite/kv-store';
import type { ReactNode } from 'react';

/**
 * Local-first feel: every query result is persisted to SQLite on the device, so screens render
 * instantly from cache on launch and refresh in the background. Mutations update the cache
 * optimistically (see src/data/store.tsx), so the UI never waits on the network.
 */

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data immediately, refetch in the background after 30 s.
      staleTime: 30 * 1000,
      // Keep data around (and persisted) for a week so cold starts are instant.
      gcTime: 7 * DAY,
      retry: 2,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: Storage,
  key: 'cheers-query-cache',
  throttleTime: 1000,
});

/** Bump when cached data shapes change, so old caches are discarded instead of misread. */
const CACHE_VERSION = 'v1';

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * DAY, buster: CACHE_VERSION }}>
      {children}
    </PersistQueryClientProvider>
  );
}

/** Wipe everything cached, e.g. on sign-out, so the next account never sees the previous one's data. */
export async function clearCache() {
  queryClient.clear();
  await persister.removeClient();
}
