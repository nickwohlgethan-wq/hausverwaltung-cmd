import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { PriorityBadge, TicketStatusBadge } from '@/components/status';
import { Card, Empty, T } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { Ticket } from '@/lib/types';

/** Liste von Tickets; `showTenant` blendet für Verwalter Mieter und Wohnung ein. */
export function TicketList({ tickets, showTenant }: { tickets: Ticket[]; showTenant?: boolean }) {
  const { db } = useStore();
  const router = useRouter();

  if (tickets.length === 0) {
    return <Empty icon="checkmark-circle-outline" text="Keine Meldungen vorhanden." />;
  }

  return (
    <>
      {tickets.map((t) => (
        <Card key={t.id} onPress={() => router.push(`/ticket/${t.id}`)} accessibilityLabel={t.title}>
          <T variant="bodyStrong">{t.title}</T>
          {showTenant ? (
            <T variant="muted">
              {db.tenants.find((x) => x.id === t.tenantId)?.name ?? 'Unbekannt'} · {unitLabel(db, t.unitId)}
            </T>
          ) : null}
          <T variant="caption">
            {t.category} · {formatDate(t.createdAt)}
            {t.comments.length > 0 ? ` · ${t.comments.length} Antwort${t.comments.length === 1 ? '' : 'en'}` : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <TicketStatusBadge status={t.status} />
            {t.priority !== 'normal' ? <PriorityBadge priority={t.priority} /> : null}
          </View>
        </Card>
      ))}
    </>
  );
}
