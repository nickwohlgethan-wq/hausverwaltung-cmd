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

import { useAuth } from './auth';
import { describeError } from './errors';
import { normalizeInviteCode } from './ids';
import { reducer, type Action } from './reducer';
import { applyOps, diffDb, fetchAll } from './repo';
import { supabase, supabaseExecutor } from './supabase';
import { EMPTY_DB, type Db, type Profile, type Session } from './types';

export type ClaimResult = 'ok' | 'invalid' | 'throttled' | 'already_linked' | 'not_allowed' | 'error';

type StoreValue = {
  /** false, solange Anmeldung oder Daten noch geladen werden */
  ready: boolean;
  /** true, wenn angemeldet, die Daten aber nicht geladen werden konnten */
  loadFailed: boolean;
  db: Db;
  profile: Profile | null;
  /** Rolle (und bei Mietern der zugehörige Mieter); null wenn nicht angemeldet oder noch ohne Einladung */
  session: Session | null;
  /** Mieter-Konto, das noch mit keinem Mieter-Datensatz verknüpft ist */
  needsInvite: boolean;
  /** Ändert die Daten sofort in der App und speichert sie im Hintergrund im Backend. */
  dispatch: (action: Action) => void;
  /** Lädt die Daten neu vom Server. */
  refresh: () => Promise<void>;
  claimInvite: (code: string) => Promise<ClaimResult>;
  /** Meldet ab, nachdem noch laufende Speichervorgänge abgeschlossen sind. */
  signOut: () => Promise<void>;
  /** Letzter Fehler beim Laden/Speichern, für eine Hinweisleiste */
  error: string | null;
  clearError: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

// Beim Zurückkehren in die App höchstens so oft neu laden
const FOREGROUND_REFRESH_MS = 30_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const { profile, signOut: authSignOut } = useAuth();
  const exec = useMemo(() => (supabase ? supabaseExecutor(supabase) : null), []);

  const [db, setDb] = useState<Db>(EMPTY_DB);
  // Aktueller Stand, synchron lesbar – nötig, wenn mehrere Aktionen direkt hintereinander kommen.
  const dbRef = useRef<Db>(EMPTY_DB);
  // Ergebnis des ersten Ladens für ein Profil; solange es fehlt, gilt der Store als „loading“.
  const [loadResult, setLoadResult] = useState<{ profileId: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wird beim Aufräumen hochgezählt: verwirft Ergebnisse und Schreibvorgänge veralteter Sitzungen.
  const generation = useRef(0);
  // Schreibvorgänge laufen strikt nacheinander (Reihenfolge = Fremdschlüssel-Abhängigkeiten).
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const epoch = useRef(0);
  const dirty = useRef(false);
  const lastRefresh = useRef(0);

  const role = profile?.role;
  const profileId = profile?.id;

  const replaceDb = useCallback((next: Db) => {
    dbRef.current = next;
    setDb(next);
  }, []);

  const load = useCallback(
    async (gen: number): Promise<Db> => {
      if (!exec || !role) throw new Error('Nicht angemeldet');
      const data = await fetchAll(exec, role);
      if (gen === generation.current) lastRefresh.current = Date.now();
      return data;
    },
    [exec, role],
  );

  // Daten laden, sobald ein Profil da ist. Beim Nutzerwechsel wird der ganze Store neu gemountet
  // (siehe `key` im Root-Layout), es bleiben also keine Daten des Vorgängers stehen.
  useEffect(() => {
    if (!profileId || !role) return;
    generation.current += 1;
    const gen = generation.current;
    load(gen)
      .then((data) => {
        if (gen !== generation.current) return;
        replaceDb(data);
        setLoadResult({ profileId, ok: true });
      })
      .catch((e) => {
        if (gen !== generation.current) return;
        setError(describeError(e));
        setLoadResult({ profileId, ok: false });
      });
    return () => {
      generation.current += 1;
    };
  }, [profileId, role, load, replaceDb]);

  const status: 'idle' | 'loading' | 'ready' | 'failed' = !profileId
    ? 'idle'
    : loadResult?.profileId !== profileId
      ? 'loading'
      : loadResult.ok
        ? 'ready'
        : 'failed';

  const reloadAfterFailure = useCallback(
    async (gen: number) => {
      try {
        const data = await load(gen);
        if (gen === generation.current && pending.current === 0) replaceDb(data);
      } catch {
        // Ohne Verbindung bleibt der lokale Stand stehen; die Fehlermeldung ist bereits sichtbar.
      }
    },
    [load, replaceDb],
  );

  const dispatch = useCallback(
    (action: Action) => {
      const prev = dbRef.current;
      const next = reducer(prev, action);
      replaceDb(next);
      if (action.type === 'replace' || !exec) return;
      const ops = diffDb(prev, next);
      if (ops.length === 0) return;

      const gen = generation.current;
      const myEpoch = epoch.current;
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        try {
          // Ist eine frühere Änderung gescheitert, bauen diese Änderungen auf ungültigem Stand auf.
          if (gen === generation.current && myEpoch === epoch.current) await applyOps(exec, ops);
        } catch (e) {
          epoch.current += 1;
          dirty.current = true;
          setError(`${describeError(e)} Die Änderung konnte nicht gespeichert werden.`);
        } finally {
          pending.current -= 1;
          if (pending.current === 0 && dirty.current && gen === generation.current) {
            dirty.current = false;
            await reloadAfterFailure(gen);
          }
        }
      });
    },
    [exec, replaceDb, reloadAfterFailure],
  );

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const gen = generation.current;
    await queue.current;
    if (pending.current > 0) return;
    try {
      const data = await load(gen);
      if (gen === generation.current && pending.current === 0) {
        replaceDb(data);
        setLoadResult({ profileId, ok: true });
        setError(null);
      }
    } catch (e) {
      if (gen === generation.current) setError(`${describeError(e)} Aktualisieren fehlgeschlagen.`);
    }
  }, [profileId, load, replaceDb]);

  // Beim Zurückkehren in die App neue Daten holen (z. B. neue Tickets oder Zahlungen).
  useEffect(() => {
    if (status !== 'ready') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRefresh.current > FOREGROUND_REFRESH_MS) {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [status, refresh]);

  const claimInvite = useCallback(
    async (code: string): Promise<ClaimResult> => {
      if (!supabase) return 'error';
      const { data, error: rpcError } = await supabase.rpc('claim_tenant', { p_code: normalizeInviteCode(code) });
      if (rpcError) return 'error';
      if (data !== 'ok') {
        return data === 'invalid' || data === 'throttled' || data === 'already_linked' || data === 'not_allowed'
          ? data
          : 'error';
      }
      const gen = generation.current;
      try {
        const fresh = await load(gen);
        if (gen === generation.current) replaceDb(fresh);
      } catch (e) {
        setError(describeError(e));
      }
      return 'ok';
    },
    [load, replaceDb],
  );

  const signOut = useCallback(async () => {
    await queue.current;
    await authSignOut();
  }, [authSignOut]);

  const session = useMemo<Session | null>(() => {
    if (!profile || status !== 'ready') return null;
    if (profile.role === 'verwalter') return { role: 'verwalter' };
    const tenant = db.tenants[0];
    return tenant ? { role: 'mieter', tenantId: tenant.id } : null;
  }, [profile, status, db.tenants]);

  const needsInvite = profile?.role === 'mieter' && status === 'ready' && db.tenants.length === 0;

  const value = useMemo<StoreValue>(
    () => ({
      // Ohne Profil (noch nicht geladen oder fehlgeschlagen) gibt es hier nichts zu laden; das meldet AuthProvider.
      ready: !profile || status === 'ready' || status === 'failed',
      loadFailed: status === 'failed',
      db,
      profile,
      session,
      needsInvite,
      dispatch,
      refresh,
      claimInvite,
      signOut,
      error,
      clearError: () => setError(null),
    }),
    [status, db, profile, session, needsInvite, dispatch, refresh, claimInvite, signOut, error],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden.');
  return ctx;
}
