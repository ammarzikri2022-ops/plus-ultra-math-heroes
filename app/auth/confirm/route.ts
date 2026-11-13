import { academyClient, sessionCookies } from '../../../lib/academy-auth';
// Optional token-hash email template; the default Supabase confirmation redirect
// is also supported by the portal's consume-session flow.
export async function GET(request:Request) {
 const url=new URL(request.url);const hash=url.searchParams.get('token_hash');
 const target=new URL('/academy',url.origin);const headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
 try{
  if(!hash||hash.length>4096||url.searchParams.get('type')!=='email')throw new Error('invalid');
  const {data,error}=await academyClient().auth.verifyOtp({token_hash:hash,type:'email'});
  if(error||!data.session)throw new Error('invalid');
  sessionCookies(data.session).forEach(c=>headers.append('Set-Cookie',c));target.searchParams.set('confirmed','1');
 }catch{target.searchParams.set('confirmation_error','1');}
 headers.set('Location',target.href);return new Response(null,{status:303,headers});
}
