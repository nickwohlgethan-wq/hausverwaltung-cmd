import { getRandomBytes, randomUUID } from 'expo-crypto';

/** Neue UUID (v4) – so wie sie die Datenbank als Primärschlüssel erwartet. */
export function uid(): string {
  return randomUUID();
}

/** Einladungscode für einen Mieter: 12 zufällige Hex-Zeichen (48 Bit), z. B. "0A1B2C3D4E5F". */
export function newInviteCode(): string {
  return Array.from(getRandomBytes(6), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** "0A1B2C3D4E5F" → "0A1B-2C3D-4E5F" (besser lesbar und diktierbar). */
export function formatInviteCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

/** Entfernt Trennzeichen und Leerraum, macht Großbuchstaben: "0a1b 2c3d-4e5f" → "0A1B2C3D4E5F". */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

export function isValidInviteCode(input: string): boolean {
  return /^[0-9A-F]{12}$/.test(normalizeInviteCode(input));
}
