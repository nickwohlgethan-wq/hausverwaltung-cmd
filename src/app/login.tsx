import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { Button, Field, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) return; // Die Navigation folgt automatisch aus der neuen Anmeldung.
    if (result.code === 'email_not_confirmed') {
      router.push({ pathname: '/bestaetigen', params: { email: email.trim() } });
      return;
    }
    setError(result.message);
  }

  return (
    <AuthLayout title="Hausverwaltung" subtitle="Objekte, Mieten, Nebenkosten und Reparaturen an einem Ort.">
      <Field
        label="E-Mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Passwort"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {error ? (
        <T variant="muted" color={theme.danger} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <Button label="Anmelden" icon="log-in-outline" onPress={submit} loading={busy} />
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button label="Passwort vergessen?" variant="secondary" onPress={() => router.push('/passwort-vergessen')} />
        <Button label="Neues Konto erstellen" variant="secondary" onPress={() => router.push('/registrieren')} />
      </View>
    </AuthLayout>
  );
}
