import { createClient } from '@supabase/supabase-js';

// Isolated from academyConfig(): the production Supabase project is untouched.
export const TEST_ACCESS = '__Host-hero-portal-test-access';
export const TEST_REFRESH = '__Host-hero-portal-test-refresh';
export class PortalTestError extends Error { constructor(public status: number, message: string) { super(message); } }

const TEST_PROJECT_REF = 'qyvyxpwqjosqxfmwsikx';

export function testConfigStatus() {
  const enabled = process.env.HERO_PORTAL_TEST_ENABLED === '1';
  const featuresEnabled = process.env.HERO_PORTAL_TEST_FEATURES_ENABLED === '1';
  const url = process.env.HERO_PORTAL_TEST_URL?.replace(/\/$/, '') || '';
  const key = process.env.HERO_PORTAL_TEST_PUBLISHABLE_KEY || '';
  return {
    enabled,
    featuresEnabled,
    urlConfigured: Boolean(url),
    keyConfigured: Boolean(key),
    expectedProject: TEST_PROJECT_REF,
    projectMatches: url === `https://${TEST_PROJECT_REF}.supabase.co`,
  };
}

export function testConfig() {
  if (process.env.HERO_PORTAL_TEST_ENABLED !== '1')
    throw new PortalTestError(503, 'Konfigurasi Netlify belum lengkap: tetapkan HERO_PORTAL_TEST_ENABLED=1 dalam Environment variables dengan skop Functions, kemudian deploy semula.');
  const url = process.env.HERO_PORTAL_TEST_URL;
  const key = process.env.HERO_PORTAL_TEST_PUBLISHABLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
    throw new PortalTestError(503, 'Konfigurasi Netlify belum lengkap: HERO_PORTAL_TEST_URL tidak sah atau tiada. Gunakan URL projek Supabase qyvyxpwqjosqxfmwsikx.');
  if (!key || !(key.startsWith('sb_publishable_') || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)))
    throw new PortalTestError(503, 'Konfigurasi Netlify belum lengkap: HERO_PORTAL_TEST_PUBLISHABLE_KEY tidak sah atau tiada. Gunakan publishable/anon key, bukan service-role key.');
  if (url.replace(/\/$/, '') !== `https://${TEST_PROJECT_REF}.supabase.co`)
    throw new PortalTestError(503, `Projek Supabase tidak sepadan. Netlify mesti menggunakan projek ${TEST_PROJECT_REF}.`);
  return { url: url.replace(/\/$/, ''), key };
}

export function requireVerifiedFeatures() {
  if (process.env.HERO_PORTAL_TEST_FEATURES_ENABLED !== '1')
    throw new PortalTestError(503, 'Konfigurasi Netlify belum lengkap: tetapkan HERO_PORTAL_TEST_FEATURES_ENABLED=1 dengan skop Functions, kemudian deploy semula.');
}

export function testClient(token?: string) {
  const { url, key } = testConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    }
  });
}

export function cookieValue(header: string | null, name: string) {
  const value = header?.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_.-]{8,8192}$/.test(value) ? value : undefined;
}

export function sessionCookies(access = '', refresh = '', seconds = 0) {
  const flags = 'Path=/; HttpOnly; Secure; SameSite=Strict';
  return [
    `${TEST_ACCESS}=${access}; ${flags}; Max-Age=${Math.min(seconds, 3600)}`,
    `${TEST_REFRESH}=${refresh}; ${flags}; Max-Age=${refresh ? 2592000 : 0}`
  ];
}

export async function testIdentity(token: string) {
  const client = testClient(token);
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) throw new PortalTestError(401, authError?.message || 'Sesi ujian tidak sah.');
  const { data: profile, error } = await client.from('profiles').select('id,full_name,role').eq('id', auth.user.id).single();
  if (error) throw new Error(`profiles: ${error.code || 'READ_ERROR'} — ${error.message}`);
  if (!profile || profile.id !== auth.user.id || !['teacher', 'student'].includes(profile.role))
    throw new PortalTestError(403, 'Profil tidak sepadan dengan ID Auth atau role tidak sah.');
  return { client, user: auth.user, profile };
}

export function classId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > BigInt('9223372036854775807'))
    throw new Error('ID kelas bigint tidak sah.');
  return value;
}

/** Quiz IDs are bigint in Supabase, but JSON may carry a safe ID as a number. */
export function quizId(value: unknown) {
  const normalized = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[1-9]\d{0,18}$/.test(normalized) || BigInt(normalized) > BigInt('9223372036854775807'))
    throw new Error('ID kuiz bigint tidak sah.');
  return normalized;
}
