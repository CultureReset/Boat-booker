'use client';

import { useRouter } from 'next/navigation';
import { AuthForm, type AccountType } from './AuthForm';

/**
 * Client wrapper for the login page.
 *
 * Exists so the page itself can stay a server component that reads the query
 * string and checks the session; this just routes onward once auth succeeds.
 */
export function LoginPanel({ next, intent }: { next: string; intent: AccountType }) {
  const router = useRouter();

  return (
    <AuthForm
      initialAccountType={intent}
      initialStep={intent === 'owner' ? 'choose-account' : 'email'}
      onSuccess={(user) => {
        // Owners land in the business dashboard unless they were sent somewhere
        // specific; everyone else returns to where they came from.
        const destination = next !== '/' ? next : user.role === 'owner' ? '/owner' : '/';
        router.push(destination);
        router.refresh();
      }}
    />
  );
}
