import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { todayISO } from './dates';
import { useStore } from './store';
import type { Property, Tenant, Unit } from './types';

/** Heutiges Datum (ISO). Ändert sich nicht während der Lebensdauer des Bildschirms. */
export function useToday(): string {
  return useMemo(() => todayISO(), []);
}

/** Der angemeldete Mieter samt Wohnung und Objekt; null für Verwalter oder wenn Daten fehlen. */
export function useMieter(): { tenant: Tenant; unit: Unit; property: Property } | null {
  const { db, session } = useStore();
  if (session?.role !== 'mieter') return null;
  const tenant = db.tenants.find((t) => t.id === session.tenantId);
  const unit = tenant && db.units.find((u) => u.id === tenant.unitId);
  const property = unit && db.properties.find((p) => p.id === unit.propertyId);
  return tenant && unit && property ? { tenant, unit, property } : null;
}

/** Ein einzelner Routen-Parameter als String (Expo Router kann auch Arrays liefern). */
export function useParam(name: string): string | undefined {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}
