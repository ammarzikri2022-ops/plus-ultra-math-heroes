import { cookieValue, PortalTestError, sessionCookies, testClient, testIdentity, TEST_ACCESS, TEST_REFRESH } from './hero-portal-test';

/** Resolve the new Supabase project using only HttpOnly cookies and Auth's user ID. */
export async function portalSession(cookie: string | null) {
  const access = cookieValue(cookie, TEST_ACCESS);
  if (access) {
    try { return { ...await testIdentity(access), token: access, cookies: [] as string[] }; }
    catch (error) {
      // Refresh only an expired/invalid Auth token. A profile/RLS/database error
      // must reach the caller unchanged instead of masquerading as a lost session.
      if (!(error instanceof PortalTestError && error.status === 401)) throw error;
    }
  }
  const refresh = cookieValue(cookie, TEST_REFRESH);
  if (!refresh) throw new PortalTestError(401, 'Sila log masuk dahulu.');
  const { data, error } = await testClient().auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) throw new PortalTestError(401, 'Sesi tamat. Sila log masuk semula.');
  return { ...await testIdentity(data.session.access_token), token: data.session.access_token,
    cookies: sessionCookies(data.session.access_token, data.session.refresh_token, data.session.expires_in) };
}
