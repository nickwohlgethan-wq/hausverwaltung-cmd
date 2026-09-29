import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen } from '@/components/ui';
import { useParam } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { useStore } from '@/lib/store';

export default function ObjektFormular() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const id = useParam('id');
  const existing = db.properties.find((p) => p.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [street, setStreet] = useState(existing?.street ?? '');
  const [zip, setZip] = useState(existing?.zip ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [submitted, setSubmitted] = useState(false);

  const missing = (v: string) => (submitted && !v.trim() ? 'Pflichtfeld' : undefined);

  function save() {
    setSubmitted(true);
    if (![name, street, zip, city].every((v) => v.trim())) return;
    dispatch({
      type: 'saveProperty',
      property: {
        id: existing?.id ?? uid('p'),
        name: name.trim(),
        street: street.trim(),
        zip: zip.trim(),
        city: city.trim(),
      },
    });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Objekt bearbeiten' : 'Neues Objekt' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Lindenhof" error={missing(name)} />
      <Field label="Straße und Hausnummer" value={street} onChangeText={setStreet} error={missing(street)} />
      <Field label="PLZ" value={zip} onChangeText={setZip} keyboardType="number-pad" maxLength={5} error={missing(zip)} />
      <Field label="Ort" value={city} onChangeText={setCity} error={missing(city)} />
      <Button label="Speichern" icon="checkmark" onPress={save} />
    </Screen>
  );
}
