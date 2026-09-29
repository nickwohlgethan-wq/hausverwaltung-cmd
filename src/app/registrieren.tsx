import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthLayout } from '@/components/auth-layout';
import { Button, Card, Field, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { useTheme } from '@/theme';

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registrieren() {
  const { signUp } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [role, setRole] = useState<Role>('verwalter');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = {
    name: !name.trim() ? 'Pflichtfeld' : undefined,
    email: !EMAIL.test(email.trim()) ? 'Bitte eine gültige E-Mail-Adresse eingeben' : undefined,
    password: password.length < MIN_PASSWORD ? `Mindestens ${MIN_PASSWORD} Zeichen` : undefined,
    repeat: repeat !== password ? 'Die Passwörter stimmen nicht überein' : undefined,
  };
  const show = (k: keyof typeof problems) => (submitted ? problems[k] : undefined);

  async function submit() {
    setSubmitted(true);
    if (busy || Object.values(problems).some(Boolean)) return;
    setBusy(true);
    setError(null);
    const result = await signUp({ email, password, displayName: name, role });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.value.needsConfirmation) {
      router.replace({ pathname: '/bestaetigen', params: { email: email.trim() } });
    }
    // Sonst ist die Person bereits angemeldet und die App wechselt von selbst.
  }

  return (
    <AuthLayout compact title="Konto erstellen">
      <Segmented<Role>
        label="Ich bin …"
        options={[
          { value: 'verwalter', label: 'Verwalter' },
          { value: 'mieter', label: 'Mieter' },
        ]}
        value={role}
        onChange={setRole}
      />
      <Card>
        <T variant="muted">
          {role === 'verwalter'
            ? 'Du verwaltest Objekte, Mieten und Nebenkosten. Du bekommst einen eigenen, leeren Arbeitsbereich.'
            : 'Du brauchst einen Einladungscode von deiner Hausverwaltung. Den gibst du nach der Anmeldung ein.'}
        </T>
      </Card>
      <Field
        label={role === 'verwalter' ? 'Name der Hausverwaltung' : 'Dein Name'}
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoComplete="name"
        error={show('name')}
      />
      <Field
        label="E-Mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        error={show('email')}
      />
      <Field
        label="Passwort"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`Mindestens ${MIN_PASSWORD} Zeichen`}
        error={show('password')}
      />
      <Field
        label="Passwort wiederholen"
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        error={show('repeat')}
      />
      {error ? (
        <T variant="muted" color={theme.danger} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <Button label="Konto erstellen" icon="person-add-outline" onPress={submit} loading={busy} />
    </AuthLayout>
  );
}
