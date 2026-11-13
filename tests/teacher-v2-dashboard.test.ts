import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST,GET} from '../app/api/academy/route';
import {GET as rosterGET} from '../app/api/learning/route';

test('teacher workspace V2 is registered before class, roster and report requests',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY,oldId=process.env.HERO_TEACHER_USER_ID;
 const uid='db291d38-1c27-41b4-9a68-6bcff1773838',token='fixture.teacher.token';
 let registered=false;const calls:string[]=[];
 process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture_only';process.env.HERO_TEACHER_USER_ID=uid;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input),body=init?.body?JSON.parse(String(init.body)):{};calls.push(url.split('/').at(-1)||url);
  if(url.includes('/auth/v1/token'))return Response.json({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:{id:uid,email:'ammarzikri2020@gmail.com',email_confirmed_at:'2026-01-01T00:00:00Z'}});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:uid,email:'ammarzikri2020@gmail.com',email_confirmed_at:'2026-01-01T00:00:00Z'});
  if(url.includes('/rest/v1/profiles?'))return Response.json([{id:uid,role:'teacher',full_name:'Ammar',class_id:null}]);
  if(url.includes('/rest/v1/teacher_classes?'))return Response.json([{class_id:'1'}]);
  if(url.endsWith('/ua_teacher_workspace_context'))return Response.json(registered?{teacher_id:uid,scope:'owned_classes',version:2,class_ids:['1']}:null);
  if(url.endsWith('/ua_register_teacher_workspace')){assert.deepEqual(body,{});registered=true;return Response.json({teacher_id:uid,scope:'owned_classes',version:2,class_ids:['1']});}
  if(url.endsWith('/ua_teacher_list_classes'))return Response.json([{id:'1',name:'5 BESTARI',year_level:5,is_owner:true}]);
  if(url.endsWith('/ua_teacher_workspace_records'))return Response.json(body.p_kind==='directory'?[{student_id:'student-1',student_name:'Murid',class_id:'1',class_name:'5 BESTARI',avatar:null}]:[{id:'2',student_id:'student-1',student_name:'Murid',class_id:'1',class_name:'5 BESTARI',score:8,total_questions:10,completed_at:'2026-11-07T00:00:00Z'}]);
  if(url.endsWith('/ua_account_preferences'))return Response.json({code:'PGRST202',message:'not installed'},{status:404});
  return Response.json({code:'PGRST202',message:'unexpected RPC'},{status:404});
 }) as typeof fetch;
 try{
  const origin='https://academy.example',cookie='__Host-ua-session='+token;
  const login=await POST(new Request(origin+'/api/academy',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'login',portal:'teacher',email:'ammarzikri2020@gmail.com',password:'test-password'})}));
  assert.equal(login.status,200);assert.equal(registered,true);
  const classes=await GET(new Request(origin+'/api/academy?action=teacher-classes',{headers:{Cookie:cookie}}));
  assert.equal(classes.status,200);assert.equal(((await classes.json()) as any).classes[0].name,'5 BESTARI');
  const roster=await rosterGET(new Request(origin+'/api/learning?action=roster&classId=1',{headers:{Cookie:cookie}}));
  assert.equal(roster.status,200);assert.equal(((await roster.json()) as any).rows[0].student_name,'Murid');
  const report=await GET(new Request(origin+'/api/academy?action=report',{headers:{Cookie:cookie}}));
  assert.equal(report.status,200);assert.deepEqual(((await report.json()) as any).rows.map((r:any)=>[r.score,r.max_score]),[[8,10]]);
  const firstRegistration=calls.findIndex(x=>x==='ua_register_teacher_workspace');
  assert.ok(firstRegistration<calls.findIndex(x=>x==='ua_teacher_list_classes'));
  assert.ok(firstRegistration<calls.findIndex(x=>x==='ua_teacher_workspace_records'));
  assert.ok(!calls.some(x=>x==='ua_teacher_class_roster'||x==='hero_teacher_report'));
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;if(oldId===undefined)delete process.env.HERO_TEACHER_USER_ID;else process.env.HERO_TEACHER_USER_ID=oldId;}
});
