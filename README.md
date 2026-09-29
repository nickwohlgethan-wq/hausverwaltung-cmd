# Hausverwaltung

Mobile App (iOS, Android, Web) für die Hausverwaltung – mit zwei Rollen in einer App und einem
echten Backend (Supabase: Anmeldung + Postgres mit Zugriffsregeln).

| | Verwalter | Mieter |
|---|---|---|
| **Übersicht** | Soll/Eingang/Offen des Monats, Belegung, überfällige Zahlungen, offene Tickets | Wohnung, Miete, Status der aktuellen Zahlung, offene Meldungen |
| **Objekte & Wohnungen** | Objekte, Wohnungen und Mieter anlegen und bearbeiten | – |
| **Mieten & Zahlungen** | Monatliche Sollstellung erzeugen, Zahlungseingänge buchen, Rückstände sehen | Eigene Zahlungen mit Status (bezahlt / offen / überfällig) |
| **Nebenkosten** | Kosten je Objekt und Jahr erfassen, Abrechnung je Mieter | Eigene Abrechnung mit Nachzahlung bzw. Guthaben |
| **Reparaturen & Tickets** | Alle Tickets, Status ändern, antworten | Schaden melden, Verlauf sehen, antworten |

## So funktioniert die Anmeldung

- **Verwalter** registrieren sich selbst mit E-Mail und Passwort und bekommen einen eigenen, leeren
  Arbeitsbereich. Sie sehen ausschließlich ihre eigenen Daten.
- **Mieter** bekommen **keinen** offenen Zugang. Der Verwalter legt den Mieter an; die App erzeugt dafür einen
  **einmaligen Einladungscode** (z. B. `0A1B-2C3D-4E5F`), den der Verwalter weitergibt („Code teilen“).
  Der Mieter registriert sich als „Mieter“, gibt den Code ein und sieht danach nur seine eigene Wohnung.
- Passwort vergessen: Code per E-Mail, dann neues Passwort – direkt in der App, ohne Links.

## Einrichten

### 1. Supabase-Projekt

1. Projekt auf <https://supabase.com> anlegen. Für Daten von Mietern (DSGVO) eine **EU-Region** wählen.
2. **Datenbank einrichten:** Inhalt von [`supabase/migrations/20260929120000_init.sql`](supabase/migrations/20260929120000_init.sql)
   im Dashboard unter *SQL Editor* ausführen (oder mit der Supabase-CLI: `supabase db push`).
   Die Migration legt Tabellen, Zugriffsregeln (Row-Level-Security) und Funktionen an.
3. **E-Mail-Einstellungen** (*Authentication*):
   - *Providers → Email*: Passwort-Mindestlänge auf **8** setzen. „Confirm email“ sollte **an** bleiben.
   - *Email Templates*: Die App arbeitet mit **Codes** statt Links. In den Vorlagen **Confirm signup** und
     **Reset password** den Link durch den Code ersetzen, z. B.:
     ```html
     <h2>Dein Code</h2>
     <p>{{ .Token }}</p>
     ```
     Ohne diese Änderung kommt in der E-Mail nur ein Link, den die App nicht auswerten kann.
   - Für den Produktivbetrieb einen eigenen SMTP-Server eintragen (der eingebaute Versand ist stark begrenzt).
