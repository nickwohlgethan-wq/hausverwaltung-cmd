import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen } from '@/components/ui';
import { useParam } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { centsToInput, MAX_CENTS, parseDecimal, parseEUR } from '@/lib/money';
import { useStore } from '@/lib/store';

// Grenzen entsprechen den Spaltentypen der Datenbank (numeric(8,2) bzw. numeric(4,1)) mit Reserve.
const MAX_AREA = 100_000;
const MAX_ROOMS = 100;

const dec = (n: number) => String(n).replace('.', ',');

export default function WohnungFormular() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const id = useParam('id');
  const existing = db.units.find((u) => u.id === id);
  const propertyParam = useParam('propertyId');
  const propertyId = existing?.propertyId ?? propertyParam;

  const [name, setName] = useState(existing?.name ?? '');
  const [floor, setFloor] = useState(existing?.floor ?? '');
  const [area, setArea] = useState(existing ? dec(existing.areaSqm) : '');
  const [rooms, setRooms] = useState(existing ? dec(existing.rooms) : '');
  const [rent, setRent] = useState(existing ? centsToInput(existing.baseRent) : '');
  const [prepay, setPrepay] = useState(existing ? centsToInput(existing.utilitiesPrepayment) : '');
  const [submitted, setSubmitted] = useState(false);

  const areaValue = parseDecimal(area);
  const roomsValue = parseDecimal(rooms);
  const rentValue = parseEUR(rent);
  const prepayValue = parseEUR(prepay);

  const err = (invalid: boolean, msg: string) => (submitted && invalid ? msg : undefined);

  function save() {
    setSubmitted(true);
    if (
      !propertyId ||
      !name.trim() ||
      areaValue === null ||
      areaValue <= 0 ||
      areaValue > MAX_AREA ||
      roomsValue === null ||
      roomsValue <= 0 ||
      roomsValue > MAX_ROOMS ||
      rentValue === null ||
      rentValue > MAX_CENTS ||
      prepayValue === null ||
      prepayValue > MAX_CENTS
    ) {
      return;
    }
    dispatch({
      type: 'saveUnit',
      unit: {
        id: existing?.id ?? uid(),
        propertyId,
        name: name.trim(),
        floor: floor.trim(),
        areaSqm: areaValue,
        rooms: roomsValue,
        baseRent: rentValue,
        utilitiesPrepayment: prepayValue,
      },
    });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Wohnung bearbeiten' : 'Neue Wohnung' }} />
      <Field label="Bezeichnung" value={name} onChangeText={setName} maxLength={200} placeholder="z. B. Wohnung 3" error={err(!name.trim(), 'Pflichtfeld')} />
      <Field label="Lage (optional)" value={floor} onChangeText={setFloor} maxLength={100} placeholder="z. B. 2. OG links" />
      <Field label="Wohnfläche in m²" value={area} onChangeText={setArea} keyboardType="decimal-pad" error={err(areaValue === null || areaValue <= 0 || areaValue > MAX_AREA, 'Bitte eine Zahl zwischen 0 und 100.000 eingeben')} />
      <Field label="Zimmer" value={rooms} onChangeText={setRooms} keyboardType="decimal-pad" error={err(roomsValue === null || roomsValue <= 0 || roomsValue > MAX_ROOMS, 'Bitte eine Zahl zwischen 0 und 100 eingeben')} />
      <Field label="Kaltmiete pro Monat in €" value={rent} onChangeText={setRent} keyboardType="decimal-pad" error={err(rentValue === null || rentValue > MAX_CENTS, 'Bitte einen Betrag bis 1.000.000 € eingeben, z. B. 650,00')} />
      <Field
        label="Nebenkosten-Vorauszahlung pro Monat in €"
        value={prepay}
        onChangeText={setPrepay}
        keyboardType="decimal-pad"
        error={err(prepayValue === null || prepayValue > MAX_CENTS, 'Bitte einen Betrag bis 1.000.000 € eingeben, z. B. 180,00')}
        hint={existing ? 'Gilt für neu angelegte Monate. Bereits angelegte Zahlungen bleiben unverändert.' : undefined}
      />
      <Button label="Speichern" icon="checkmark" onPress={save} />
    </Screen>
  );
}
