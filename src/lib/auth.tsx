import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { describeAuthError } from './errors';
import { supabase } from './supabase';
import type { Profile, Role } from './types';

export type AuthUser = { id: string; email: string };

export type Outcome<T = void> = { ok: true; value: T } | { ok: false; message: string; code?: string };

const fail = (e: unknown): { ok: false; message: string; code?: string } => ({
  ok: false,
  message: describeAuthError(e),
  code: (e as { code?: string } | null)?.code,
});
const NOT_CONFIGURED = { ok: false, message: 'Das Backend ist nicht konfiguriert.' } as const;

type AuthValue = {
  /** false, solange die gespeicherte Sitzung und das Profil noch geladen werden */
  ready: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  /** true, wenn angemeldet, das Profil aber nicht geladen werden konnte */
  profileFailed: boolean;
  retryProfile: () => void;
  signIn: (email: string, password: string) => Promise<Outcome>;
  /** `needsConfirmation`: es wurde ein Code per E-Mail verschickt, der Nutzer ist noch nicht angemeldet. */
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    role: Role;
  }) => Promise<Outcome<{ needsConfirmation: boolean }>>;
  confirmSignUp: (email: string, code: string) => Promise<Outcome>;
  resendSignUpCode: (email: string) => Promise<Outcome>;
  requestPasswordReset: (email: string) => Promise<Outcome>;
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<Outcome>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionChecked, setSessionChecked] = useState(!supabase);
  const [user, setUser] = useState<AuthUser | null>(null);
  // Ergebnis des Profil-Ladens, gehört immer zu genau einem Konto. `profile: null` = fehlgeschlagen.
  const [profileResult, setProfileResult] = useState<{ userId: string; profile: Profile | null } | null>(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  // Während des Passwort-Zurücksetzens soll der (durch den Code entstandene) Login die App noch
  // nicht freischalten, bevor das neue Passwort gesetzt ist.
  const suspended = useRef(false);

  const applySession = useCallback((session: { user: { id: string; email?: string } } | null) => {
    const next = toUser(session?.user);
    setUser((prev) => (prev?.id === next?.id && prev?.email === next?.email ? prev : next));
    setSessionChecked(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Hinweis: In diesem Callback keine weiteren Supabase-Aufrufe abwarten (Deadlock-Gefahr).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!suspended.current) applySession(session);
    });
    return () => data.subscription.unsubscribe();
  }, [applySession]);

  // Token-Erneuerung nur im Vordergrund (empfohlen für React Native).
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    });
    return () => {
      sub.remove();
      supabase!.auth.stopAutoRefresh();
    };
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfileResult({
          userId,
          profile:
            error || !data
              ? null
              : { id: data.id, role: data.role === 'verwalter' ? 'verwalter' : 'mieter', displayName: data.display_name },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, profileAttempt]);

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? fail(error) : { ok: true, value: undefined };
  }, []);

  const signUp = useCallback<AuthValue['signUp']>(async ({ email, password, displayName, role }) => {
    if (!supabase) return NOT_CONFIGURED;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { role, display_name: displayName.trim() } },
    });
    if (error) return fail(error);
    return { ok: true, value: { needsConfirmation: !data.session } };
  }, []);

  const confirmSignUp = useCallback<AuthValue['confirmSignUp']>(async (email, code) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
    return error ? fail(error) : { ok: true, value: undefined };
  }, []);

  const resendSignUpCode = useCallback<AuthValue['resendSignUpCode']>(async (email) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    return error ? fail(error) : { ok: true, value: undefined };
  }, []);

  const requestPasswordReset = useCallback<AuthValue['requestPasswordReset']>(async (email) => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return error ? fail(error) : { ok: true, value: undefined };
  }, []);

  const completePasswordReset = useCallback<AuthValue['completePasswordReset']>(
    async (email, code, newPassword) => {
      if (!supabase) return NOT_CONFIGURED;
      suspended.current = true;
      try {
        const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (verified.error) return fail(verified.error);
        const updated = await supabase.auth.updateUser({ password: newPassword });
        if (updated.error) {
          // Ohne neues Passwort soll die Wiederherstellungs-Sitzung nicht als Anmeldung stehen bleiben.
          await supabase.auth.signOut({ scope: 'local' });
          return fail(updated.error);
        }
        return { ok: true, value: undefined };
      } finally {
        suspended.current = false;
        const { data } = await supabase.auth.getSession();
        applySession(data.session);
      }
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // "local": nur dieses Gerät abmelden, auch wenn gerade keine Verbindung besteht.
    await supabase.auth.signOut({ scope: 'local' });
    applySession(null);
  }, [applySession]);

  // Ein Ergebnis zählt nur für das Konto, zu dem es gehört (nicht für den vorigen Nutzer).
  const result = profileResult && user && profileResult.userId === user.id ? profileResult : null;
  const currentProfile = result?.profile ?? null;
  const profileFailed = !!user && result !== null && result.profile === null;
  const loadingProfile = !!user && result === null;

  const value = useMemo<AuthValue>(
    () => ({
      ready: sessionChecked && !loadingProfile,
      user,
      profile: currentProfile,
      profileFailed,
      retryProfile: () => {
        setProfileResult(null);
        setProfileAttempt((n) => n + 1);
      },
      signIn,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      requestPasswordReset,
      completePasswordReset,
      signOut,
    }),
    [
      sessionChecked, loadingProfile, user, currentProfile, profileFailed, signIn, signUp, confirmSignUp,
      resendSignUpCode, requestPasswordReset, completePasswordReset, signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.');
  return ctx;
}
