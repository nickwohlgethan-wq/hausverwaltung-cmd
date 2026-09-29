import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen } from '@/components/ui';
import { useParam } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { centsToInput, parseDecimal, parseEUR } from '@/lib/money';
import { useStore } from '@/lib/store';

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
      roomsValue === null ||
      roomsValue <= 0 ||
      rentValue === null ||
      prepayValue === null
    ) {
      return;
    }
    dispatch({
      type: 'saveUnit',
      unit: {
        id: existing?.id ?? uid('u'),
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
      <Field label="Bezeichnung" value={name} onChangeText={setName} placeholder="z. B. Wohnung 3" error={err(!name.trim(), 'Pflichtfeld')} />
      <Field label="Lage (optional)" value={floor} onChangeText={setFloor} placeholder="z. B. 2. OG links" />
      <Field label="Wohnfläche in m²" value={area} onChangeText={setArea} keyboardType="decimal-pad" error={err(areaValue === null || areaValue <= 0, 'Bitte eine Zahl größer 0 eingeben')} />
      <Field label="Zimmer" value={rooms} onChangeText={setRooms} keyboardType="decimal-pad" error={err(roomsValue === null || roomsValue <= 0, 'Bitte eine Zahl größer 0 eingeben')} />
      <Field label="Kaltmiete pro Monat in €" value={rent} onChangeText={setRent} keyboardType="decimal-pad" error={err(rentValue === null, 'Bitte einen Betrag eingeben, z. B. 650,00')} />
      <Field
        label="Nebenkosten-Vorauszahlung pro Monat in €"
        value={prepay}
        onChangeText={setPrepay}
        keyboardType="decimal-pad"
        error={err(prepayValue === null, 'Bitte einen Betrag eingeben, z. B. 180,00')}
        hint={existing ? 'Gilt für neu angelegte Monate. Bereits angelegte Zahlungen bleiben unverändert.' : undefined}
      />
      <Button label="Speichern" icon="checkmark" onPress={save} />
    </Screen>
  );
}
