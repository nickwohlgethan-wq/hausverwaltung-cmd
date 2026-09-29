import { useState } from 'react';

import { PeriodSwitch } from '@/components/month-switch';
import { StatementView } from '@/components/statement-view';
import { Screen } from '@/components/ui';
import { useMieter } from '@/lib/hooks';

export default function MieterNebenkosten() {
  const mieter = useMieter();
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  if (!mieter) return null;

  return (
    <Screen>
      <PeriodSwitch label={`Abrechnungsjahr ${year}`} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} />
      <StatementView tenantId={mieter.tenant.id} year={year} />
    </Screen>
  );
}
