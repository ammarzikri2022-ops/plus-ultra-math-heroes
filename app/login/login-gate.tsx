'use client';
import { useState, type FormEvent } from 'react';
import '../hero-portal-dev/portal-development.css';

type Role = 'teacher' | 'student';
export default function LoginGate() {
  const [role, setRole] = useState<Role>('student');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = event.currentTarget, fields = new FormData(form);
    try {
      const response = await fetch('/api/hero-portal-test', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: register ? 'signup' : 'login', portal: role,
          email: fields.get('email'), password: fields.get('password'), name: fields.get('name') })
      });
      const result: any = await response.json();
      if (!response.ok) throw Error(result.error || `HTTP ${response.status}`);
      if (register) { form.reset(); setNotice(result.message); return; }
      if (result.role !== role) throw Error('Peranan akaun tidak sepadan.');
      window.location.assign(role === 'teacher' ? '/hero-teacher' : result.needsClass ? '/kelas' : '/#rumah');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Log masuk gagal.'); }
    finally { setBusy(false); }
  }
  return <main className="hp-dev hp-gate"><header><strong>⚡ PLUS ULTRA MATH HEROES</strong><span>U.A. HERO ACCESS GATE</span></header><div className="hp-wrap">
    <div className="hp-gate-heading"><span>MATEMATIK TAHUN 5 · MISI UKURAN PAHLAWAN</span><h1>SELAMAT DATANG, WIRA!</h1><p>Log masuk untuk memasuki akademi superhero.</p></div>
    <section className="hp-panel hp-auth"><h2>{register ? 'Daftar akaun murid' : 'Pilih laluan anda'}</h2>
      <div className="hp-actions"><button type="button" aria-pressed={role === 'student'} onClick={() => { setRole('student'); setRegister(false); setError(''); }}>🟢 MURID</button><button type="button" aria-pressed={role === 'teacher'} onClick={() => { setRole('teacher'); setRegister(false); setError(''); }}>🟡 GURU</button></div>
      {role === 'teacher' && <p className="hp-role-note">Akaun guru mesti mempunyai peranan <b>teacher</b> yang ditetapkan secara selamat dalam Supabase. Pendaftaran guru sendiri tidak boleh menaikkan peranan akaun.</p>}
      <form onSubmit={submit}>{register && <label>Nama murid<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>}
        <label>E-mel<input name="email" type="email" required autoComplete="username" /></label>
        <label>Kata laluan<input name="password" type="password" required minLength={register ? 8 : 1} autoComplete={register ? 'new-password' : 'current-password'} /></label>
        <button disabled={busy}>{busy ? 'MENGHUBUNGI SUPABASE…' : register ? '⚡ DAFTAR MURID' : `⚡ LOG MASUK ${role === 'teacher' ? 'GURU' : 'MURID'}`}</button>
      </form>{role === 'student' && <button type="button" onClick={() => { setRegister(!register); setError(''); setNotice(''); }}>{register ? 'Sudah ada akaun? Log masuk' : 'Daftar akaun murid'}</button>}
      {error && <p className="hp-error" role="alert">{error}</p>}{notice && <p className="hp-notice" role="status">{notice}</p>}
    </section></div></main>;
}
