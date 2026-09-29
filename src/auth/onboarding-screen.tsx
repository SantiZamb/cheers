import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import { getMyLocation } from '@/lib/location';
import { useTheme } from '@/hooks/use-theme';

/** First run after sign-up: name (required), city and photo (optional). */
export function OnboardingScreen() {
  const theme = useTheme();
  const { me, updateProfile, setProfilePhoto } = useStore();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) setProfilePhoto(result.assets[0].uri);
  };

  const useMyCity = async () => {
    setLocating(true);
    const result = await getMyLocation();
    setLocating(false);
    if (result.ok && result.location.city) setCity(result.location.city);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), city: city.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }];

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.duration(250)} style={styles.gap}>
              <ThemedText type="overline" themeColor="accentEnd">
                Welcome
              </ThemedText>
              <ThemedText type="subtitle">Set up your profile</ThemedText>
              <ThemedText themeColor="textSecondary">So your friends know it’s you.</ThemedText>
            </Animated.View>

            <Pressable onPress={pickPhoto} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Add a profile photo">
              <Avatar user={{ ...me, name: name || me.name }} size={112} />
              <View style={[styles.cameraBadge, { backgroundColor: theme.text }]}>
                <Text style={styles.cameraEmoji}>📷</Text>
              </View>
            </Pressable>

            <View style={styles.gap}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Your name
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What friends call you"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
                maxLength={40}
                style={inputStyle}
              />
            </View>

            <View style={styles.gap}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Home city (optional)
              </ThemedText>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Chicago"
                placeholderTextColor={theme.textSecondary}
                maxLength={60}
                style={inputStyle}
              />
              <Pressable onPress={useMyCity} disabled={locating} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.accentEnd }}>
                  {locating ? 'Finding you…' : '📍 Use my current city'}
                </ThemedText>
              </Pressable>
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.accentEnd }}>
                {error}
              </ThemedText>
            ) : null}

            <GradientButton label={busy ? 'Saving…' : 'Let’s go 🍻'} onPress={save} disabled={!name.trim() || busy} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              @{me.username}
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  gap: {
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  avatarWrap: {
    alignSelf: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraEmoji: {
    fontSize: 16,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
});
