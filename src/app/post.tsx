import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Chip } from '@/components/chip';
import { GradientButton } from '@/components/gradient-button';
import { Rating } from '@/components/rating';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { BEER_STYLES, KIND_LABELS } from '@/data/seed';
import { useStore } from '@/data/store';
import type { PostKind } from '@/data/types';
import { useFeedback } from '@/feedback/feedback';
import { useTheme } from '@/hooks/use-theme';

const KINDS: PostKind[] = ['beer', 'night', 'checkin'];

const PROMPTS: Record<PostKind, string> = {
  beer: 'What are you drinking?',
  night: 'How was the night?',
  checkin: 'Where are you at?',
};

export default function PostScreen() {
  const theme = useTheme();
  const { addPost, draftVenue, setDraftVenue } = useStore();
  const feedback = useFeedback();

  const [kind, setKind] = useState<PostKind>('beer');
  const [photo, setPhoto] = useState<string>();
  const [beer, setBeer] = useState('');
  const [brewery, setBrewery] = useState('');
  const [style, setStyle] = useState(BEER_STYLES[0]);
  const [title, setTitle] = useState('');
  const [beersCount, setBeersCount] = useState(2);
  const [rating, setRating] = useState(4);
  // Typed venue wins; otherwise use the one handed over from the Map tab ("Check in here").
  const [venueInput, setVenueInput] = useState<string | null>(null);
  const venue = venueInput ?? draftVenue ?? '';
  const setVenue = (value: string) => setVenueInput(value);
  const [note, setNote] = useState('');

  const canShare =
    kind === 'beer'
      ? beer.trim().length > 0
      : kind === 'night'
        ? title.trim().length > 0 || !!photo
        : note.trim().length > 0 || !!photo;

  const pickPhoto = async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    };
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Allow camera access in Settings to snap your beer.');
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
        feedback.pop();
      }
    } catch {
      // The simulator has no camera; fall back to the library.
      if (source === 'camera') pickPhoto('library');
    }
  };

  const rate = (value: number) => {
    setRating(value);
    feedback.pop();
  };

  const share = () => {
    if (!canShare) return;
    addPost({
      kind,
      photo,
      rating: kind === 'checkin' ? undefined : rating,
      beer: kind === 'beer' ? beer.trim() : undefined,
      brewery: kind === 'beer' ? brewery.trim() || 'Unknown brewery' : undefined,
      style: kind === 'beer' ? style : undefined,
      title: kind === 'night' ? title.trim() || 'Night out' : undefined,
      beersCount: kind === 'night' ? beersCount : undefined,
      venue: venue.trim() || undefined,
      note: note.trim(),
    });
    setPhoto(undefined);
    setBeer('');
    setBrewery('');
    setTitle('');
    setBeersCount(2);
    setRating(4);
    setVenueInput(null);
    setDraftVenue(null);
    setNote('');
    router.navigate('/');
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader overline="Capture" title="Share the moment" />

          <View style={styles.segmented}>
            {KINDS.map((k) => (
              <Chip
                key={k}
                large
                label={`${KIND_LABELS[k].emoji} ${KIND_LABELS[k].label}`}
                selected={k === kind}
                onPress={() => {
                  setKind(k);
                  feedback.select();
                }}
              />
            ))}
          </View>

          <ThemedText themeColor="textSecondary">{PROMPTS[kind]}</ThemedText>

          {photo ? (
            <Animated.View entering={FadeIn}>
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
              <Pressable
                onPress={() => setPhoto(undefined)}
                style={styles.removePhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove photo">
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.photoButtons}>
              <PhotoButton emoji="📸" label="Take photo" onPress={() => pickPhoto('camera')} />
              <PhotoButton emoji="🖼️" label="From library" onPress={() => pickPhoto('library')} />
            </View>
          )}

          <Animated.View key={kind} entering={FadeInDown.duration(250)} style={styles.content0}>
            {kind === 'beer' && (
              <>
                <TextInput
                  value={beer}
                  onChangeText={setBeer}
                  placeholder="Beer name"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                />
                <TextInput
                  value={brewery}
                  onChangeText={setBrewery}
                  placeholder="Brewery"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                />
                <View style={styles.chips}>
                  {BEER_STYLES.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      selected={s === style}
                      onPress={() => {
                        setStyle(s);
                        feedback.select();
                      }}
                    />
                  ))}
                </View>
              </>
            )}

            {kind === 'night' && (
              <>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Name the night, e.g. Friday at the Tap Room"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                />
                <View style={styles.stepperRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Beers had
                  </ThemedText>
                  <View style={styles.stepper}>
                    <StepButton
                      label="−"
                      onPress={() => {
                        setBeersCount((n) => Math.max(0, n - 1));
                        feedback.select();
                      }}
                    />
                    <ThemedText type="defaultSemiBold" style={styles.count}>
                      🍺 {beersCount}
                    </ThemedText>
                    <StepButton
                      label="+"
                      onPress={() => {
                        setBeersCount((n) => Math.min(20, n + 1));
                        feedback.select();
                      }}
                    />
                  </View>
                </View>
              </>
            )}

            {kind !== 'checkin' && (
              <View style={styles.ratingBlock}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {kind === 'beer' ? 'Rate the beer' : 'Rate the night'}
                </ThemedText>
                <Rating
                  value={rating}
                  size={36}
                  emoji={kind === 'beer' ? '🍺' : '🌟'}
                  onChange={rate}
                />
              </View>
            )}

            <TextInput
              value={venue}
              onChangeText={setVenue}
              placeholder="📍 Where? (optional)"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={kind === 'checkin' ? 'What’s happening?' : 'Add some context (optional)'}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[inputStyle, styles.multiline]}
            />
          </Animated.View>

          <GradientButton label="Share with friends 🍻" onPress={share} disabled={!canShare} style={styles.shareButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PhotoButton({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.photoButton,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <Text style={styles.photoEmoji}>{emoji}</Text>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.stepButton, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  content0: {
    gap: Spacing.three,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoButton: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four + Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  photoEmoji: {
    fontSize: 32,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
  },
  removePhoto: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
    fontSize: 16,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    minWidth: 56,
    textAlign: 'center',
  },
  ratingBlock: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  shareButton: {
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
