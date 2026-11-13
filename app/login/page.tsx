import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { portalSession } from '../../lib/portal-session';
import LoginGate from './login-gate';

export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  try {
    const { profile } = await portalSession((await headers()).get('cookie'));
    redirect(profile.role === 'teacher' ? '/hero-teacher' : '/#rumah');
  } catch (error) {
    // next/navigation redirects throw; propagate them rather than rendering login.
    if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
    return <LoginGate />;
  }
}
