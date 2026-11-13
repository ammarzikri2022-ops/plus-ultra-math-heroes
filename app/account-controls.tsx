'use client';
export default function AccountControls() {
  async function logout() {
    const response = await fetch('/api/hero-portal-test', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    if (response.ok) location.replace('/login'); else alert('Log keluar gagal. Sila cuba lagi.');
  }
  return <div style={{ position:'fixed',right:16,bottom:136,zIndex:1000,display:'flex',gap:8,alignItems:'center' }}><a className="academy-account" href="/kelas">Kelas U.A.</a><button className="academy-account" onClick={logout}>Log keluar</button></div>;
}
