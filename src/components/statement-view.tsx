import { Badge, Card, Divider, Empty, KeyValue, T } from '@/components/ui';
import { formatEUR } from '@/lib/money';
import { propertyOfUnit, unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { ALLOCATION_LABEL, computeStatement } from '@/lib/utilities';

const percent = (ratio: number) =>
  `${(ratio * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/** Nebenkostenabrechnung eines Mieters für ein Jahr. */
export function StatementView({ tenantId, year }: { tenantId: string; year: number }) {
  const { db } = useStore();
  const tenant = db.tenants.find((t) => t.id === tenantId);
  if (!tenant) return <Empty text="Mieter nicht gefunden." />;
  const statement = computeStatement(db, tenant, year);
  if (!statement) return <Empty text="Wohnung nicht gefunden." />;
  const unit = db.units.find((u) => u.id === statement.unitId)!;
  const property = propertyOfUnit(db, unit);

  if (statement.months === 0) {
    return <Empty icon="calendar-outline" text={`${tenant.name} wohnte ${year} noch nicht in dieser Wohnung.`} />;
  }
  if (statement.lines.length === 0) {
    return (
      <Empty
        icon="receipt-outline"
        text={`Für ${year} wurden für ${property?.name ?? 'dieses Objekt'} noch keine Nebenkosten erfasst.`}
      />
    );
  }

  const isRefund = statement.balance < 0;
  const isEven = statement.balance === 0;

  return (
    <>
      <Card>
        <T variant="heading">Abrechnung {year}</T>
        <T variant="muted">{tenant.name}</T>
        <T variant="muted">{unitLabel(db, unit.id)}</T>
        {statement.months < 12 ? (
          <T variant="muted">Abrechnungszeitraum: {statement.months} von 12 Monaten</T>
        ) : null}
      </Card>

      <Card>
        <T variant="bodyStrong">Kostenanteile</T>
        <Divider />
        {statement.lines.map((l) => (
          <Card key={l.costId} style={{ borderWidth: 0, padding: 0 }}>
            <KeyValue label={l.category} value={formatEUR(l.share)} strong />
            <T variant="caption">
              {formatEUR(l.total)} gesamt · Anteil {percent(l.ratio)} ({ALLOCATION_LABEL[l.key]})
            </T>
          </Card>
        ))}
        <Divider />
        <KeyValue label="Summe Anteile" value={formatEUR(statement.totalShare)} strong />
        <KeyValue label={`Vorauszahlungen (${statement.months} Monate)`} value={`− ${formatEUR(statement.prepaid)}`} />
      </Card>

      <Card>
        <Badge
          label={isEven ? 'Ausgeglichen' : isRefund ? 'Guthaben' : 'Nachzahlung'}
          tone={isEven ? 'neutral' : isRefund ? 'success' : 'warning'}
        />
        <T variant="title">
          {formatEUR(Math.abs(statement.balance))}
        </T>
        <T variant="muted">
          {isEven
            ? 'Die Vorauszahlungen decken die Kosten genau.'
            : isRefund
              ? 'Dieser Betrag wird dem Mieter erstattet.'
              : 'Dieser Betrag ist vom Mieter nachzuzahlen.'}
        </T>
      </Card>
    </>
  );
}
