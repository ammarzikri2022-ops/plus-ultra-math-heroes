import { createClient, type Session } from '@supabase/supabase-js';
export type AcademyProfile = { id: string; role: 'student' | 'teacher'; display_name: string; class_name: string; avatar: string | null; class_id: string | null; allowed_class_ids?: string[]; teacher_workspace?: boolean; database_role?: 'student' | 'teacher' };
export const HEROES = ['deku', 'bakugo', 'todoroki', 'red-riot', 'tokoyami'];
export const SESSION_COOKIE = '__Host-ua-session';
export const REFRESH_COOKIE = '__Host-ua-refresh';
export class AcademyError extends Error {
  constructor(public status: number, message: string, public code?: string, public diagnostic?: { operation: string; resource: string; upstreamCode?: string }) { super(message); }
}
export function academyConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new AcademyError(503, 'Project URL Supabase belum dikonfigurasi dengan betul.', 'project_url_missing');
  if (!key.startsWith('sb_publishable_')) throw new AcademyError(503, 'Publishable Key Supabase belum dikonfigurasi dengan betul.', 'publishable_key_missing');
  return { url: url.replace(/\/$/, ''), key };
}
export function academyClient(token?: string) {
  const { url, key } = academyConfig();
  try {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}), fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15_000) }) } });
  } catch { throw new AcademyError(503, 'Supabase Client tidak dapat diwujudkan. Hubungi pentadbir.', 'client_creation_failed'); }
}
export function authError(error: { message: string; status?: number; code?: string }) {
  if (/invalid api key/i.test(error.message)) return new AcademyError(503,'Publishable Key ditolak oleh Supabase. Semak konfigurasi projek.','publishable_key_invalid');
  if (error.status === 0 || (error.status && error.status >= 500)) return new AcademyError(503,'Sambungan ke Supabase Auth gagal. Cuba semula; jangan tukar kata laluan dahulu.','auth_service_unavailable');
  const messages: Record<string,string> = {
    email_not_confirmed: 'E-mel belum disahkan. Buka pautan pengesahan dalam e-mel dahulu.',
    invalid_credentials: 'E-mel atau kata laluan tidak tepat.',
    bad_jwt: 'Sesi tidak sah. Sila log masuk semula.',
    session_not_found: 'Sesi telah tamat. Sila log masuk semula.',
    refresh_token_not_found: 'Sesi telah tamat. Sila log masuk semula.',
    over_email_send_rate_limit: 'Had penghantaran e-mel Supabase dicapai. Tunggu sebelum mencuba lagi.',
    signup_disabled: 'Pendaftaran akaun baharu belum dibenarkan oleh projek Supabase.',
    weak_password: 'Kata laluan tidak memenuhi syarat keselamatan Supabase.'
  };
  return new AcademyError(error.status && error.status >= 400 ? error.status : 400, messages[error.code || ''] || error.message.slice(0, 500), error.code || 'auth_error', {operation:'AUTH',resource:'Supabase Authentication',upstreamCode:error.code});
}
export async function supabase(path: string, token?: string, body?: unknown, method?: string) {
  const { url, key } = academyConfig();
  let response: Response;
  try { response = await fetch(url + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(12_000) }); }
  catch { throw new AcademyError(502, 'Sambungan Supabase gagal. Sila cuba lagi.', 'network_error'); }
  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    if (/invalid api key/i.test(String(data?.message || ''))) throw new AcademyError(503,'Publishable Key ditolak oleh Supabase. Semak konfigurasi projek.','publishable_key_invalid');
    const resource = path.split('?')[0];
    throw new AcademyError(response.status, `Operasi ${method || (body === undefined ? 'GET' : 'POST')} ${resource} gagal${data?.code ? ` (${data.code})` : ''}. ${String(data?.message || 'Supabase menolak permintaan.').slice(0, 300)}`, data?.code, {operation:method || (body === undefined ? 'GET' : 'POST'),resource,upstreamCode:data?.code});
  }
  return data;
}
function cookieValue(cookie: string | null, name: string) {
  const v = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
  return v && /^[A-Za-z0-9_.-]{8,8192}$/.test(v) ? v : undefined;
}
export function tokenFromCookie(cookie: string | null) { return cookieValue(cookie, SESSION_COOKIE); }
export async function verifiedProfile(token?: string): Promise<AcademyProfile> {
  if (!token) throw new AcademyError(401, 'Sila log masuk dahulu.', 'not_authenticated');
  const client = academyClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error) throw authError(error);
  if (!data.user) throw new AcademyError(401, 'Sesi tidak sah.');
  const { data: p, error: profileError } = await client.from('profiles').select('id,full_name,role').eq('id', data.user.id).maybeSingle();
  if (profileError) throw tableReadError('public.profiles', profileError);
  // RLS may silently hide rows. With a user's session alone, absence and RLS
  // filtering cannot be distinguished: do not invent a diagnosis or bypass RLS.
  if (!p) throw new AcademyError(403, 'Profil tidak dapat dibaca untuk akaun ini. Profil mungkin tiada atau ditapis polisi SELECT profiles. Pentadbir perlu menyemak kedua-duanya.', 'profile_not_visible', {operation:'SELECT',resource:'public.profiles'});
  if (p.id !== data.user.id) throw new AcademyError(403, 'ID profil tidak sepadan dengan pengguna yang disahkan.', 'profile_identity_mismatch');
  if (p.role === 'pending_teacher') throw new AcademyError(403, 'AKAUN GURU SEDANG MENUNGGU KELULUSAN', 'teacher_pending');
  if (!['student','teacher'].includes(p.role)) throw new AcademyError(403, 'Peranan akaun ini belum dibenarkan.', 'role_not_allowed');
  let allowedClasses: string[] | undefined;
  let pupilClassId: string | null = null;
  if (p.role === 'teacher') {
    const { data: owned, error: classesError } = await client.from('classes').select('id').eq('teacher_id', data.user.id);
    if (classesError) throw tableReadError('public.classes', classesError);
    allowedClasses = [...new Set((owned || []).map(row => String(row.id)))];
  } else {
    const { data: memberships, error: membershipError } = await client.from('class_members').select('class_id').eq('student_id', data.user.id);
    if (membershipError) throw tableReadError('public.class_members', membershipError);
    pupilClassId = memberships?.length ? String(memberships[0].class_id) : null;
  }
  // Optional while the reviewed migration is pending. Missing RPC cannot
  // elevate anyone and does not break existing pupil/legacy teacher login.
  const workspace = await teacherWorkspace(token, data.user.id);
  if (p.role === 'teacher' || workspace) {
    const allowedId = process.env.HERO_TEACHER_USER_ID;
    const allowedEmail = process.env.HERO_TEACHER_EMAIL?.trim().toLowerCase();
    if (!allowedId && !allowedEmail) throw new AcademyError(503, 'Identiti guru tunggal belum dikonfigurasi pada pelayan.', 'teacher_config_missing');
    const matches = allowedId ? data.user.id === allowedId : !!allowedEmail && !!data.user.email_confirmed_at && data.user.email?.toLowerCase() === allowedEmail;
    if (!matches) throw new AcademyError(403, 'Akaun ini bukan guru tunggal yang dibenarkan.', 'teacher_denied');
  }
  if (workspace) allowedClasses = workspace.class_ids;
  let preferences: any = null;
  try { preferences = await supabase('/rest/v1/rpc/ua_account_preferences',token,{}); }
  catch(e) { if (!(e instanceof AcademyError && e.code==='PGRST202')) throw e; }
  if (preferences && preferences.user_id !== p.id) throw new AcademyError(502,'Identiti tetapan akaun tidak sepadan.','profile_identity_mismatch');
  const avatar = preferences?.avatar || data.user.user_metadata?.hero_avatar;
  return { id:p.id, role:workspace ? 'teacher' : p.role, database_role:p.role, teacher_workspace:!!workspace, display_name: String(preferences?.full_name || p.full_name || data.user.user_metadata?.full_name || data.user.email || '').slice(0,100), class_id:pupilClassId, class_name:preferences?.class_name || pupilClassId || 'Kelas belum ditetapkan', avatar:HEROES.includes(avatar) ? avatar : 'deku', ...(allowedClasses ? {allowed_class_ids:allowedClasses} : {}) };
}
export type TeacherWorkspace = {teacher_id:string; scope:'owned_classes'; version:2; class_ids:string[]};
function checkedWorkspace(value: unknown, uid: string): TeacherWorkspace | null {
  if (value === null) return null;
  const w = value as TeacherWorkspace;
  if (!w || w.teacher_id !== uid || w.scope !== 'owned_classes' || w.version !== 2 || !Array.isArray(w.class_ids) || !w.class_ids.every(id => typeof id === 'string' && /^-?(0|[1-9][0-9]{0,18})$/.test(id) && BigInt(id) >= BigInt('-9223372036854775808') && BigInt(id) <= BigInt('9223372036854775807'))) throw new AcademyError(502,'Konteks ruang guru tidak sepadan dengan akaun Auth atau format bigint.','workspace_context_invalid');
  return w;
}
function missingWorkspace(error: unknown) { return error instanceof AcademyError && error.code === 'PGRST202'; }
export async function teacherWorkspace(token: string, uid: string) {
  try { return checkedWorkspace(await supabase('/rest/v1/rpc/ua_teacher_workspace_context',token,{}),uid); }
  catch (e) { if (missingWorkspace(e)) return null; throw e; }
}
export async function registerTeacherWorkspace(token: string, uid: string) {
  let value: unknown;
  try { value = await supabase('/rest/v1/rpc/ua_register_teacher_workspace',token,{}); }
  catch(e) { if (missingWorkspace(e)) throw new AcademyError(503,'Migrasi ruang guru versi bigint belum diaktifkan. Akaun Auth anda kekal selamat; semak konfigurasi workspace dahulu.','teacher_workspace_setup_required'); throw e; }
  const workspace = checkedWorkspace(value,uid);
  if (!workspace) throw new AcademyError(502,'Database belum mengesahkan ruang guru.','workspace_registration_failed');
  return workspace;
}
export async function ensureTeacherWorkspace(token: string) {
  const profile = await verifiedProfile(token);
  if (profile.database_role !== 'teacher') throw new AcademyError(403,'Akaun guru yang disahkan diperlukan.','teacher_denied');
  await registerTeacherWorkspace(token,profile.id);
  const context = await teacherWorkspace(token,profile.id);
  if (!context) throw new AcademyError(403,'Konteks ruang guru belum disahkan.','workspace_required');
  const confirmed = await verifiedProfile(token);
  if (!confirmed.teacher_workspace || confirmed.id !== context.teacher_id) throw new AcademyError(403,'Ruang guru belum disahkan.','workspace_required');
  return confirmed;
}
function tableReadError(resource: string, error: {code?: string; message: string}) {
  const denied = error.code === '42501' || /permission denied|row.level security/i.test(error.message);
  return new AcademyError(denied ? 403 : 502, denied ? `Bacaan SELECT ${resource} ditolak oleh kebenaran atau polisi RLS. Semak polisi SELECT untuk pengguna authenticated.` : `Bacaan SELECT ${resource} gagal${error.code ? ` (${error.code})` : ''}. ${error.message.slice(0,300)}`, denied ? 'database_read_denied' : 'database_read_failed', {operation:'SELECT',resource,upstreamCode:error.code});
}
export function sessionHeader(token: string, seconds = 3600) { return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${Math.min(Math.max(seconds, 0), 3600)}; HttpOnly; Secure; SameSite=Lax`; }
export function sessionCookies(session?: Session | null) {
  return [sessionHeader(session?.access_token || '', session ? session.expires_in : 0), `${REFRESH_COOKIE}=${session?.refresh_token || ''}; Path=/; Max-Age=${session ? 60 * 60 * 24 * 30 : 0}; HttpOnly; Secure; SameSite=Lax`, '__Host-ua-guest=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'];
}
export async function resolveToken(cookie: string | null) {
  const token = tokenFromCookie(cookie);
  if (token) {
    const { error, data } = await academyClient().auth.getUser(token);
    if (!error && data.user) return { token, cookies: [] as string[] };
    if (error && (error.status === 0 || (error.status && error.status >= 500) || /invalid api key/i.test(error.message))) throw authError(error);
  }
  const refresh = cookieValue(cookie, REFRESH_COOKIE);
  if (refresh) {
    const { data, error } = await academyClient().auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session) return { token: data.session.access_token, cookies: sessionCookies(data.session) };
  }
  throw new AcademyError(401, 'Sesi telah tamat. Sila log masuk semula.', 'not_authenticated');
}
export async function signOutCookieSession(cookie: string | null) {
  const token = tokenFromCookie(cookie); const refresh = cookieValue(cookie, REFRESH_COOKIE);
  if (!token) return;
  if (refresh) {
    const client = academyClient();
    const {error:sessionError} = await client.auth.setSession({access_token:token,refresh_token:refresh});
    if (sessionError) throw authError(sessionError);
    const {error} = await client.auth.signOut({scope:'local'});
    if (error) throw authError(error);
  } else await supabase('/auth/v1/logout?scope=local',token,{});
}
