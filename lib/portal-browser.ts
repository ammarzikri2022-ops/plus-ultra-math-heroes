'use client';
export class PortalError extends Error {constructor(message:string,public code?:string){super(message);}}
async function call(path:string,body?:unknown){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),credentials:'same-origin',cache:'no-store'});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw new PortalError(d.error||'Sambungan gagal. Sila cuba semula.',d.code);return d;}
export function academyAPI(body?:unknown,action=''){return call('/api/academy'+action,body);}
export function learningAPI(body?:unknown,action=''){return call('/api/learning'+action,body);}
