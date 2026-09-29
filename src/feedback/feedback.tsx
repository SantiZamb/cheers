import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Celebration, type CelebrationContent } from '@/feedback/celebration';
import { Toast, type ToastContent } from '@/feedback/toast';

/**
 * Every rewarding moment in the app goes through here so it feels consistent:
 * haptics + a short sound + a visual (toast banner or full-screen celebration).
 */
type Feedback = {
  /** Light tap, e.g. choosing a chip. */
  select: () => void;
  /** Reaction or rating: soft pop + light impact. */
  pop: () => void;
  /** A friend did something: banner + pop + impact. */
  toast: (content: ToastContent) => void;
  /** Big moment (posting, creating a group): confetti + chime + success haptic. */
  celebrate: (content: CelebrationContent) => void;
};

const FeedbackContext = createContext<Feedback | null>(null);

const TOAST_MS = 2200;

function safe(promise: Promise<unknown>) {
  promise.catch(() => {
    // Haptics/audio are unavailable on some platforms (e.g. desktop web); never let that break the UI.
  });
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const chime = useAudioPlayer(require('@/assets/sounds/chime.wav'));
  const popSound = useAudioPlayer(require('@/assets/sounds/pop.wav'));
  const [toastContent, setToastContent] = useState<(ToastContent & { key: number }) | null>(null);
  const [celebration, setCelebration] = useState<(CelebrationContent & { key: number }) | null>(
    null
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect the silent switch, and don't stop music the user is already playing.
    safe(setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const play = (player: typeof chime) => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore: see safe()
    }
  };

  const value: Feedback = {
    select: () => safe(Haptics.selectionAsync()),
    pop: () => {
      play(popSound);
      safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    },
    toast: (content) => {
      play(popSound);
      safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      setToastContent({ ...content, key: Date.now() });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastContent(null), TOAST_MS);
    },
    celebrate: (content) => {
      play(chime);
      safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      setCelebration({ ...content, key: Date.now() });
    },
  };

  return (
    <FeedbackContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {toastContent && <Toast key={toastContent.key} content={toastContent} />}
        {celebration && (
          <Celebration
            key={celebration.key}
            content={celebration}
            onDone={() => setCelebration(null)}
          />
        )}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
