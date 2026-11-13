import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { portalSession } from '../../lib/portal-session';
import StudentClasses from './student-classes';
export const dynamic = 'force-dynamic';
export default async function Page() {
  let session;
  try { session = await portalSession((await headers()).get('cookie')); } catch { redirect('/login'); }
  if (session.profile.role !== 'student') redirect('/hero-teacher');
  return <StudentClasses name={session.profile.full_name || 'Wira muda'} studentId={session.user.id} />;
}
