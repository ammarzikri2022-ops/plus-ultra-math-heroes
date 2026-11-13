import { classId, cookieValue, PortalTestError, quizId, requireVerifiedFeatures, sessionCookies, testClient, testConfig, testConfigStatus, testIdentity, TEST_ACCESS } from '../../../lib/hero-portal-test';
import { portalSession } from '../../../lib/portal-session';
import quizReview from '../../../database/hero-portal-test/quiz-review.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  cookies.forEach(cookie => headers.append('Set-Cookie', cookie));
  return Response.json(body, { status, headers });
};
const fail = (e: unknown) => reply({ error: e instanceof Error ? e.message : 'Permintaan ujian gagal.' }, e instanceof PortalTestError ? e.status : 502);
const requireRole = (role: string, expected: string) => {
  if (role !== expected) throw new PortalTestError(403, `Akaun yang sedang aktif mempunyai profiles.role = ${role}; tindakan ini memerlukan ${expected}. Log keluar dan masuk menggunakan akaun ${expected === 'student' ? 'murid' : 'guru'} yang betul.`);
};
async function identity(request: Request) {
  return portalSession(request.headers.get('cookie'));
}
async function rpc(client: ReturnType<typeof testClient>, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.code || 'RPC_ERROR'} — ${error.message}`);
  return data;
}
export async function GET(request: Request) {
  try {
    const action = new URL(request.url).searchParams.get('action');
    if (action === 'health') {
      const status = testConfigStatus();
      return reply({ ok: status.enabled && status.featuresEnabled && status.urlConfigured && status.keyConfigured && status.projectMatches,
        endpoint: 'hero-portal-test', runtime: 'nodejs', config: status, productionUnchanged: true });
    }
    const config = testConfig();
    const { client, profile, user, cookies } = await identity(request);
    if (action === 'session') return reply({ id: user.id, role: profile.role }, 200, cookies);
    requireVerifiedFeatures();
    if (action === 'quizzes') {
      const { data, error } = await client.from('hero_quizzes').select('id,level,title,published').eq('published', true).order('id');
      if (error) throw error;
      return reply({ quizzes: data?.map(q => ({ ...q, id: String(q.id) })) || [] }, 200, cookies);
    }
    if (action === 'my-results') {
      requireRole(profile.role, 'student');
      const { data: attempts, error } = await client.from('hero_attempts')
        .select('student_id,quiz_id,correct_count,total_questions,submitted_at')
        .eq('student_id', user.id).order('submitted_at', { ascending: false });
      if (error) throw new Error(`hero_attempts: ${error.code} — ${error.message}`);
      if ((attempts || []).some(row => row.student_id !== user.id))
        throw new PortalTestError(403, 'hero_attempts: respons mengandungi rekod akaun murid lain. Bacaan sijil dihentikan.');
      const rows = (attempts || []).map(({ student_id: _studentId, ...row }) => row);
      return reply({ rows, read_status: rows.length ? 'records_visible' : 'no_visible_records',
        user_ref: user.id.slice(-8), project_ref: new URL(config.url).hostname.split('.')[0],
        warning: rows.length ? null : 'SELECT hero_attempts berjaya tetapi tiada rekod kelihatan untuk user.id sesi ini. Keadaan ini boleh bermaksud tiada rekod sendiri atau RLS menapis semua rekod.' }, 200, cookies);
    }
    if (action === 'classes') {
      requireRole(profile.role, 'teacher');
      const { data, error } = await client.from('classes').select('id,name,join_code,teacher_id').eq('teacher_id', user.id).order('id');
      if (error) throw new Error(`classes: ${error.code} — ${error.message}`);
      if ((data || []).some(row => row.teacher_id !== user.id)) throw new PortalTestError(403, 'classes: pemilik kelas tidak sepadan dengan sesi Auth.');
      return reply({ classes: (data || []).map(row => ({ id: String(row.id), name: row.name,
        join_code: typeof row.join_code === 'string' ? row.join_code : null })) }, 200, cookies);
    }
    if (action === 'my-classes') {
      requireRole(profile.role, 'student');
      const { data: memberships, error } = await client.from('class_members').select('class_id').eq('student_id', user.id);
      if (error) throw new Error(`class_members: ${error.code} — ${error.message}`);
      const ids = [...new Set((memberships || []).map(m => String(m.class_id)))];
      if (!ids.length) return reply({ classes: [] }, 200, cookies);
      const { data: classes, error: classError } = await client.from('classes').select('id,name').in('id', ids);
      // Membership is the authoritative proof for this student's class IDs.
      // A SELECT policy may hide the class name even though the membership
      // (created by hero_join_class) is visible. Never expose other classes.
      if (classError && classError.code !== '42501') throw new Error(`classes: ${classError.code} — ${classError.message}`);
      const visible = new Map((classes || []).map(c => [String(c.id), c.name]));
      return reply({ classes: ids.map(id => ({ id, name: visible.get(id) || `Kelas ID ${id}`,
        nameUnavailable: !visible.has(id) })),
        warning: classError || ids.some(id => !visible.has(id)) ? 'Nama kelas tidak boleh dibaca oleh akaun murid melalui polisi SELECT classes. Keahlian class_members masih disahkan.' : null }, 200, cookies);
    }
    if (action === 'roster') {
      requireRole(profile.role, 'teacher');
      const id = classId(new URL(request.url).searchParams.get('class_id'));
      const { data: owned, error: ownerError } = await client.from('classes').select('id').eq('id', id).eq('teacher_id', user.id).maybeSingle();
      if (ownerError) throw new Error(`classes: ${ownerError.code} — ${ownerError.message}`);
      if (!owned) return reply({ error: 'Kelas ini bukan milik guru yang disahkan.' }, 403, cookies);
      // Direct SELECT can return [] when RLS hides memberships. The ranking RPC
      // has a different access path, so an empty direct read is not proof of 0 pupils.
      const { data: rows, error: rosterError } = await client.rpc('hero_teacher_roster', { p_class_id: id });
      if (rosterError?.code === 'PGRST202') throw new PortalTestError(503,
        'hero_teacher_roster(p_class_id bigint) belum dipasang. Senarai murid tidak boleh disahkan melalui SELECT class_members yang ditapis RLS.');
      if (rosterError) throw new Error(`hero_teacher_roster: ${rosterError.code || 'RPC_ERROR'} — ${rosterError.message}`);
      if (!Array.isArray(rows) || !rows.every(row => row && typeof row.student_id === 'string' && typeof row.student_name === 'string' && String(row.class_id) === id))
        throw new Error('hero_teacher_roster: respons murid tidak sah atau kelas tidak sepadan.');
      return reply({ rows }, 200, cookies);
    }
    if (action === 'questions') {
      requireRole(profile.role, 'student');
      const id = quizId(new URL(request.url).searchParams.get('quiz_id'));
      return reply({ questions: await rpc(client, 'hero_get_questions', { p_quiz_id: id }) }, 200, cookies);
    }
    if (['report', 'ranking', 'teacher-reflections'].includes(action || '')) {
      const id = classId(new URL(request.url).searchParams.get('class_id'));
      if (action === 'ranking' && profile.role === 'student') {
        const { data: member, error } = await client.from('class_members').select('class_id').eq('student_id', user.id).eq('class_id', id).maybeSingle();
        if (error) throw new Error(`class_members: ${error.code} — ${error.message}`);
        if (!member) return reply({ error: 'Ranking kelas lain tidak dibenarkan.' }, 403, cookies);
      } else {
        requireRole(profile.role, 'teacher');
        const { data: owned, error: ownerError } = await client.from('classes').select('id').eq('id', id).eq('teacher_id', user.id).maybeSingle();
        if (ownerError) throw new Error(`classes: ${ownerError.code} — ${ownerError.message}`);
        if (!owned) throw new PortalTestError(403, 'Kelas ini bukan milik guru yang sedang log masuk.');
      }
      const functionName = action === 'report' ? 'hero_teacher_report' :
        action === 'teacher-reflections' ? 'hero_teacher_reflections' : 'hero_class_ranking';
      const rows = await rpc(client, functionName, { p_class_id: id });
      if (!Array.isArray(rows)) throw new Error(`${functionName}: respons bukan senarai JSON.`);
      if (action === 'teacher-reflections') {
        // The RPC may return rows outside p_class_id. Never forward those pupils'
        // reflections to the browser, even if the database function is misconfigured.
        if (rows.some(row => !row || typeof row !== 'object' || !/^[1-9]\d*$/.test(String(row.class_id))))
          throw new Error('hero_teacher_reflections: class_id tiada dalam respons; rekod tidak boleh ditapis dengan selamat.');
        return reply({ rows: rows.filter(row => String(row.class_id) === id), class_id: id,
          excluded_count: rows.filter(row => String(row.class_id) !== id).length }, 200, cookies);
      }
      return reply({ rows }, 200, cookies);
    }
    throw new Error('Tindakan bacaan ujian tidak dikenali.');
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    testConfig();
   const requestOrigin = request.headers.get('origin');
const siteOrigin = new URL(request.url).origin;

if (requestOrigin && requestOrigin !== siteOrigin) {
  return reply({ error: 'Origin ditolak.' }, 403);
}
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON diperlukan.' }, 415);
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: 'Permintaan terlalu besar.' }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Badan permintaan tidak sah.');
    if (body.action === 'logout') {
      const token = cookieValue(request.headers.get('cookie'), TEST_ACCESS);
      if (token) await testClient(token).auth.signOut({ scope: 'local' });
      return reply({ ok: true }, 200, sessionCookies());
    }
    if (body.action === 'login') {
      if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length > 254 || body.password.length > 256)
        throw new Error('E-mel atau kata laluan tidak sah.');
      const { data, error } = await testClient().auth.signInWithPassword({ email: body.email, password: body.password });
      if (error || !data.session) throw new Error(error?.message || 'Log masuk gagal.');
      const { client, profile } = await testIdentity(data.session.access_token);
      if (body.portal !== profile.role) throw new Error(`profiles.role = ${profile.role}; akses portal ${String(body.portal)} ditolak.`);
      if (profile.role === 'student') {
        // A void RPC succeeds with data=null; only an error-free response confirms the write.
        await rpc(client, 'hero_record_login');
      }
      let needsClass = false;
      if (profile.role === 'student') {
        const { data: memberships, error: membershipError } = await client.from('class_members').select('class_id').eq('student_id', data.user.id);
        if (membershipError) throw new Error(`class_members: ${membershipError.code} — ${membershipError.message}`);
        needsClass = !memberships?.length;
      }
      return reply({ id: data.user.id, role: profile.role, needsClass,
        loginRecorded: profile.role === 'student' }, 200,
        sessionCookies(data.session.access_token, data.session.refresh_token, data.session.expires_in));
    }
    if (body.action === 'signup') {
      if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length < 8 ||
        typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100)
        throw new Error('Nama, e-mel dan kata laluan murid tidak sah.');
      const { data, error } = await testClient().auth.signUp({ email: body.email.trim(), password: body.password,
        options: { data: { full_name: body.name.trim(), requested_portal: 'student' } } });
      if (error || !data.user) throw new Error(error?.message || 'Pendaftaran Auth tidak berjaya.');
      return reply({ status: 'check_email', message: 'Permintaan pendaftaran diterima. Sahkan e-mel, kemudian log masuk.' });
    }
    const { client, profile, user, cookies } = await identity(request);
    requireVerifiedFeatures();
    if (body.action === 'create-class') {
      requireRole(profile.role, 'teacher');
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw new Error('Nama kelas tidak sah.');
      const created = await rpc(client, 'hero_create_class', { p_name: body.name.trim() });
      if (!created || typeof created !== 'object' || Array.isArray(created)) throw new Error('hero_create_class: respons kelas tidak sah. Semak rekod sebelum mencuba lagi.');
      return reply({ created }, 200, cookies);
    }
    if (body.action === 'join-class') {
      requireRole(profile.role, 'student');
      if (typeof body.code !== 'string' || !body.code.trim() || body.code.length > 100) throw new Error('Kod kelas tidak sah.');
      const joined = await rpc(client, 'hero_join_class', { p_code: body.code.trim() });
      if (!joined || typeof joined !== 'object' || Array.isArray(joined)) throw new Error('hero_join_class: respons keahlian tidak sah. Semak status kelas sebelum mencuba lagi.');
      const { data: memberships, error: memberError } = await client.from('class_members').select('class_id').eq('student_id', profile.id);
      if (memberError) throw new Error(`class_members: ${memberError.code} — ${memberError.message}`);
      if (!memberships?.length) throw new Error('hero_join_class: RPC merespons tetapi keahlian kelas belum dapat dibaca. Semak RLS dan kod jemputan.');
      return reply({ joined }, 200, cookies);
    }
    if (body.action === 'submit-reflection') {
      requireRole(profile.role, 'student');
      const fields = ['reflection_1', 'reflection_2', 'reflection_3', 'reflection_4'] as const;
      if (fields.some(key => typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > 2000))
        throw new PortalTestError(400, 'Lengkapkan keempat-empat jawapan (1–2000 aksara setiap satu).');
      const id = classId(body.class_id);
      const { data: member, error: memberError } = await client.from('class_members').select('class_id').eq('student_id', profile.id).eq('class_id', id).maybeSingle();
      if (memberError) throw new Error(`class_members: ${memberError.code} — ${memberError.message}`);
      if (!member) throw new PortalTestError(403, 'Sertai kelas yang sah sebelum menghantar refleksi.');
      const saved = await rpc(client, 'hero_submit_reflection', {
        p_class_id: id,
        p_reflection_1: body.reflection_1.trim(),
        p_reflection_2: body.reflection_2.trim(),
        p_reflection_3: body.reflection_3.trim(),
        p_reflection_4: body.reflection_4.trim()
      });
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('hero_submit_reflection: respons simpanan tidak sah. Semak rekod sebelum mencuba lagi.');
      return reply({ saved }, 200, cookies);
    }
    if (body.action === 'submit-quiz') {
      requireRole(profile.role, 'student');
      // This is the published hero_quizzes.id, not a class ID. The quiz RPC
      // derives the authenticated student from auth.uid() and has no p_class_id.
      const submittedQuizId = quizId(body.quiz_id);
      if (!Array.isArray(body.answers) || body.answers.length < 1 || body.answers.length > 100 ||
          !body.answers.every((a: any) => a && typeof a === 'object' &&
            /^[1-9]\d*$/.test(String(a.question_id)) && Number.isSafeInteger(Number(a.question_id)) &&
            Number.isInteger(a.selected_option) && a.selected_option >= 0 && a.selected_option <= 3))
        throw new Error('Format jawapan kuiz tidak sah.');
      // The browser never supplies a score or is_correct; the database grades every answer.
      // SQL Langkah 5 requires JSONB question_id to be a number, not a string.
      const answers = body.answers.map((a: any) => ({ question_id: Number(a.question_id), selected_option: a.selected_option }));
      const { data: beforeRows, error: beforeError } = await client.from('hero_attempts')
        .select('quiz_id,correct_count,total_questions,submitted_at')
        .eq('student_id', user.id).eq('quiz_id', submittedQuizId)
        .order('submitted_at', { ascending: false }).limit(1);
      if (beforeError) throw new Error(`Diagnostik hero_attempts sebelum RPC: ${beforeError.code || 'READ_ERROR'} — ${beforeError.message}`);

      const rpcResult = await rpc(client, 'hero_submit_quiz', { p_quiz_id: submittedQuizId, p_answers: answers });
      const record = Array.isArray(rpcResult)
        ? (rpcResult.length === 1 && rpcResult[0] && typeof rpcResult[0] === 'object' ? rpcResult[0] as Record<string, unknown> : null)
        : (rpcResult && typeof rpcResult === 'object' ? rpcResult as Record<string, unknown> : null);
      const field = (name: string) => record && Object.prototype.hasOwnProperty.call(record, name) ? record[name] : undefined;
      const responseFields = Object.fromEntries(['attempt_id','correct','total','correct_count','total_questions'].map(name => {
        const value = field(name);
        return [name, { present: value !== undefined, type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
          ...(typeof value === 'number' || typeof value === 'string' ? { value } : {}) }];
      }));

      const { data: afterRows, error: afterError } = await client.from('hero_attempts')
        .select('quiz_id,correct_count,total_questions,submitted_at')
        .eq('student_id', user.id).eq('quiz_id', submittedQuizId)
        .order('submitted_at', { ascending: false }).limit(1);
      if (afterError) throw new Error(`hero_submit_quiz dipanggil tetapi semakan hero_attempts gagal: ${afterError.code || 'READ_ERROR'} — ${afterError.message}`);
      const before = beforeRows?.[0] || null, persisted = afterRows?.[0] || null;
      if (!persisted || (before && persisted.submitted_at === before.submitted_at))
        throw new Error('hero_submit_quiz selesai tanpa ralat, tetapi rekod percubaan baharu tidak dapat disahkan dalam hero_attempts. Markah belum disahkan sebagai tersimpan.');

      const responseCorrect = field('correct') ?? field('correct_count');
      const responseTotal = field('total') ?? field('total_questions');
      const persistedCorrect = Number(persisted.correct_count), persistedTotal = Number(persisted.total_questions);
      if (!Number.isInteger(persistedCorrect) || persistedTotal !== answers.length || persistedCorrect < 0 || persistedCorrect > persistedTotal)
        throw new Error('Rekod hero_attempts ditemui tetapi markah atau jumlah soalan tidak sah. Markah belum disahkan.');
      if (responseCorrect !== undefined && Number(responseCorrect) !== persistedCorrect)
        throw new Error('Markah dalam respons hero_submit_quiz tidak sepadan dengan rekod hero_attempts.');
      if (responseTotal !== undefined && Number(responseTotal) !== persistedTotal)
        throw new Error('Jumlah soalan dalam respons hero_submit_quiz tidak sepadan dengan rekod hero_attempts.');

      return reply({
        result: { attempt_id: field('attempt_id') ?? null, correct: persistedCorrect, total: persistedTotal },
        confirmation: { saved: true, source: 'public.hero_attempts', quiz_id: String(persisted.quiz_id), submitted_at: persisted.submitted_at },
        diagnostics: { auth: 'confirmed', user_ref: user.id.slice(-8), official_quiz_id: submittedQuizId,
          rpc: 'succeeded', persistence: 'confirmed', rpc_result_container: Array.isArray(rpcResult) ? 'array' : typeof rpcResult,
          response_fields: responseFields }
      }, 200, cookies);
    }
    if (body.action === 'submit-original-quiz') {
      requireRole(profile.role, 'student');
      const level = { 'tokoyami-5.1.1-v1': 'Asas', 'tokoyami-5.1.1-medium-v1': 'Sederhana', 'tokoyami-5.1.1-hard-v1': 'Sukar' }[String(body.version)];
      if (!level || !Array.isArray(body.answers) || body.answers.length !== 10 || !body.answers.every((a: unknown) => Number.isInteger(a) && Number(a) >= 0 && Number(a) <= 3))
        throw new PortalTestError(400, 'Jawapan kuiz asal tidak sah.');
      const original = quizReview.find(q => q.level === level);
      if (!original || original.questions.length !== 10) throw new Error('Kunci kuiz asal tidak tersedia.');
      const { data: quizzes, error: quizError } = await client.from('hero_quizzes').select('id,level,published').eq('level', level).eq('published', true);
      if (quizError) throw quizError;
      if (!quizzes || quizzes.length !== 1) throw new Error(`Kuiz ${level} belum diterbitkan dalam Supabase. Markah belum disimpan.`);
      const quizId = Number(quizzes[0].id);
      const fetched = await rpc(client, 'hero_get_questions', { p_quiz_id: quizId });
      if (!Array.isArray(fetched) || fetched.length !== 10) throw new Error('Bilangan soalan Supabase tidak sepadan dengan kuiz asal.');
      const ordered = [...fetched].sort((a, b) => Number(a.position) - Number(b.position));
      for (let i = 0; i < 10; i++) {
        if (ordered[i].prompt !== original.questions[i].prompt || JSON.stringify(ordered[i].options) !== JSON.stringify(original.questions[i].options) || Number(ordered[i].position) !== i + 1 || !Number.isSafeInteger(Number(ordered[i].id)))
          throw new Error('Bank soalan Supabase tidak sepadan dengan kuiz asal. Markah belum disimpan.');
      }
      const answers = ordered.map((q, i) => ({ question_id: Number(q.id), selected_option: body.answers[i] }));
      const result = await rpc(client, 'hero_submit_quiz', { p_quiz_id: quizId, p_answers: answers });
      return reply({ result }, 200, cookies);
    }
    throw new Error('Tindakan pembangunan ini tidak dikenali.');
  } catch (e) { return fail(e); }
}
