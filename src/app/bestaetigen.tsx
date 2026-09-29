import { useState } from 'react';

import { AuthLayout } from '@/components/auth-layout';
import { Button, Field, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useParam } from '@/lib/hooks';
import { useTheme } from '@/theme';

/** Bestätigung der E-Mail-Adresse mit dem Code aus der Bestätigungs-E-Mail. */
export default function Bestaetigen() {
  const { confirmSignUp, resendSignUpCode } = useAuth();
  const theme = useTheme();
  const email = useParam('email') ?? '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!code.trim()) {
      setError('Bitte den Code aus der E-Mail eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await confirmSignUp(email, code);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // Bei Erfolg ist die Person angemeldet und die App wechselt von selbst.
  }

  async function resend() {
    setError(null);
    setInfo(null);
    const result = await resendSignUpCode(email);
    if (result.ok) setInfo('Wir haben dir einen neuen Code geschickt.');
    else setError(result.message);
  }

  return (
    <AuthLayout compact title="E-Mail bestätigen" subtitle={`Wir haben einen Code an ${email} geschickt.`}>
      <Field
        label="Code aus der E-Mail"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        onSubmitEditing={submit}
      />
      {error ? (
        <T variant="muted" color={theme.danger} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      {info ? <T variant="muted">{info}</T> : null}
      <Button label="Bestätigen" icon="checkmark" onPress={submit} loading={busy} />
      <Button label="Code erneut senden" variant="secondary" onPress={resend} />
    </AuthLayout>
  );
}
