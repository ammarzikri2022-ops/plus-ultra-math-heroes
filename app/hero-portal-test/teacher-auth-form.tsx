'use client';

import { useState, type FormEvent } from 'react';

type Result = { kind: 'success' | 'error'; message: string; role?: string } | null;

export default function TeacherAuthForm() {
  const [email, setEmail] = useState('ammarzikri2020@gmail.com');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setResult(null);
    try {
      const response = await fetch('/api/hero-portal-test', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', portal: 'teacher', email: email.trim(), password })
      });
      const data = await response.json() as { error?: string; role?: string };
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.role !== 'teacher') throw new Error(`Role profil bukan teacher: ${String(data.role)}`);
      setResult({ kind: 'success', message: 'AUTH GURU BERJAYA', role: data.role });
    } catch (error) {
      setResult({ kind: 'error', message: error instanceof Error ? error.message : 'Ralat tidak diketahui.' });
    } finally {
      setPassword(''); setPending(false);
    }
  }

  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'linear-gradient(135deg,#051325,#102f55)',color:'#eef7ff',fontFamily:'system-ui,sans-serif'}}>
    <section style={{width:'min(100%,460px)',border:'1px solid #56d9ff',borderRadius:18,padding:28,background:'rgba(3,19,41,.9)',boxShadow:'0 0 28px #159de755'}}>
      <p style={{color:'#7ddfff',letterSpacing:2,fontWeight:800}}>PLUS ULTRA HERO PORTAL · MOD UJIAN</p>
      <h1 style={{fontSize:28,margin:'12px 0'}}>Ujian Auth Guru</h1>
      <p style={{lineHeight:1.5}}>Log masuk ke projek Supabase baharu untuk menyemak Auth dan <code>public.profiles.role</code>. Dashboard, kuiz dan ranking masih tidak aktif.</p>
      <form onSubmit={submit} autoComplete="on" style={{display:'grid',gap:16,marginTop:24}}>
        <label style={{display:'grid',gap:6}}>E-mel guru
          <input type="email" required autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} style={inputStyle} />
        </label>
        <label style={{display:'grid',gap:6}}>Kata laluan
          <input type="password" required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} style={inputStyle} />
        </label>
        <button disabled={pending} type="submit" style={{padding:14,border:0,borderRadius:10,background:'#f8c84d',color:'#071525',fontWeight:900,cursor:'pointer'}}>{pending?'MENGUJI AUTH…':'UJI LOG MASUK GURU'}</button>
      </form>
      {result && <div role="status" aria-live="polite" style={{marginTop:20,padding:14,borderRadius:10,border:`1px solid ${result.kind==='success'?'#45e2aa':'#ff6b76'}`,overflowWrap:'anywhere'}}>
        <strong>{result.message}</strong>{result.role && <p>Auth disahkan · profiles.role = {result.role}</p>}
      </div>}
      <p><a href="/hero-portal-dev" style={{color:'#8df2ff'}}>Buka portal pembangunan guru dan murid →</a></p>
      <p style={{fontSize:12,opacity:.75,marginTop:20}}>Kata laluan tidak disimpan pada halaman ini; medan dikosongkan selepas setiap cubaan.</p>
    </section>
  </main>;
}

const inputStyle = {padding:12,borderRadius:8,border:'1px solid #67a9d2',background:'#071b31',color:'#fff',fontSize:16};
