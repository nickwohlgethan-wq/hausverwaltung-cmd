import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen } from '@/components/ui';
import { formatDate, isoToInput, monthOf, parseDate } from '@/lib/dates';
import { useParam, useToday } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { useStore } from '@/lib/store';

export default function MietvertragFormular() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const today = useToday();
  const id = useParam('id');
  const existing = db.tenants.find((t) => t.id === id);
  const unitParam = useParam('unitId');
  const unitId = existing?.unitId ?? unitParam;

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [moveIn, setMoveIn] = useState(existing ? isoToInput(existing.moveIn) : formatDate(today));
  const [submitted, setSubmitted] = useState(false);

  const moveInISO = parseDate(moveIn);

  function save() {
    setSubmitted(true);
    if (!unitId || !name.trim() || !moveInISO) return;
    dispatch({
      type: 'saveTenant',
      tenant: {
        id: existing?.id ?? uid('t'),
        unitId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        moveIn: moveInISO,
      },
    });
    // Neue Mieter sollen sofort eine Sollstellung für den laufenden Monat haben.
    if (!existing && monthOf(moveInISO) <= monthOf(today)) {
      dispatch({ type: 'generateMonth', month: monthOf(today) });
    }
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Mieter bearbeiten' : 'Neuer Mieter' }} />
      <Field label="Name" value={name} onChangeText={setName} error={submitted && !name.trim() ? 'Pflichtfeld' : undefined} />
      <Field label="E-Mail (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Telefon (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field
        label="Einzugsdatum"
        value={moveIn}
        onChangeText={setMoveIn}
        placeholder="TT.MM.JJJJ"
        keyboardType="numbers-and-punctuation"
        error={submitted && !moveInISO ? 'Bitte ein gültiges Datum eingeben, z. B. 01.10.2026' : undefined}
      />
      <Button label="Speichern" icon="checkmark" onPress={save} />
    </Screen>
  );
}
