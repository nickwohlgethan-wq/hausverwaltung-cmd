# Hausverwaltung

Mobile App (iOS, Android, Web) für die Hausverwaltung – mit zwei Rollen in einer App:

| | Verwalter | Mieter |
|---|---|---|
| **Übersicht** | Soll/Eingang/Offen des Monats, Belegung, überfällige Zahlungen, offene Tickets | Wohnung, Miete, Status der aktuellen Zahlung, offene Meldungen |
| **Objekte & Wohnungen** | Objekte, Wohnungen und Mieter anlegen und bearbeiten | – |
| **Mieten & Zahlungen** | Monatliche Sollstellung erzeugen, Zahlungseingänge buchen, Rückstände sehen | Eigene Zahlungen mit Status (bezahlt / offen / überfällig) |
| **Nebenkosten** | Kosten je Objekt und Jahr erfassen, Abrechnung je Mieter | Eigene Abrechnung mit Nachzahlung bzw. Guthaben |
| **Reparaturen & Tickets** | Alle Tickets, Status ändern, antworten | Schaden melden, Verlauf sehen, antworten |

## Starten

```bash
npm install
npm start          # Expo-Menü: mit der Expo-Go-App scannen, oder i / a / w drücken
```

Beim Start wählst du auf dem Anmeldebildschirm **Verwalter** oder einen der Demo-**Mieter**.
Unter „Übersicht“ kannst du dich abmelden und die Demo-Daten zurücksetzen.

Weitere Befehle: `npm run typecheck`, `npm run lint`, `npm test`.

## Wichtig: aktueller Stand

Das ist ein **funktionierender Prototyp ohne Server**:

- **Keine echte Anmeldung.** Die Rolle wird ohne Passwort gewählt.
- **Daten liegen nur lokal** auf dem jeweiligen Gerät (AsyncStorage). Verwalter und Mieter sehen daher
  *nicht* dieselben Daten, solange sie auf verschiedenen Geräten arbeiten. Zum Ausprobieren beider Rollen
  meldest du dich auf einem Gerät ab und als anderer Nutzer wieder an.
- Beim ersten Start werden Beispieldaten geladen (2 Objekte, 5 Wohnungen, 4 Mieter, Zahlungen, Nebenkosten, Tickets).

Für den echten Einsatz mit mehreren Personen braucht die App als nächsten Schritt ein Backend mit
Anmeldung (z. B. Supabase oder Firebase). Der gesamte Zugriff auf Daten läuft über `src/lib/store.tsx`
und `src/lib/reducer.ts`; dort würde die Anbindung ansetzen.

## Fachliche Annahmen

- Beträge werden intern in **Cent** (ganze Zahlen) gespeichert.
- Die Miete ist zum **3. des Monats** fällig; danach ist eine unvollständig bezahlte Miete „überfällig“.
- **Nebenkostenabrechnung**: Kosten werden pro Objekt und Jahr erfasst und entweder **nach Wohnfläche**
  oder **nach Wohneinheiten** verteilt. Leerstehende Wohnungen zählen bei der Verteilung mit (ihr Anteil
  bleibt beim Eigentümer). Zog ein Mieter im Laufe des Jahres ein, wird anteilig nach Monaten gerechnet
  (Einzugsmonat zählt voll). Als Vorauszahlung gilt die **Soll**-Vorauszahlung der bewohnten Monate,
  nicht der tatsächliche Zahlungseingang.
- Pro Wohnung gibt es einen Mieter. Auszug und Mieterwechsel sind noch nicht abgebildet.

## Noch nicht enthalten

Löschen von Objekten/Wohnungen/Mietern, Auszug/Mieterwechsel, Verbrauchsabhängige Verteilung
(z. B. Heizung nach Zählerstand), Fotos und Dokumente an Tickets, Push-Benachrichtigungen,
PDF-Export der Abrechnung, Mahnwesen.

## Projektstruktur

```
src/
  app/            Bildschirme (Expo Router, dateibasiert)
    verwalter/    Tabs für Verwalter
    mieter/       Tabs für Mieter
    objekt/ wohnung/ mietvertrag/ zahlung/ kosten/ abrechnung/ ticket/   Detail- und Formularseiten
  components/     UI-Bausteine
  lib/            Fachlogik (Zahlungen, Nebenkosten), Datenspeicher, Demo-Daten – mit Tests unter __tests__
  theme.ts        Farben (hell/dunkel)
```

Technik: Expo SDK 57, React Native, Expo Router, TypeScript.

## App bauen und veröffentlichen

Für einen Build auf dem Gerät bzw. für die Stores wird EAS verwendet (`npx eas-cli build`).
Vorher in `app.json` eigene Werte setzen: `ios.bundleIdentifier`, `android.package` sowie App-Icon
und Splash-Bild unter `assets/images/` (aktuell die Expo-Standardgrafiken).
