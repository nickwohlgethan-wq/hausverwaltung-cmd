import { Redirect } from 'expo-router';

import { useStore } from '@/lib/store';

/** Einstieg: leitet je nach Anmeldung zum passenden Bereich weiter. */
export default function Index() {
  const { session } = useStore();
  if (!session) return <Redirect href="/login" />;
  return <Redirect href={session.role === 'verwalter' ? '/verwalter' : '/mieter'} />;
}
