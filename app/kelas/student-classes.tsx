'use client';
import { useEffect, useState, type FormEvent } from 'react';
import '../hero-portal-dev/portal-development.css';
type HeroClass = { id: string; name: string; nameUnavailable?: boolean };
export default function StudentClasses({ name, studentId }: { name: string; studentId: string }) {
  const [classes, setClasses] = useState<HeroClass[]>([]), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function call(action: string, body?: Record<string, unknown>) {
    const response = await fetch('/api/hero-portal-test' + (body ? '' : '?action=' + action), { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify({ action, ...body }) : undefined });
    const result: any = await response.json(); if (!response.ok) throw Error(result.error || `HTTP ${response.status}`); return result;
  }
  async function checkSession() {
    const session = await call('session');
    if (session.role !== 'student' || session.id !== studentId)
      throw Error('Sesi akaun telah berubah sejak halaman ini dibuka. Log keluar, kemudian log masuk semula menggunakan akaun murid.');
  }
  async function refresh() { await checkSession(); const result = await call('my-classes'); if (!Array.isArray(result.classes)) throw Error('Senarai kelas tidak sah.'); setClasses(result.classes); if (result.warning) setNotice(result.warning); return result.classes as HeroClass[]; }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
  async function join(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { await checkSession(); await call('join-class', { code }); const current = await refresh(); if (!current.length) throw Error('Keahlian kelas belum muncul dalam Supabase.'); setCode(''); setNotice(current.some(item => item.nameUnavailable) ? 'Keahlian kelas disahkan oleh Supabase. Nama kelas masih ditapis oleh RLS.' : 'Keahlian kelas disahkan oleh Supabase.'); } catch (e) { setError(e instanceof Error ? e.message : 'Sertai kelas gagal.'); } finally { setBusy(false); } }
  async function logout() { setBusy(true); try { await call('logout', {}); location.replace('/login'); } catch (e) { setError(e instanceof Error ? e.message : 'Log keluar gagal.'); setBusy(false); } }
  return <main className="hp-dev"><header><strong>⚡ PLUS ULTRA MATH HEROES</strong><span>DEKU · RUANG MURID</span></header><div className="hp-wrap"><h1>SELAMAT DATANG, {name}!</h1><div className="hp-actions"><a href="/#rumah">← Kembali ke laman asal</a><button onClick={logout} disabled={busy}>LOG KELUAR</button></div><section className="hp-panel"><h2>🟢 Sertai kelas Tahun 5</h2><form className="hp-inline" onSubmit={join}><label>Kod jemputan guru<input required value={code} onChange={e => setCode(e.target.value)} maxLength={100} /></label><button disabled={busy}>SERTAI KELAS</button></form><h2>Kelas saya</h2>{classes.map(item => <p key={item.id}>{item.name} · ID {item.id}</p>)}{!classes.length && <p>Belum menyertai kelas. Dapatkan kod jemputan daripada guru.</p>}</section>{error && <p className="hp-error" role="alert">{error}</p>}{notice && <p className="hp-notice" role="status">{notice}</p>}</div></main>;
}
