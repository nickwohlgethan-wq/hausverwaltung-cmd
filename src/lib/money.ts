const eurFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatEUR(cents: number): string {
  return eurFormat.format(cents / 100);
}

/**
 * Wandelt eine Eingabe wie "1.234,56", "1234,5" oder "1234.56" in Cent um.
 * Gibt null zurück, wenn die Eingabe keine gültige, nicht-negative Zahl ist.
 */
export function parseEUR(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '');
  if (!s) return null;
  let normalized: string;
  if (s.includes(',')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, '');
  } else {
    normalized = s;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

/** Cent-Betrag als Eingabetext für Formularfelder ("1234,50"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Dezimalzahl mit Komma oder Punkt, z. B. Wohnfläche "62,5". */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

/** Größter zulässiger Betrag (1 Mio. €) – bleibt weit unter dem Integer-Limit der Datenbank. */
export const MAX_CENTS = 100_000_000;