4. **Zugangsdaten in die App:** `.env.example` nach `.env` kopieren und ausfüllen
   (*Project Settings → API*: URL und der **anon/publishable** Key).
   Den `service_role`/*secret* Key niemals in die App eintragen.

### 2. App starten

```bash
npm install
npx expo start -c     # -c: nötig, nachdem .env geändert wurde (Werte werden beim Bauen eingesetzt)
```

Dann mit der Expo-Go-App scannen oder `i` / `a` / `w` drücken. Ohne `.env` zeigt die App einen Hinweis.

## Sicherheitsmodell

Die Zugriffsregeln stehen **in der Datenbank** (Row-Level-Security), nicht in der App – die App könnte
manipuliert werden, die Datenbank nicht.

- Jede Zeile gehört einem Verwalter (`owner_id`). **Zusammengesetzte Fremdschlüssel** erzwingen, dass
  verknüpfte Zeilen demselben Verwalter gehören; fremde IDs lassen sich nicht einhängen.
- Mieter dürfen nur **lesen** – und nur ihre eigene Wohnung, Zahlungen, Kosten und Tickets. Sie können Tickets
  anlegen und darauf antworten; Eigentümer, Status, Autor und Rolle setzt die Datenbank.
- Clients dürfen nur explizit freigegebene **Spalten** schreiben (z. B. weder `owner_id`, `user_id` noch die
  Rolle im Profil, weder Soll-Beträge noch Ticket-Status durch Mieter).
- Einladungscodes sind einmalig; nach 5 Fehlversuchen kann ein Konto 15 Minuten lang keine Codes mehr einlösen.
  Nicht angemeldete Aufrufer (`anon`) haben auf nichts Zugriff.
- Der Nebenkosten-Verteilschlüssel eines Mieters (Gesamtfläche, Wohnungszahl des Hauses) kommt über eine
  eigene Funktion, ohne dass er andere Wohnungen sieht.

## Tests

```bash
npm test                 # Fachlogik und Sync-Diff (ohne Datenbank)
npm run typecheck && npm run lint
```

**Datenbank-Tests** brauchen ein laufendes Postgres (>= 15); sie legen pro Lauf eine eigene Datenbank an,
bilden das Supabase-Schema (`auth`, Rollen) nach und spielen die Migration ein:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm test
```

Sie prüfen u. a.: Trennung der Verwalter untereinander, Isolation der Mieter, Einladungscode (einmalig,
Drosselung), Rollen-Eskalation, fehlender Zugriff für `anon`, und dass die App-Modelle über die echte
Sync-Schicht verlustfrei geschrieben und gelesen werden. Ohne `TEST_DATABASE_URL` werden sie übersprungen.

**Was nicht automatisch getestet ist:** Das Zusammenspiel mit dem gehosteten Supabase (GoTrue, E-Mail-Versand,
PostgREST) und das Verhalten auf echten Geräten. Die App wurde im Browser gegen echtes Postgres mit den
echten Regeln durchgespielt; die Auth-Schnittstelle dabei war ein Nachbau. Bitte nach dem Einrichten einmal
den kompletten Ablauf (Registrieren → Objekt/Mieter anlegen → Einladungscode einlösen → Ticket) mit deinem
Supabase-Projekt durchklicken.

## Bekannte Grenzen

- **Ein Konto = ein Arbeitsbereich.** Mehrere Mitarbeiter einer Hausverwaltung mit gemeinsamen Daten gibt es
  noch nicht. Registrierung als Verwalter ist offen; wer das einschränken will, kann sie in Supabase
  abschalten und Konten selbst anlegen.
- **Sitzung im normalen App-Speicher.** Die Anmeldung wird auf dem Gerät nicht zusätzlich verschlüsselt
  (Empfehlung für Produktion: verschlüsselter Speicher mit `expo-secure-store`).
- **Kein Konto löschen / keine Datenexporte** (DSGVO: vor dem Echtbetrieb ergänzen), keine
  Audit-Historie.
- Kein Löschen von Objekten/Wohnungen/Mietern, kein Auszug/Mieterwechsel (pro Wohnung ein Mieter),
  keine Fotos/Dokumente an Tickets, keine Push-Benachrichtigungen, kein PDF-Export, kein Mahnwesen.
- Änderungen erscheinen bei anderen Geräten nach Herunterziehen der Seite bzw. beim Zurückkehren in die App
  (kein Live-Abgleich). Ohne Verbindung kann nicht gearbeitet werden.

## Fachliche Annahmen

- Beträge werden intern in **Cent** (ganze Zahlen) gespeichert.
- Die Miete ist zum **3. des Monats** fällig; danach ist eine unvollständig bezahlte Miete „überfällig“.
- **Nebenkostenabrechnung**: Kosten werden pro Objekt und Jahr erfasst und entweder **nach Wohnfläche**
  oder **nach Wohneinheiten** verteilt. Leerstehende Wohnungen zählen bei der Verteilung mit (ihr Anteil
  bleibt beim Eigentümer). Zog ein Mieter im Laufe des Jahres ein, wird anteilig nach Monaten gerechnet
  (Einzugsmonat zählt voll). Als Vorauszahlung gilt die **Soll**-Vorauszahlung der bewohnten Monate,
  nicht der tatsächliche Zahlungseingang.

## Projektstruktur

```
supabase/
  migrations/     Datenbank-Schema und Zugriffsregeln (SQL)
  tests/          Datenbank-Tests (Postgres nötig)
src/
  app/            Bildschirme (Expo Router, dateibasiert)
    verwalter/    Tabs für Verwalter        mieter/   Tabs für Mieter
    login, registrieren, bestaetigen, passwort-vergessen, einladung   Anmeldung
    objekt/ wohnung/ mietvertrag/ zahlung/ kosten/ abrechnung/ ticket/   Detail- und Formularseiten
  components/     UI-Bausteine
  lib/
    auth.tsx      Anmeldung (Supabase Auth)
    store.tsx     Daten im Speicher, sofortige Anzeige, Speichern im Hintergrund
    repo.ts       App-Modell ⇄ Tabellenzeilen, Ableitung der Schreibvorgänge
    supabase.ts   Client und Zugriff auf das Backend
    payments.ts, utilities.ts   Fachlogik (Zahlungen, Nebenkosten)
  theme.ts        Farben (hell/dunkel)
```

Technik: Expo SDK 57, React Native, Expo Router, TypeScript, Supabase.

## App bauen und veröffentlichen

Für einen Build auf dem Gerät bzw. für die Stores wird EAS verwendet (`npx eas-cli build`); die
`EXPO_PUBLIC_…`-Werte dort als Umgebungsvariablen des Build-Profils hinterlegen.
Vorher in `app.json` eigene Werte setzen: `ios.bundleIdentifier`, `android.package` sowie App-Icon
und Splash-Bild unter `assets/images/` (aktuell die Expo-Standardgrafiken).
