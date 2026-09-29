import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import './polyfills';
import { BackendError } from './errors';
import type { Executor, Row } from './repo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** false, solange EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY nicht gesetzt sind (siehe .env.example). */
export const isConfigured = Boolean(url && anonKey);

/**
 * Der Anon-/Publishable-Key ist öffentlich und darf in der App stehen; geschützt sind die Daten
 * durch Row-Level-Security in der Datenbank. Niemals den service_role-Key in die App einbauen.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Kein Web-Redirect-Fluss: Bestätigung und Passwort-Reset laufen über Codes aus der E-Mail.
        detectSessionInUrl: false,
      },
    })
  : null;

// PostgREST liefert höchstens so viele Zeilen pro Anfrage (Supabase-Standard: 1000).
const PAGE_SIZE = 1000;

export function supabaseExecutor(client: SupabaseClient): Executor {
  return {
    async select(table) {
      const rows: Row[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .order('id')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE_SIZE) return rows;
      }
    },

    async insert(table, row) {
      const { error } = await client.from(table).insert(row);
      if (error) throw error;
    },

    async update(table, id, patch) {
      const { data, error } = await client.from(table).update(patch).eq('id', id).select('id');
      if (error) throw error;
      // RLS blendet nicht erlaubte Zeilen still aus: 0 Treffer heißt „nicht vorhanden oder nicht erlaubt“.
      if (!data || data.length === 0) throw new BackendError('not_found', `${table}/${id} nicht geändert`);
    },

    async remove(table, id) {
      const { data, error } = await client.from(table).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new BackendError('not_found', `${table}/${id} nicht gelöscht`);
    },

    async rpc(fn) {
      const { data, error } = await client.rpc(fn);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  };
}
