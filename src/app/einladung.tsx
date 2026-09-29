import { useState } from 'react';

import { AuthLayout } from '@/components/auth-layout';
import { Button, Field, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/ids';
import { useStore, type ClaimResult } from '@/lib/store';
import { useTheme } from '@/theme';

const MESSAGES: Record<Exclude<ClaimResult, 'ok'>, string> = {
  invalid: 'Dieser Code ist ungültig oder wurde schon benutzt. Bitte prüfe ihn oder frage bei deiner Hausverwaltung nach.',
  throttled: 'Zu viele Fehlversuche. Bitte warte 15 Minuten und versuche es dann erneut.',
  already_linked: 'Dein Konto ist bereits mit einer Wohnung verknüpft.',
  not_allowed: 'Einladungscodes können nur mit einem Mieter-Konto eingelöst werden.',
  error: 'Das hat nicht geklappt. Bitte prüfe deine Verbindung und versuche es erneut.',
};

/** Mieter-Konten ohne Verknüpfung geben hier den Einladungscode ihrer Hausverwaltung ein. */
export default function Einladung() {
  const { claimInvite, profile, signOut } = useStore();
  const { user } = useAuth();
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!isValidInviteCode(code)) {
      setError('Der Code besteht aus 12 Zeichen (Ziffern und Buchstaben A–F), z. B. 0A1B-2C3D-4E5F.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await claimInvite(code);
    setBusy(false);
    if (result !== 'ok') setError(MESSAGES[result]);
    // Bei Erfolg lädt der Store die Wohnung und die App wechselt von selbst.
  }

  return (
    <AuthLayout
      title={`Willkommen${profile ? `, ${profile.displayName}` : ''}`}
      subtitle="Gib den Einladungscode ein, den du von deiner Hausverwaltung bekommen hast. So verknüpfen wir dein Konto mit deiner Wohnung.">
      <Field
        label="Einladungscode"
        value={code}
        onChangeText={(t) => setCode(formatInviteCode(normalizeInviteCode(t).slice(0, 12)))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="XXXX-XXXX-XXXX"
        maxLength={14}
        onSubmitEditing={submit}
      />
      {error ? (
        <T variant="muted" color={theme.danger} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <Button label="Mit Wohnung verknüpfen" icon="link-outline" onPress={submit} loading={busy} />
      <T variant="caption" style={{ textAlign: 'center' }}>
        Angemeldet als {user?.email}
      </T>
      <Button label="Abmelden" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </AuthLayout>
  );
}
