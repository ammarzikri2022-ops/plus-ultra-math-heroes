import { AcademyError, supabase } from './academy-auth';
export const QUIZ_VERSION = 'tokoyami-5.1.1-v1';
export const QUIZ_VERSIONS: readonly string[] = [QUIZ_VERSION, 'tokoyami-5.1.1-medium-v1', 'tokoyami-5.1.1-hard-v1'];
export const QUIZ_LENGTH = 10;
export function classId(value:unknown):value is string {
  return typeof value==='string' && /^-?(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value)>=BigInt('-9223372036854775808') && BigInt(value)<=BigInt('9223372036854775807');
}
export function uuid(value:unknown):value is string { return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function quizAnswers(value:unknown):value is number[]{return Array.isArray(value)&&value.length===QUIZ_LENGTH&&value.every(v=>Number.isInteger(v)&&v>=0&&v<=3);}
export async function learningRPC(name:string,token:string,body:Record<string,unknown>={}) {
 try{return await supabase('/rest/v1/rpc/'+name,token,body);}
 catch(e){if(e instanceof AcademyError&&e.code==='PGRST202')throw new AcademyError(503,'Sambungan pembelajaran ini belum diaktifkan dalam Supabase. Data belum disimpan.','learning_setup_required',{operation:'RPC',resource:name,upstreamCode:e.code});throw e;}
}
