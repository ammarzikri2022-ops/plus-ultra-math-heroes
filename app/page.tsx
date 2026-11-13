import { readFileSync } from "node:fs";
import { join } from "node:path";
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { portalSession } from '../lib/portal-session';
import AccountControls from './account-controls';

export const dynamic = 'force-dynamic';

const siteDocument = readFileSync(join(process.cwd(), "app", "site-shell.html"), "utf8");
const bodyMatch = siteDocument.match(/<body[^>]*>([\s\S]*?)<script\s+src=["']app\.js["']><\/script>/i);
const siteBody = bodyMatch?.[1] ?? "";

export default async function Home() {
  let session;
  try { session = await portalSession((await headers()).get('cookie')); } catch { redirect('/login'); }
  if (session.profile.role !== 'student') redirect('/hero-teacher');
  const profile = session.profile;
  return <><div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: siteBody }} /><AccountControls /><script id="ua-account-context" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify({id:profile.id,role:'student',name:profile.full_name || ''}).replaceAll("<",String.fromCharCode(92)+"u003c")}}/><script src="/app.js" /><script src="/metadata.js" /><script src="/hero-lms.js" /></>;
}
