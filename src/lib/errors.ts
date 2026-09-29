/** Fehler mit maschinenlesbarem Code (z. B. Postgres-SQLSTATE), wie ihn Supabase liefert. */
export class BackendError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
  }
}

const NETWORK = /failed to fetch|network request failed|networkerror|load failed|network error|timed? ?out/i;

export function isNetworkError(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null;
  return err?.name === 'AuthRetryableFetchError' || NETWORK.test(String(err?.message ?? ''));
}

/** Verständliche Meldung für Fehler beim Lesen/Schreiben von Daten. */
export function describeError(e: unknown): string {
  if (isNetworkError(e)) return 'Keine Verbindung zum Server.';
  switch ((e as { code?: string } | null)?.code) {
    case '42501':
      return 'Dafür fehlt die Berechtigung.';
    case '23505':
      return 'Diesen Eintrag gibt es bereits.';
    case '23503':
      return 'Der Eintrag verweist auf Daten, die nicht (mehr) existieren.';
    case '23514':
    case '22P02':
    case '22003':
    case '22001':
      return 'Die Eingabe wurde vom Server abgelehnt.';
    case 'not_found':
      return 'Der Eintrag wurde nicht gefunden oder darf nicht geändert werden.';
    case 'PGRST301':
    case 'PGRST303':
      return 'Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.';
    default:
      return 'Unerwarteter Fehler.';
  }
}

/** Verständliche Meldung für Fehler bei Anmeldung, Registrierung und Passwort-Zurücksetzen. */
export function describeAuthError(e: unknown): string {
  if (isNetworkError(e)) return 'Keine Verbindung zum Server.';
  const err = e as { code?: string; status?: number; message?: string } | null;
  switch (err?.code) {
    case 'invalid_credentials':
      return 'E-Mail oder Passwort ist falsch.';
    case 'email_not_confirmed':
      return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Für diese E-Mail-Adresse gibt es schon ein Konto.';
    case 'weak_password':
      return 'Das Passwort ist zu schwach. Wähle mindestens 8 Zeichen.';
    case 'same_password':
      return 'Das neue Passwort muss sich vom alten unterscheiden.';
    case 'otp_expired':
    case 'otp_disabled':
      return 'Der Code ist ungültig oder abgelaufen. Fordere einen neuen an.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.';
    case 'signup_disabled':
      return 'Registrierungen sind derzeit nicht möglich.';
    case 'email_address_invalid':
      return 'Diese E-Mail-Adresse wird nicht akzeptiert.';
    case 'validation_failed':
      return 'Bitte prüfe deine Eingaben.';
    default:
      return 'Das hat nicht geklappt. Bitte versuche es erneut.';
  }
}
