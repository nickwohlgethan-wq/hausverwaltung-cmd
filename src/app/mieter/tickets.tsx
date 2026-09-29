import { useRouter } from 'expo-router';

import { TicketList } from '@/components/ticket-list';
import { Button, Screen } from '@/components/ui';
import { useMieter } from '@/lib/hooks';
import { sortTickets } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function MieterTickets() {
  const { db } = useStore();
  const router = useRouter();
  const mieter = useMieter();
  if (!mieter) return null;

  const tickets = sortTickets(db.tickets.filter((t) => t.tenantId === mieter.tenant.id));

  return (
    <Screen>
      <Button label="Schaden melden" icon="add-circle-outline" onPress={() => router.push('/ticket/neu')} />
      <TicketList tickets={tickets} />
    </Screen>
  );
}
