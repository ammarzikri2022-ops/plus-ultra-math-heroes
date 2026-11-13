import { PortalTestError, testConfig } from '../../lib/hero-portal-test';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { portalSession } from '../../lib/portal-session';
import PortalDevelopment from './portal-development';

export const dynamic = 'force-dynamic';
export default async function Page() {
  try { testConfig(); }
  catch { return <main style={{padding:32}}>Mod pembangunan PLUS ULTRA HERO PORTAL belum diaktifkan.</main>; }
  let session;
  try { session = await portalSession((await headers()).get('cookie')); }
  catch (error) {
    if (error instanceof PortalTestError && error.status === 401) redirect('/login');
    return <main className="hp-dev"><div className="hp-wrap"><h1>Dashboard Guru tidak dapat memeriksa sesi</h1><p role="alert">{error instanceof Error ? error.message : 'Semakan Supabase gagal.'}</p><a href="/login">Kembali ke log masuk</a></div></main>;
  }
  if (session.profile.role !== 'teacher') redirect('/#rumah');
  return <PortalDevelopment teacherId={session.user.id} />;
}
