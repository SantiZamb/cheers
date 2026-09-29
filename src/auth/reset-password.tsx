import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAuth } from '@/auth/auth-provider';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useFeedback } from '@/feedback/feedback';
import { checkEmail } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

export const MIN_PASSWORD = 8;
/** Supabase won't send another code to the same address sooner than this. */
const RESEND_SECONDS = 60;

type Step = 'email' | 'code';

/**
 * Forgot password: email → one-time code from the reset email + new password. A code (rather
 * than a link) works in Expo Go, where links can't reliably reopen the app. Verifying the code
 * signs the user in; `recovering` keeps them on this screen until the new password is saved.
 */
export function ResetPassword({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const theme = useTheme();
  const feedback = useFeedback();
  const { setRecovering } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the code checks out; from then on only the password step can be retried.
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  const emailCheck = checkEmail(email, { forSignUp: false });
  const digits = code.replace(/\D/g, '');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!emailCheck.ok) {
      setEmailTouched(true);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(emailCheck.email);
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    feedback.pop();
    setCooldown(RESEND_SECONDS);
    setCode('');
    setStep('code');
  };

  const resetPassword = async () => {
    if (!emailCheck.ok) return;
    setBusy(true);
    setError(null);
    if (!verified) {
      setRecovering(true);
      const { error: err } = await supabase.auth.verifyOtp({ email: emailCheck.email, token: digits, type: 'recovery' });
      if (err) {
        setRecovering(false);
        setBusy(false);
        setError(friendlyError(err.message));
        return;
      }
      setVerified(true);
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    feedback.toast({ emoji: '🔑', title: 'Password updated', body: 'You’re signed in. Use your new password next time.' });
    // Lets the gate move on to the app.
    setRecovering(false);
  };

  const cancel = async () => {
    // The code already signed them in; don't leave a half-finished reset signed in.
    if (verified) await supabase.auth.signOut();
    setRecovering(false);
    onClose();
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }];

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.form}>
      <View style={styles.head}>
        <ThemedText type="defaultSemiBold">Reset your password</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {step === 'email'
            ? 'We’ll email you a code to set a new password.'
            : `We sent a code to ${emailCheck.ok ? emailCheck.email : email}. It can take a minute; check your spam folder too.`}
        </ThemedText>
      </View>

      {step === 'email' ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={sendCode}
            accessibilityLabel="Email"
            style={inputStyle}
          />
          {emailTouched && email.trim() && !emailCheck.ok ? (
            <ThemedText type="small" style={[styles.hint, { color: theme.accentEnd }]}>
              {emailCheck.reason}
            </ThemedText>
          ) : null}
          <GradientButton
            label={busy ? 'Sending…' : 'Send reset code'}
            onPress={sendCode}
            disabled={!email.trim() || busy}
          />
        </>
      ) : (
        <>
          {!verified && (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Code from the email"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={10}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Reset code"
              style={[inputStyle, styles.code]}
            />
          )}
          <View>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder={`New password (at least ${MIN_PASSWORD} characters)`}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={resetPassword}
              accessibilityLabel="New password"
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
            label={busy ? 'One sec…' : 'Set new password'}
            onPress={resetPassword}
            disabled={(!verified && digits.length < 6) || password.length < MIN_PASSWORD || busy}
          />
          {password.length > 0 && password.length < MIN_PASSWORD ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {MIN_PASSWORD - password.length} more characters
            </ThemedText>
          ) : null}
          {!verified && (
            <View style={styles.links}>
              <Pressable
                onPress={() => {
                  setStep('email');
                  setError(null);
                }}
                hitSlop={8}
                accessibilityRole="button">
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Change email
                </ThemedText>
              </Pressable>
              <Pressable onPress={sendCode} disabled={cooldown > 0 || busy} hitSlop={8} accessibilityRole="button">
                <ThemedText type="smallBold" themeColor={cooldown > 0 ? 'textSecondary' : 'accentEnd'}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </>
      )}

      {error ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.message, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="small" style={{ color: theme.accentEnd }}>
            {error}
          </ThemedText>
        </Animated.View>
      ) : null}

      <Pressable onPress={cancel} hitSlop={8} style={styles.center} accessibilityRole="button">
        <ThemedText type="smallBold" themeColor="textSecondary">
          ‹ Back to sign in
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function friendlyError(message: string) {
  if (/expired|invalid|otp|token/i.test(message)) return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  if (/rate limit|too many|seconds/i.test(message)) return 'Too many requests. Wait a minute, then try again.';
  if (/different from the old|same.*password/i.test(message)) return 'Pick a password you haven’t used for this account.';
  if (/password/i.test(message)) return message;
  if (/network|fetch/i.test(message)) return 'Can’t reach the server. Check your connection.';
  return message;
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  head: {
    gap: Spacing.one,
  },
  center: {
    alignSelf: 'center',
    textAlign: 'center',
  },
  hint: {
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  code: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
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
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  message: {
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
});
