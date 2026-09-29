import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PriorityBadge, TicketStatusBadge } from '@/components/status';
import { Card, Empty, Field, KeyValue, Screen, Segmented, SectionHeader, T } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { useParam } from '@/lib/hooks';
import { uid } from '@/lib/ids';
import { TICKET_STATUS_LABEL, TICKET_STATUSES } from '@/lib/labels';
import { unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme';

export default function TicketDetail() {
  const { db, session, profile, dispatch } = useStore();
  const theme = useTheme();
  const id = useParam('id');
  const ticket = db.tickets.find((t) => t.id === id);
  const [text, setText] = useState('');

  if (!ticket || !session) {
    return (
      <Screen>
        <Empty text="Dieses Ticket wurde nicht gefunden." />
      </Screen>
    );
  }

  const tenant = db.tenants.find((t) => t.id === ticket.tenantId);
  const isVerwalter = session.role === 'verwalter';
  // Mieter dürfen nur ihre eigenen Tickets sehen.
  if (session.role === 'mieter' && ticket.tenantId !== session.tenantId) {
    return (
      <Screen>
        <Empty text="Dieses Ticket wurde nicht gefunden." />
      </Screen>
    );
  }

  const authorName = isVerwalter ? (profile?.displayName ?? 'Hausverwaltung') : (tenant?.name ?? 'Mieter');

  function send() {
    const trimmed = text.trim();
    if (!trimmed || !ticket) return;
    dispatch({
      type: 'addComment',
      ticketId: ticket.id,
      comment: {
        id: uid(),
        authorRole: session!.role,
        authorName,
        text: trimmed,
        at: new Date().toISOString(),
      },
    });
    setText('');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: ticket.category }} />
      <Card>
        <T variant="heading">{ticket.title}</T>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
          <TicketStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </View>
        <T>{ticket.description || 'Keine Beschreibung.'}</T>
        <View style={{ height: 8 }} />
        <KeyValue label="Gemeldet von" value={tenant?.name ?? 'Unbekannt'} />
        <KeyValue label="Wohnung" value={unitLabel(db, ticket.unitId)} />
        <KeyValue label="Gemeldet am" value={formatDateTime(ticket.createdAt)} />
      </Card>

      {isVerwalter ? (
        <Segmented
          label="Status"
          options={TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] }))}
          value={ticket.status}
          onChange={(status) => dispatch({ type: 'setTicketStatus', id: ticket.id, status })}
        />
      ) : null}

      <SectionHeader title={`Verlauf (${ticket.comments.length})`} />
      {ticket.comments.length === 0 ? (
        <T variant="muted">Noch keine Antworten.</T>
      ) : (
        ticket.comments.map((c) => {
          const fromVerwalter = c.authorRole === 'verwalter';
          return (
            <Card
              key={c.id}
              style={{
                backgroundColor: fromVerwalter ? theme.primarySoft : theme.card,
                marginLeft: fromVerwalter ? 24 : 0,
                marginRight: fromVerwalter ? 0 : 24,
              }}>
              <T variant="caption" style={{ fontWeight: '600' }}>
                {c.authorName} · {formatDateTime(c.at)}
              </T>
              <T>{c.text}</T>
            </Card>
          );
        })
      )}

      <Field
        label="Antwort schreiben"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={5000}
        placeholder={isVerwalter ? 'Nachricht an den Mieter …' : 'Nachricht an die Verwaltung …'}
      />
      <Pressable
        onPress={send}
        disabled={!text.trim()}
        accessibilityRole="button"
        accessibilityLabel="Antwort senden"
        style={{
          minHeight: 48,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: theme.primary,
          opacity: text.trim() ? 1 : 0.5,
        }}>
        <Ionicons name="send" size={18} color={theme.onPrimary} />
        <T variant="bodyStrong" color={theme.onPrimary}>
          Senden
        </T>
      </Pressable>
    </Screen>
  );
}
