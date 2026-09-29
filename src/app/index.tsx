import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

/** Einstieg: leitet je nach Anmeldung zum passenden Bereich weiter. */
export default function Index() {
  const { user } = useAuth();
  const { session, needsInvite } = useStore();
  if (!user) return <Redirect href="/login" />;
  if (needsInvite) return <Redirect href="/einladung" />;
  if (session?.role === 'verwalter') return <Redirect href="/verwalter" />;
  if (session?.role === 'mieter') return <Redirect href="/mieter" />;
  return null;
}
