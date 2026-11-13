'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import './portal-development.css';
type HeroClass = { id: string; name: string; join_code: string | null };
type Row = Record<string, any>;
async function api(action: string, body?: Record<string, unknown>, params?: Record<string, string>) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch('/api/hero-portal-test' + (body ? '' : '?' + query), { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify({ action, ...body }) : undefined });
  const result: any = await response.json().catch(() => ({ error: 'Respons API bukan JSON.' }));
  if (!response.ok) throw Error(`${action}: HTTP ${response.status} — ${result.error || 'Permintaan gagal.'}`);
  return result;
}
const describe = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal.';
export default function PortalDevelopment({ teacherId }: { teacherId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [sessionChanged, setSessionChanged] = useState(false);
  const [classes, setClasses] = useState<HeroClass[]>([]), [name, setName] = useState(''), [selected, setSelected] = useState('');
  const selectedClassId = useRef('');
  const [roster, setRoster] = useState<Row[] | null>(null), [report, setReport] = useState<Row[] | null>(null);
  const [reflections, setReflections] = useState<Row[] | null>(null), [ranking, setRanking] = useState<Row[] | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string,string>>({});
  function invalidateSession() {
    selectedClassId.current = '';
    setSessionChanged(true); setClasses([]); setSelected(''); setRoster(null); setReport(null);
    setReflections(null); setRanking(null); setSectionErrors({}); setError('');
  }
  async function checkTeacherSession() {
    const session = await api('session');
    if (session.role !== 'teacher' || session.id !== teacherId) {
      invalidateSession();
      throw Error('Sesi guru telah bertukar kepada akaun lain pada pelayar ini.');
    }
  }
  async function run(task: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await checkTeacherSession(); await task(); } catch (cause) { if (!sessionChanged) setError(describe(cause)); } finally { setBusy(false); } }
  async function loadClasses() { await checkTeacherSession(); const result = await api('classes'); if (!Array.isArray(result.classes)) throw Error('Respons kelas tidak sah.'); setClasses(result.classes); }
  useEffect(() => {
    const recheck = () => { if (document.visibilityState === 'visible') checkTeacherSession().catch(cause => {
      if (!String(cause).includes('Sesi guru telah bertukar')) setError(describe(cause));
    }); };
    loadClasses().catch(cause => setError(describe(cause)));
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => { window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
  }, [teacherId]);
  async function createClass(event: FormEvent) { event.preventDefault(); await run(async () => {
    const result = await api('create-class', { name });
    if (!result.created || typeof result.created !== 'object') throw Error('Supabase belum mengesahkan kelas.');
    await loadClasses(); setName('');
    const code = result.created.join_code;
    setNotice(code ? `Kelas disimpan. Kod jemputan: ${code}` : 'Kelas disimpan. Kod jemputan tidak ditemui dalam respons; semak senarai kelas.');
  }); }
  async function load(kind: 'roster' | 'report' | 'teacher-reflections' | 'ranking', id = selected) {
    if (!id || !classes.some(item => item.id === id)) throw Error('Pilih kelas sendiri dahulu.');
    try {
      const result = await api(kind, undefined, { class_id: id });
      if (!Array.isArray(result.rows)) throw Error(`${kind}: respons laporan bukan senarai yang sah.`);
      if (kind === 'teacher-reflections' &&
          (String(result.class_id) !== id || result.rows.some((row: Row) => String(row.class_id) !== id)))
        throw Error(`hero_teacher_reflections: respons tidak sepadan dengan kelas ID ${id}.`);
      if (selectedClassId.current !== id) return;
      setSectionErrors(previous => ({...previous, [kind]: kind === 'teacher-reflections' && result.excluded_count
        ? `RPC memulangkan ${result.excluded_count} rekod daripada kelas lain. Rekod tersebut disembunyikan; semak penapis dalam fungsi Supabase hero_teacher_reflections.` : ''}));
      if (kind === 'roster') setRoster(result.rows); else if (kind === 'report') setReport(result.rows); else if (kind === 'teacher-reflections') setReflections(result.rows); else setRanking(result.rows);
    } catch (cause) {
      if (selectedClassId.current !== id) return;
      if (kind === 'roster') setRoster(null); else if (kind === 'report') setReport(null); else if (kind === 'teacher-reflections') setReflections(null); else setRanking(null);
      setSectionErrors(previous => ({...previous, [kind]: describe(cause)}));
      throw cause;
    }
  }
  async function loadOne(kind: 'roster' | 'report' | 'teacher-reflections' | 'ranking') { await run(() => load(kind)); }
  async function loadAll(id = selected) {
    if (!id || !classes.some(item => item.id === id)) { setError('Pilih kelas sendiri dahulu.'); return; }
    selectedClassId.current = id;
    setBusy(true); setError(''); setSectionErrors({});
    try { await checkTeacherSession(); }
    catch (cause) { if (!String(cause).includes('Sesi guru telah bertukar')) setError(describe(cause)); setBusy(false); return; }
    const kinds = ['roster','report','teacher-reflections','ranking'] as const;
    const results = await Promise.allSettled(kinds.map(kind => load(kind, id)));
    if (selectedClassId.current !== id) return;
    const errors = results.map((r,i) => r.status === 'rejected' ? `${kinds[i]}: ${describe(r.reason)}` : '').filter(Boolean);
    if (errors.length) {
      if (errors.some(message => message.includes('profiles.role = student'))) invalidateSession();
      else setError(`${errors.length} daripada 4 bacaan gagal. Butiran dipaparkan pada panel masing-masing.`);
    }
    setBusy(false);
  }
  const className = classes.find(item => item.id === selected)?.name || selected;
  const rankingIdentityUnavailable = !!ranking?.length && ranking.some(row => typeof row.student_id !== 'string');
  // The roster is authoritative for membership. Ranking RPC may omit pupils
  // who have not submitted a quiz, so join by Auth student_id, never scores.
  const rankedMembers: { student_id: string; student_name: string; result: Row | undefined }[] | null = roster && ranking && !rankingIdentityUnavailable ? roster.map(member => {
    const result = ranking.find(row => row.student_id === member.student_id);
    return { student_id: String(member.student_id), student_name: String(member.student_name), result };
  }).sort((a,b) => {
    if (!a.result) return b.result ? 1 : String(a.student_name).localeCompare(String(b.student_name));
    if (!b.result) return -1;
    return Number(a.result.rank ?? Infinity)-Number(b.result.rank ?? Infinity);
  }) : null;

  const scores = (report || []).filter(row => Number.isFinite(Number(row.correct ?? row.score)) && Number(row.total ?? row.total_questions) > 0);
  const average = scores.length ? Math.round(scores.reduce((sum,row) => sum + Number(row.correct ?? row.score)/Number(row.total ?? row.total_questions),0)*100/scores.length) : null;
  const date = (value: unknown) => typeof value === 'string' && value ? new Date(value).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}) : 'Tarikh tidak tersedia';
  function exportCsv() {
    if (!report || !selected) return;
    const rows = [['Nama murid','Nama kuiz','Tahap','Jawapan betul','Jumlah soalan','Peratus','Tarikh menjawab'], ...report.map(row => [row.student_name,row.quiz_title ?? row.quiz,row.level ?? row.quiz,row.correct ?? row.score,row.total ?? row.total_questions,Number(row.total ?? row.total_questions)>0 ? Math.round(Number(row.correct ?? row.score)/Number(row.total ?? row.total_questions)*100)+'%' : '',row.submitted_at ?? row.completed_at])];
    const safe = (value: unknown) => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, x => "'" + x).replaceAll('"','""') + '"';
    const csv = '\uFEFF' + rows.map(row => row.map(safe).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=`laporan-kuiz-kelas-${selected}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  async function logout() { await run(async () => { await api('logout', {}); window.location.replace('/login'); }); }
  if (sessionChanged) return <main className="hp-dev"><header><strong>⚡ U.A. HERO COMMAND CENTER</strong><span>SESI GURU TAMAT</span></header><div className="hp-wrap"><section className="hp-panel" role="alert"><h1>Sesi guru telah bertukar</h1><p>Akaun murid telah log masuk dalam pelayar yang sama. Tab berkongsi kuki sesi, jadi Dashboard Guru tidak boleh membaca rekod menggunakan sesi murid.</p><p>Untuk menguji guru dan murid serentak, buka akaun murid dalam tetingkap InPrivate/Incognito atau profil pelayar berasingan. Kemudian log masuk semula sebagai guru di tetingkap ini.</p><a href="/login">Pergi ke halaman log masuk</a></section></div></main>;
  return <main className="hp-dev"><header><strong>⚡ U.A. HERO COMMAND CENTER</strong><span>ALL MIGHT · DASHBOARD GURU</span></header><div className="hp-wrap">
    <h1>SELAMAT DATANG, GURU!</h1><div className="hp-actions"><button onClick={logout} disabled={busy}>LOG KELUAR</button></div>
    <section className="hp-panel"><h2>🟡 Kelas saya</h2><form onSubmit={createClass} className="hp-inline"><label>Nama kelas Tahun 5<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} placeholder="5 Bestari" /></label><button disabled={busy}>CIPTA KELAS</button></form>
      <button disabled={busy} onClick={() => run(loadClasses)}>Muat semula kelas</button>
      <div className="hp-grid">{classes.map(item => <button key={item.id} className="hp-class" aria-pressed={selected === item.id} onClick={() => { selectedClassId.current = item.id; setSelected(item.id); setRoster(null); setReport(null); setReflections(null); setRanking(null); setSectionErrors({}); loadAll(item.id); }}><b>{item.name}</b><small>ID {item.id}</small><strong>Kod jemputan: {item.join_code || 'classes.join_code tidak tersedia untuk akaun ini'}</strong></button>)}</div>
      {!classes.length && <p>Belum ada kelas. Cipta kelas pertama anda di atas.</p>}
    </section>
    {selected && <><section className="hp-panel"><h2>Kelas {className}</h2><div className="hp-actions"><button disabled={busy} onClick={() => loadOne('roster')}>Lihat Murid</button><button disabled={busy} onClick={() => loadAll()}>MUAT LAPORAN KELAS</button><button disabled={busy} onClick={() => loadOne('teacher-reflections')}>Lihat Refleksi</button><button disabled={busy} onClick={() => loadOne('ranking')}>Hero Ranking</button><button disabled={busy || !report?.length} onClick={exportCsv}>📥 Eksport laporan CSV</button></div><div className="hp-stats"><article><span>Jumlah murid</span><strong>{roster ? roster.length : '—'}</strong></article><article><span>Purata markah</span><strong>{average === null ? '—' : `${average}%`}</strong></article><article><span>Jumlah kuiz dijawab</span><strong>{report ? report.length : '—'}</strong></article></div></section>
      <section className="hp-panel"><h2>🟢 Senarai murid</h2>{sectionErrors.roster && <p className="hp-error" role="alert">{sectionErrors.roster}</p>}{roster ? roster.length ? <div className="hp-table-wrap"><table><thead><tr><th>Nama murid</th><th>Kelas</th><th>Tarikh menyertai</th></tr></thead><tbody>{roster.map((row,index) => <tr key={row.student_id || index}><td>{row.student_name}</td><td>{className}</td><td>{date(row.joined_at)}</td></tr>)}</tbody></table></div> : <p>Belum ada murid dalam kelas.</p> : !sectionErrors.roster && <p>Tekan Lihat Murid untuk memuatkan rekod.</p>}</section>
      <section className="hp-panel"><h2>🟣 Rekod markah</h2>{sectionErrors.report && <p className="hp-error" role="alert">{sectionErrors.report}</p>}{report ? report.length ? <div className="hp-table-wrap"><table><thead><tr><th>Nama</th><th>Nama kuiz</th><th>Tahap</th><th>Jawapan betul</th><th>Jumlah soalan</th><th>Peratus</th><th>Tarikh menjawab</th></tr></thead><tbody>{report.map((row,index) => <tr key={index}><td>{row.student_name}</td><td>{row.quiz_title ?? row.quiz ?? '—'}</td><td>{row.level ?? row.quiz ?? '—'}</td><td>{row.correct ?? row.score ?? '—'}</td><td>{row.total ?? row.total_questions ?? '—'}</td><td>{Number(row.total ?? row.total_questions)>0 ? Math.round(Number(row.correct ?? row.score)/Number(row.total ?? row.total_questions)*100)+'%' : '—'}</td><td>{date(row.submitted_at ?? row.completed_at)}</td></tr>)}</tbody></table></div> : <p>Belum ada markah kuiz direkodkan.</p> : !sectionErrors.report && <p>Laporan belum dimuatkan.</p>}</section>
      <section className="hp-panel"><h2>🏆 Hero Ranking</h2>{sectionErrors.ranking && <p className="hp-error" role="alert">{sectionErrors.ranking}</p>}{sectionErrors.roster && <p className="hp-error" role="alert">Ranking penuh memerlukan senarai murid: {sectionErrors.roster}</p>}{rankingIdentityUnavailable && <p className="hp-error" role="alert">hero_class_ranking tidak memulangkan student_id. Markah tidak boleh dipadankan dengan keahlian kelas tanpa ID murid; fungsi RPC perlu memulangkan student_id bagi setiap rekod.</p>}{rankedMembers ? rankedMembers.length ? <div className="hp-table-wrap"><table><thead><tr><th>Kedudukan</th><th>Nama murid</th><th>Jumlah betul</th><th>Kuiz selesai</th></tr></thead><tbody>{rankedMembers.map(({student_id,student_name,result},index) => <tr key={student_id || index}><td>{result?.rank ?? '—'}</td><td>{student_name}</td><td>{result ? result.correct_total : 'Belum menjawab'}</td><td>{result ? result.quizzes_completed : '—'}</td></tr>)}</tbody></table></div> : <p>Belum ada murid dalam kelas.</p> : !sectionErrors.ranking && !sectionErrors.roster && !rankingIdentityUnavailable && <p>Senarai murid dan ranking belum dimuatkan.</p>}</section>
      <section className="hp-panel"><h2>🔵 Refleksi murid</h2>{sectionErrors['teacher-reflections'] && <p className="hp-error" role="alert">{sectionErrors['teacher-reflections']}</p>}{reflections ? reflections.length ? reflections.map((row,index) => <article className="hp-reflection" key={`${String(row.id ?? row.reflection_id ?? 'no-id')}:${String(row.submitted_at ?? row.created_at ?? index)}`}><h3>{row.student_name || row.full_name || 'Nama tidak tersedia'} · {row.class_name || className}</h3><small>Rekod ID: {String(row.id ?? row.reflection_id ?? 'Tidak dipulangkan oleh RPC')} · Kelas ID: {String(row.class_id)} · Dihantar: {date(row.submitted_at ?? row.created_at)}</small><p><b>1. Perkara baharu tentang penukaran unit panjang:</b> {row.reflection_1 ?? 'Tiada jawapan pada rekod ini'}</p><p><b>2. Aktiviti paling membantu dan sebabnya:</b> {row.reflection_2 ?? 'Tiada jawapan pada rekod ini'}</p><p><b>3. Kesukaran mempelajari penukaran unit panjang:</b> {row.reflection_3 ?? 'Tiada jawapan pada rekod ini'}</p><p><b>4. Cadangan penambahbaikan pembelajaran:</b> {row.reflection_4 ?? 'Tiada jawapan pada rekod ini'}</p></article>) : <p>Belum ada refleksi murid bagi kelas ini.</p> : !sectionErrors['teacher-reflections'] && <p>Refleksi belum dimuatkan.</p>}</section></>}
    {error && <p className="hp-error" role="alert">{error}</p>}{notice && <p className="hp-notice" role="status">{notice}</p>}
  </div></main>;
}
