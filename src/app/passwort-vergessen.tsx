import { useState } from 'react';

import { AuthLayout } from '@/components/auth-layout';
import { Button, Field, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

const MIN_PASSWORD = 8;

/** Passwort zurücksetzen in zwei Schritten: E-Mail angeben, dann Code aus der E-Mail und neues Passwort. */
export default function PasswortVergessen() {
  const { requestPasswordReset, completePasswordReset } = useAuth();
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (busy) return;
    if (!email.trim()) {
      setError('Bitte deine E-Mail-Adresse eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (result.ok) setStep('reset');
    else setError(result.message);
  }

  async function reset() {
    if (busy) return;
    if (!code.trim()) return setError('Bitte den Code aus der E-Mail eingeben.');
    if (password.length < MIN_PASSWORD) return setError(`Das neue Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`);
    if (password !== repeat) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    setError(null);
    const result = await completePasswordReset(email, code, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // Bei Erfolg ist die Person angemeldet und die App wechselt von selbst.
  }

  const errorText = error ? (
    <T variant="muted" color={theme.danger} accessibilityRole="alert">
      {error}
    </T>
  ) : null;

  if (step === 'email') {
    return (
      <AuthLayout compact title="Passwort vergessen" subtitle="Wir schicken dir einen Code per E-Mail.">
        <Field
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          onSubmitEditing={sendCode}
        />
        {errorText}
        <Button label="Code senden" icon="mail-outline" onPress={sendCode} loading={busy} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      compact
      title="Neues Passwort"
      subtitle={`Falls es zu ${email.trim()} ein Konto gibt, haben wir einen Code geschickt.`}>
      <Field
        label="Code aus der E-Mail"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
      />
      <Field
        label="Neues Passwort"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`Mindestens ${MIN_PASSWORD} Zeichen`}
      />
      <Field
        label="Neues Passwort wiederholen"
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={reset}
      />
      {errorText}
      <Button label="Passwort ändern" icon="checkmark" onPress={reset} loading={busy} />
      <Button label="Code erneut senden" variant="secondary" onPress={sendCode} />
    </AuthLayout>
  );
}
