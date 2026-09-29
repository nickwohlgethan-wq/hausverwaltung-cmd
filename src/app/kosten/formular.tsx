import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen, Segmented } from '@/components/ui';
import { useParam } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { parseEUR } from '@/lib/money';
import { useStore } from '@/lib/store';
import { ALLOCATION_LABEL, COST_CATEGORIES, defaultKey } from '@/lib/utilities';
import type { AllocationKey } from '@/lib/types';

export default function KostenFormular() {
  const { dispatch } = useStore();
  const router = useRouter();
  const propertyId = useParam('propertyId');
  const year = Number(useParam('year'));

  const [category, setCategory] = useState<string>(COST_CATEGORIES[0]);
  const [customName, setCustomName] = useState('');
  const [key, setKey] = useState<AllocationKey>(defaultKey(COST_CATEGORIES[0]));
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const amountCents = parseEUR(amount);
  const isCustom = category === 'Sonstiges';
  const name = isCustom ? customName.trim() : category;

  function pickCategory(c: string) {
    setCategory(c);
    setKey(defaultKey(c));
  }

  function save() {
    setSubmitted(true);
    if (!propertyId || !Number.isInteger(year) || !name || amountCents === null || amountCents <= 0) return;
    dispatch({
      type: 'saveCost',
      cost: { id: uid('c'), propertyId, year, category: name, amount: amountCents, key },
    });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Kosten ${year}` }} />
      <Segmented
        label="Kostenart"
        options={COST_CATEGORIES.map((c) => ({ value: c, label: c }))}
        value={category as (typeof COST_CATEGORIES)[number]}
        onChange={pickCategory}
      />
      {isCustom ? (
        <Field
          label="Bezeichnung"
          value={customName}
          onChangeText={setCustomName}
          error={submitted && !name ? 'Pflichtfeld' : undefined}
        />
      ) : null}
      <Field
        label="Gesamtbetrag für das Objekt in €"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        error={submitted && (amountCents === null || amountCents <= 0) ? 'Bitte einen Betrag größer 0 eingeben' : undefined}
      />
      <Segmented
        label="Verteilung auf die Wohnungen"
        options={(Object.keys(ALLOCATION_LABEL) as AllocationKey[]).map((k) => ({ value: k, label: ALLOCATION_LABEL[k] }))}
        value={key}
        onChange={setKey}
      />
      <Button label="Speichern" icon="checkmark" onPress={save} />
    </Screen>
  );
}
