import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { checkEmail } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

const MIN_PASSWORD = 8;

type Mode = 'signIn' | 'signUp';

/**
 * Email + password. Email confirmation is off in the Supabase project, so sign-up signs you straight in;
 * the address is checked on the device instead (format, fake domains, "did you mean gmail.com?").
 */
export function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Email problems are shown once the user leaves the field (or taps the button), not mid-typing.
  const [emailTouched, setEmailTouched] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailCheck = checkEmail(email, { forSignUp: mode === 'signUp' });
  const showEmailHint = emailTouched && email.trim().length > 0;
  const validPassword = mode === 'signIn' ? password.length > 0 : password.length >= MIN_PASSWORD;
  const canSubmit = email.trim().length > 0 && validPassword && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    if (!emailCheck.ok) {
      setEmailTouched(true);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const credentials = { email: emailCheck.email, password };
    const { data, error: err } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message, mode));
      return;
    }
    // If the project ever turns email confirmation back on, sign-up succeeds without a session.
    if (mode === 'signUp' && !data.session) {
      setNotice('Account created. Check your email to confirm it, then sign in.');
      setMode('signIn');
    }
    // Otherwise the auth listener swaps this screen out.
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }];

  return (
    <ThemedView style={styles.fill}>
      <LinearGradient colors={[theme.accentSoft, theme.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View entering={FadeInDown.duration(250)} style={styles.hero}>
            <LinearGradient colors={[theme.accent, theme.accentEnd]} style={styles.logo}>
              <Text style={styles.logoEmoji}>🍻</Text>
            </LinearGradient>
            <ThemedText type="title">Cheers</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Share your nights out with friends, wherever they are.
            </ThemedText>
          </Animated.View>

          <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
            {(['signIn', 'signUp'] as const).map((m) => {
              const selected = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segmentItem, selected && { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
                    {m === 'signIn' ? 'Sign in' : 'Create account'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Animated.View key={mode} entering={FadeIn.duration(150)} style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType={mode === 'signUp' ? 'username' : 'emailAddress'}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              onBlur={() => setEmailTouched(true)}
              style={[inputStyle, showEmailHint && !emailCheck.ok && { borderColor: theme.accentEnd, borderWidth: 1.5 }]}
              accessibilityLabel="Email"
              accessibilityHint={showEmailHint && !emailCheck.ok ? emailCheck.reason : undefined}
            />
            {showEmailHint && (!emailCheck.ok || emailCheck.suggestion) ? (
              <Animated.View entering={FadeIn.duration(150)} style={styles.emailHint}>
                {!emailCheck.ok ? (
                  <ThemedText type="small" style={{ color: theme.accentEnd }}>
                    {emailCheck.reason}
                  </ThemedText>
                ) : null}
                {emailCheck.suggestion ? (
                  <Pressable
                    onPress={() => setEmail(emailCheck.suggestion!)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${emailCheck.suggestion}`}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Did you mean{' '}
                      <ThemedText type="smallBold" themeColor="accentEnd">
                        {emailCheck.suggestion}
                      </ThemedText>
                      ?
                    </ThemedText>
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}
            <View>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signUp' ? `Password (at least ${MIN_PASSWORD} characters)` : 'Password'}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={[inputStyle, styles.passwordInput]}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={10}
                style={styles.showToggle}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {showPassword ? 'Hide' : 'Show'}
                </ThemedText>
              </Pressable>
            </View>
            <GradientButton
              label={busy ? 'One sec…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
              onPress={submit}
              disabled={!canSubmit}
            />
            {mode === 'signUp' && password.length > 0 && password.length < MIN_PASSWORD ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {MIN_PASSWORD - password.length} more characters
              </ThemedText>
            ) : null}
          </Animated.View>

          {error || notice ? (
            <Animated.View entering={FadeIn.duration(150)} style={[styles.message, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="small" style={{ color: theme.accentEnd }}>
                {error ?? notice}
              </ThemedText>
            </Animated.View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function friendlyError(message: string, mode: Mode) {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/already registered|already exists/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first (check your inbox), then sign in.';
  if (/password/i.test(message) && mode === 'signUp') return message;
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/network|fetch/i.test(message)) return 'Can’t reach the server. Check your connection.';
  return message;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  logoEmoji: {
    fontSize: 44,
  },
  center: {
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Radius.pill,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.pill,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  emailHint: {
    gap: Spacing.one,
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  passwordInput: {
    paddingRight: 64,
  },
  showToggle: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  message: {
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
});
