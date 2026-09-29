import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen, Segmented } from '@/components/ui';
import { useMieter } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { PRIORITIES, PRIORITY_LABEL, TICKET_CATEGORIES } from '@/lib/labels';
import { useStore } from '@/lib/store';
import type { TicketPriority } from '@/lib/types';

export default function TicketNeu() {
  const { dispatch } = useStore();
  const router = useRouter();
  const mieter = useMieter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof TICKET_CATEGORIES)[number]>(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [submitted, setSubmitted] = useState(false);

  if (!mieter) return null;

  function save() {
    setSubmitted(true);
    if (!mieter || !title.trim()) return;
    const id = uid();
    dispatch({
      type: 'createTicket',
      ticket: {
        id,
        tenantId: mieter.tenant.id,
        unitId: mieter.unit.id,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'open',
        createdAt: new Date().toISOString(),
        comments: [],
      },
    });
    router.replace(`/ticket/${id}`);
  }

  return (
    <Screen>
      <Field
        label="Was ist das Problem?"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        placeholder="z. B. Heizung wird nicht warm"
        error={submitted && !title.trim() ? 'Bitte kurz beschreiben, worum es geht' : undefined}
      />
      <Segmented
        label="Kategorie"
        options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        value={category}
        onChange={setCategory}
      />
      <Segmented
        label="Dringlichkeit"
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        value={priority}
        onChange={setPriority}
      />
      <Field
        label="Beschreibung (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={5000}
        placeholder="Seit wann besteht das Problem? Wo genau?"
      />
      <Button label="Meldung senden" icon="send" onPress={save} />
    </Screen>
  );
}
