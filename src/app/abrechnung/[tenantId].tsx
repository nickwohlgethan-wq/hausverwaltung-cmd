import { Screen } from '@/components/ui';
import { StatementView } from '@/components/statement-view';
import { useParam } from '@/lib/hooks';

export default function Abrechnung() {
  const tenantId = useParam('tenantId');
  const year = Number(useParam('year')) || new Date().getFullYear() - 1;
  return <Screen>{tenantId ? <StatementView tenantId={tenantId} year={year} /> : null}</Screen>;
}
