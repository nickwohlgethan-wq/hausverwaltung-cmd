import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { PaymentBadge, TicketStatusBadge } from '@/components/status';
import { Badge, Button, Card, Divider, Empty, KeyValue, ListRow, Screen, SectionHeader, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatDate, formatMonth } from '@/lib/dates';
import { formatInviteCode, newInviteCode } from '@/lib/ids';
import { shareText } from '@/lib/share';
import { useParam, useToday } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { amountDue, paymentStatus } from '@/lib/payments';
import { addressOf, sortTickets, tenantOfUnit, unitTitle } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function WohnungDetail() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const today = useToday();
  const id = useParam('id');
  const [shareNote, setShareNote] = useState<string | null>(null);
  const unit = db.units.find((u) => u.id === id);
  const property = unit && db.properties.find((p) => p.id === unit.propertyId);

  if (!unit || !property) {
    return (
      <Screen>
        <Empty text="Diese Wohnung wurde nicht gefunden." />
      </Screen>
    );
  }

  const tenant = tenantOfUnit(db, unit.id);
  const payments = tenant
    ? db.payments.filter((p) => p.tenantId === tenant.id).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6)
    : [];
  const tickets = sortTickets(db.tickets.filter((t) => t.unitId === unit.id));

  return (
    <Screen>
      <Stack.Screen options={{ title: unit.name }} />
      <Card>
        <T variant="heading">{unitTitle(unit)}</T>
        <T variant="muted">
          {property.name} · {addressOf(property)}
        </T>
        <KeyValue label="Fläche" value={`${unit.areaSqm.toLocaleString('de-DE')} m²`} />
        <KeyValue label="Zimmer" value={unit.rooms.toLocaleString('de-DE')} />
        <KeyValue label="Kaltmiete" value={formatEUR(unit.baseRent)} />
        <KeyValue label="Nebenkosten-Vorauszahlung" value={formatEUR(unit.utilitiesPrepayment)} />
        <KeyValue label="Gesamtmiete" value={formatEUR(unit.baseRent + unit.utilitiesPrepayment)} strong />
      </Card>
      <Button
        label="Wohnung bearbeiten"
        variant="secondary"
        icon="create-outline"
        onPress={() => router.push(`/wohnung/formular?id=${unit.id}`)}
      />

      <SectionHeader title="Mieter" />
      {tenant ? (
        <Card>
          <T variant="bodyStrong">{tenant.name}</T>
          <KeyValue label="E-Mail" value={tenant.email || '–'} />
          <KeyValue label="Telefon" value={tenant.phone || '–'} />
          <KeyValue label="Einzug" value={formatDate(tenant.moveIn)} />
          <Divider />
          {tenant.claimed ? (
            <Badge label="App-Zugang aktiv" tone="success" />
          ) : (
            <>
              <Badge label="Noch nicht registriert" tone="warning" />
              {tenant.inviteCode ? (
                <>
                  <T variant="caption">Einladungscode für die App</T>
                  <T variant="title" selectable style={{ letterSpacing: 2 }}>
                    {formatInviteCode(tenant.inviteCode)}
                  </T>
                  <T variant="muted">
                    Gib den Code an {tenant.name} weiter. Er gilt einmal und schaltet nur diese Wohnung frei.
                  </T>
                  <Button
                    label="Code teilen"
                    icon="share-outline"
                    onPress={async () => {
                      const result = await shareText(
                        `Hallo ${tenant.name}, du kannst dich jetzt in der Hausverwaltungs-App registrieren. ` +
                          `Wähle bei der Registrierung „Mieter“ und gib danach diesen Einladungscode ein: ${formatInviteCode(tenant.inviteCode!)}`,
                      );
                      setShareNote(result === 'copied' ? 'In die Zwischenablage kopiert.' : result === 'failed' ? 'Teilen ist hier nicht möglich.' : null);
                    }}
                  />
                  {shareNote ? <T variant="caption">{shareNote}</T> : null}
                </>
              ) : null}
              <Button
                label="Neuen Code erzeugen"
                variant="secondary"
                icon="refresh-outline"
                onPress={() =>
                  confirm(
                    'Neuen Code erzeugen?',
                    'Der bisherige Code ist danach ungültig.',
                    'Neuen Code erzeugen',
                    () => dispatch({ type: 'saveTenant', tenant: { ...tenant, inviteCode: newInviteCode() } }),
                  )
                }
              />
            </>
          )}
          <Divider />
          <Button
            label="Mieter bearbeiten"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push(`/mietvertrag/formular?id=${tenant.id}`)}
          />
        </Card>
      ) : (
        <Card>
          <Badge label="Leerstand" tone="warning" />
          <T variant="muted">Diese Wohnung hat aktuell keinen Mieter.</T>
          <Button
            label="Mieter anlegen"
            icon="person-add-outline"
            onPress={() => router.push(`/mietvertrag/formular?unitId=${unit.id}`)}
          />
        </Card>
      )}

      {tenant ? (
        <>
          <SectionHeader title="Letzte Zahlungen" />
          {payments.length === 0 ? (
            <Empty icon="cash-outline" text="Noch keine Zahlungen erfasst." />
          ) : (
            payments.map((p) => (
              <ListRow
                key={p.id}
                title={formatMonth(p.month)}
                subtitle={`${formatEUR(p.paid)} von ${formatEUR(amountDue(p))}`}
                right={<PaymentBadge status={paymentStatus(p, today)} />}
                onPress={() => router.push(`/zahlung/${p.id}`)}
              />
            ))
          )}
        </>
      ) : null}

      {tickets.length > 0 ? (
        <>
          <SectionHeader title="Tickets" />
          {tickets.map((t) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={t.category}
              right={<TicketStatusBadge status={t.status} />}
              onPress={() => router.push(`/ticket/${t.id}`)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
