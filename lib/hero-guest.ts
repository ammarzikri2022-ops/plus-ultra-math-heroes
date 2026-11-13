import { AcademyError } from './academy-auth';
export const GUEST_COOKIE='__Host-hero-guest';
type Guest={id:string;name:string;className:string;issued:number};
function secret(){const s=process.env.HERO_GUEST_SESSION_SECRET;if(!s||s.length<32)throw new AcademyError(503,'Sesi murid belum dikonfigurasi pada pelayan.','guest_config_missing');return s;}
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function decode(s:string){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
async function mac(s:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s))))}
export async function encodeGuest(p:Guest){const body=b64(new TextEncoder().encode(JSON.stringify(p)));return body+'.'+await mac(body)}
export async function readGuest(cookie:string|null):Promise<Guest>{const value=cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(GUEST_COOKIE+'='))?.slice(GUEST_COOKIE.length+1);if(!value||value.length>1800)throw new AcademyError(401,'Masuk sebagai murid dahulu.','guest_missing');const [body,signature]=value.split('.');if(!body||!signature||signature!==(await mac(body)))throw new AcademyError(401,'Sesi murid tidak sah. Masuk semula.','guest_invalid');let p:Guest;try{p=JSON.parse(new TextDecoder().decode(decode(body)))}catch{throw new AcademyError(401,'Sesi murid tidak sah.','guest_invalid')}if(!p||typeof p.id!=='string'||!p.name||!p.className||!Number.isFinite(p.issued)||Date.now()-p.issued>8*3600000||p.issued>Date.now()+60000)throw new AcademyError(401,'Sesi murid tamat. Masuk semula.','guest_expired');return p;}
export function guestCookie(value:string,maxAge=8*3600){return `${GUEST_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;}
export type {Guest};
