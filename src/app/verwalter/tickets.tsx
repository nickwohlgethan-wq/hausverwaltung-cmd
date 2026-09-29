import { useState } from 'react';

import { TicketList } from '@/components/ticket-list';
import { Screen, Segmented } from '@/components/ui';
import { TICKET_STATUS_LABEL, TICKET_STATUSES } from '@/lib/labels';
import { sortTickets } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { TicketStatus } from '@/lib/types';

type Filter = 'all' | TicketStatus;

export default function Tickets() {
  const { db } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const tickets = sortTickets(db.tickets).filter((t) => filter === 'all' || t.status === filter);

  return (
    <Screen>
      <Segmented<Filter>
        options={[
          { value: 'all', label: 'Alle' },
          ...TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      <TicketList tickets={tickets} showTenant />
    </Screen>
  );
}
