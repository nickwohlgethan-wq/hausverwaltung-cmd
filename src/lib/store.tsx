import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { reducer, type Action } from './reducer';
import { createSeed } from './seed';
import type { Db, Session } from './types';

const DB_KEY = 'hausverwaltung:db:v1';
const SESSION_KEY = 'hausverwaltung:session:v1';

type StoreValue = {
  /** false, solange die gespeicherten Daten noch geladen werden */
  ready: boolean;
  db: Db;
  session: Session | null;
  dispatch: (action: Action) => void;
  signIn: (session: Session) => void;
  signOut: () => void;
  /** Setzt alle Daten auf die Demo-Daten zurück. */
  resetDemo: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function isDb(value: unknown): value is Db {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['properties', 'units', 'tenants', 'payments', 'costs', 'tickets'].every((k) =>
    Array.isArray(v[k]),
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, dispatchDb] = useReducer(reducer, undefined, () => createSeed());
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawDb, rawSession] = await Promise.all([
          AsyncStorage.getItem(DB_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);
        if (cancelled) return;
        const parsedDb: unknown = rawDb ? JSON.parse(rawDb) : null;
        if (isDb(parsedDb)) dispatchDb({ type: 'replace', db: parsedDb });
        if (rawSession) setSession(JSON.parse(rawSession) as Session);
      } catch {
        // Beschädigte oder nicht lesbare Daten: mit Demo-Daten weiterarbeiten.
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => {});
  }, [db, ready]);

  useEffect(() => {
    if (!ready) return;
    (session
      ? AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session))
      : AsyncStorage.removeItem(SESSION_KEY)
    ).catch(() => {});
  }, [session, ready]);

  // Ein gespeicherter Mieter, den es nicht mehr gibt, darf keine Sitzung behalten.
  const sessionValid =
    session?.role !== 'mieter' || db.tenants.some((t) => t.id === session.tenantId);
  const activeSession = sessionValid ? session : null;

  const signIn = useCallback((s: Session) => setSession(s), []);
  const signOut = useCallback(() => setSession(null), []);
  const resetDemo = useCallback(() => {
    dispatchDb({ type: 'replace', db: createSeed() });
    setSession(null);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({ ready, db, session: activeSession, dispatch: dispatchDb, signIn, signOut, resetDemo }),
    [ready, db, activeSession, signIn, signOut, resetDemo],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden.');
  return ctx;
}
