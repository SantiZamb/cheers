import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { createSeedState, STATE_VERSION } from '@/data/seed';
import type { AppState } from '@/data/types';

// On web everything stays in memory; on device, state is a JSON file and photos are copied
// out of the image picker's temporary cache so the history survives restarts.
const persistent = Platform.OS !== 'web';

const stateFile = () => new File(Paths.document, 'cheers-state.json');
const photosDir = () => new Directory(Paths.document, 'photos');

export function loadState(): AppState {
  if (persistent) {
    try {
      const file = stateFile();
      if (file.exists) {
        const parsed = JSON.parse(file.textSync()) as AppState;
        if (parsed.version === STATE_VERSION) return parsed;
      }
    } catch (e) {
      console.warn('Could not load saved state, starting fresh', e);
    }
  }
  return createSeedState();
}

export function saveState(state: AppState) {
  if (!persistent) return;
  try {
    const file = stateFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state', e);
  }
}

/** Copies a picked photo into app storage and returns its permanent URI. */
export function persistPhoto(uri: string): string {
  if (!persistent) return uri;
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create();
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = new File(dir, `${Date.now()}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn('Could not save photo, using temporary copy', e);
    return uri;
  }
}

export function clearPhotos() {
  if (!persistent) return;
  try {
    const dir = photosDir();
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('Could not clear photos', e);
  }
}
