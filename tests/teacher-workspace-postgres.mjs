// LOCAL PostgreSQL only: no network, no production database/credentials.
// Install @electric-sql/pglite in a separate scratch directory, then set
// PGLITE_MODULE to its absolute dist/index.js. Node >=22.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite(); let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',s:'00000000-0000-4000-8000-000000000003',u:'00000000-0000-4000-8000-000000000004'};
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE public.classes(id bigint PRIMARY KEY,name text NOT NULL,year_level integer DEFAULT 5);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text NOT NULL DEFAULT '',class_id bigint REFERENCES public.classes(id),role text NOT NULL DEFAULT 'student');
CREATE TABLE public.teacher_classes(teacher_id uuid,class_id bigint REFERENCES public.classes(id),PRIMARY KEY(teacher_id,class_id));
CREATE TABLE public.quizzes(id bigint PRIMARY KEY,title text,max_score numeric);
CREATE TABLE public.attempts(id bigint PRIMARY KEY,quiz_id bigint REFERENCES quizzes(id),student_id uuid,score numeric,submitted_at timestamptz,attempt_number integer);
CREATE TABLE public.answers(id bigint PRIMARY KEY,attempt_id bigint REFERENCES attempts(id),answer text);
CREATE TABLE public.student_reflections(id bigint PRIMARY KEY,student_id uuid,emotion text,topic text,understanding integer,reflection text,help_requested boolean,created_at timestamptz DEFAULT now());
CREATE FUNCTION public.create_student_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN INSERT INTO public.profiles(id,full_name,role) VALUES(NEW.id,'','student'); RETURN NEW; END$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_student_profile();
CREATE FUNCTION public.is_teacher_for_class(target_class_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT FROM public.teacher_classes tc JOIN public.profiles p ON p.id=tc.teacher_id WHERE p.id=auth.uid() AND p.role='teacher' AND tc.class_id=target_class_id)$$;
INSERT INTO public.classes VALUES(9007199254740993,'Existing huge bigint',5);
INSERT INTO public.quizzes VALUES(1,'Shared quiz',100);
`);
for(const id of Object.values(ids)) await db.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,$2)',[id,id===ids.u?null:new Date().toISOString()]);
await db.query('UPDATE profiles SET class_id=9007199254740993 WHERE id=$1',[ids.s]);
for(const t of ['profiles','classes','teacher_classes','quizzes','attempts','answers','student_reflections']) await db.exec(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${t} TO authenticated;`);
await db.exec(`CREATE POLICY original_profile_read ON profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY original_profile_update ON profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY original_profile_insert ON profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
CREATE POLICY original_profile_delete ON profiles FOR DELETE TO authenticated USING(id=auth.uid());
CREATE POLICY original_class_read ON classes FOR SELECT TO authenticated USING(id IN(SELECT class_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY original_tc_read ON teacher_classes FOR SELECT TO authenticated USING(teacher_id=auth.uid());
CREATE POLICY original_quiz_read ON quizzes FOR SELECT TO authenticated USING(true);
CREATE POLICY original_attempts ON attempts TO authenticated USING(student_id=auth.uid()) WITH CHECK(student_id=auth.uid());
CREATE POLICY original_answers ON answers TO authenticated USING(attempt_id IN(SELECT id FROM attempts WHERE student_id=auth.uid())) WITH CHECK(attempt_id IN(SELECT id FROM attempts WHERE student_id=auth.uid()));
CREATE POLICY original_reflections ON student_reflections TO authenticated USING(student_id=auth.uid()) WITH CHECK(student_id=auth.uid());
INSERT INTO attempts VALUES(1,1,'${ids.s}',90,now(),1);
INSERT INTO answers VALUES(1,1,'35');
INSERT INTO student_reflections(id,student_id,reflection) VALUES(1,'${ids.s}','Fixture original reflection');`);
const scalar=async(sql,p=[])=>Object.values((await db.query(sql,p)).rows[0])[0];
async function as(id,fn,role='authenticated'){await db.exec(`SET ROLE ${role}; SET request.jwt.claim.sub='${id || ''}';`);try{return await fn();}finally{await db.exec('RESET ROLE');}}
const deny=async(fn)=>{await assert.rejects(fn);checks++;};
const originalTrigger=await scalar("SELECT pg_get_functiondef('public.create_student_profile()'::regprocedure)");
const originalHelper=await scalar("SELECT pg_get_functiondef('public.is_teacher_for_class(bigint)'::regprocedure)");
const before=await as(ids.s,async()=>({profile:(await db.query('SELECT * FROM profiles')).rows,quiz:(await db.query('SELECT * FROM quizzes')).rows,attempt:(await db.query('SELECT * FROM attempts')).rows,answer:(await db.query('SELECT * FROM answers')).rows,reflection:(await db.query('SELECT * FROM student_reflections')).rows}));
const migration=readFileSync(new URL('../database/teacher-workspace-v2/02-proposed-migration-DO-NOT-RUN-YET.sql',import.meta.url),'utf8');
await deny(()=>db.exec(migration)); await db.exec('ROLLBACK'); // unreviewed fingerprint refuses.
const audit=readFileSync(new URL('../database/teacher-workspace-v2/01-audit.sql',import.meta.url),'utf8');
const digestQuery=audit.slice(audit.indexOf('select md5('),audit.indexOf('-- Inspect student workflows'));
const digest=await scalar(digestQuery);
await db.exec(migration.replace("SET LOCAL ua.reviewed_security_fingerprint = '';",`SET LOCAL ua.reviewed_security_fingerprint = '${digest}';`));
check(await scalar("SELECT pg_get_functiondef('public.create_student_profile()'::regprocedure)"),originalTrigger);
check(await scalar("SELECT pg_get_functiondef('public.is_teacher_for_class(bigint)'::regprocedure)"),originalHelper);
check(await scalar('SELECT id::text FROM classes'),'9007199254740993');
await deny(()=>as(ids.u,()=>db.query('SELECT ua_register_teacher_workspace()')));
await deny(()=>as(null,()=>db.query('SELECT ua_register_teacher_workspace()'),'anon'));
for(const k of ['a','b']) await as(ids[k],()=>db.query('SELECT ua_register_teacher_workspace()'));
check(await scalar('SELECT role FROM profiles WHERE id=$1',[ids.a]),'student');
check(await as(ids.a,()=>scalar('SELECT ua_teacher_workspace_context()')),{teacher_id:ids.a,scope:'owned_classes',class_ids:[],version:2});
const ca=await as(ids.a,()=>scalar("SELECT ua_teacher_create_class('5 Amanah')"));
const cb=await as(ids.b,()=>scalar("SELECT ua_teacher_create_class('5 Bestari')"));
check(ca.id,'9007199254740994');check(cb.id,'9007199254740995');
check((await as(ids.a,()=>scalar('SELECT ua_teacher_list_classes()'))).map(c=>c.id),[ca.id]);
check((await as(ids.b,()=>scalar('SELECT ua_teacher_list_classes()'))).map(c=>c.id),[cb.id]);
// Move pupil with trusted administrator operation, never via teacher body/input.
await db.query('UPDATE profiles SET class_id=$1 WHERE id=$2',[ca.id,ids.s]);
check((await as(ids.a,()=>scalar("SELECT ua_teacher_workspace_records('report')")))[0].score,90);
check(await as(ids.b,()=>scalar("SELECT ua_teacher_workspace_records('report')")),[]);
check((await as(ids.a,()=>scalar("SELECT ua_teacher_workspace_records('teacher-reflections')"))).length,1);
check(await as(ids.b,()=>scalar("SELECT ua_teacher_workspace_records('teacher-reflections')")),[]);
check((await as(ids.a,()=>scalar("SELECT ua_teacher_workspace_records('directory')"))).map(r=>r.student_id),[ids.s]);
// Stress existing over-broad permissive policies: ceilings must still isolate.
for(const t of ['profiles','classes','teacher_classes','attempts','answers','student_reflections'])await db.exec(`CREATE POLICY bad_legacy ON ${t} TO authenticated USING(true) WITH CHECK(true)`);
check((await as(ids.b,()=>db.query('SELECT * FROM attempts'))).rows,[]);
check((await as(ids.b,()=>db.query('SELECT * FROM answers'))).rows,[]);
check((await as(ids.b,()=>db.query('SELECT * FROM student_reflections'))).rows,[]);
check((await as(ids.b,()=>db.query('SELECT * FROM profiles WHERE id=$1',[ids.s]))).rows,[]);
await deny(()=>as(ids.a,()=>db.query("UPDATE profiles SET role='teacher' WHERE id=$1",[ids.a])));
await deny(()=>as(ids.a,()=>db.query('UPDATE profiles SET class_id=$1 WHERE id=$2',[cb.id,ids.a])));
await deny(()=>as(ids.a,()=>db.query('DELETE FROM profiles WHERE id=$1',[ids.a])));
await deny(()=>as(ids.b,()=>db.query('INSERT INTO teacher_classes VALUES($1,$2)',[ids.b,ca.id])));
check((await as(ids.a,()=>db.query("UPDATE attempts SET score=100 WHERE id=1 RETURNING id"))).rows,[]);
await deny(()=>as(ids.a,()=>db.query('INSERT INTO attempts(id,student_id,score) VALUES(99,$1,100)',[ids.s])));
await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_share_class($1,$2,true)',[ca.id,ids.b])));
await as(ids.a,()=>db.query('SELECT ua_teacher_share_class($1,$2,true)',[ca.id,ids.b]));
check((await as(ids.b,()=>scalar("SELECT ua_teacher_workspace_records('report')"))).length,1);
await as(ids.a,()=>db.query('SELECT ua_teacher_share_class($1,$2,false)',[ca.id,ids.b]));
check(await as(ids.b,()=>scalar("SELECT ua_teacher_workspace_records('report')")),[]);
// A rejected explicit MAX bigint insert cannot poison the transactional counter.
await deny(()=>as(ids.b,()=>db.query("INSERT INTO classes(id,name) VALUES(9223372036854775807,'Poison attempt')")));
// Legacy explicit ID inserts advance the allocator; failed RPC is atomic.
await db.exec("INSERT INTO classes(id,name) VALUES(9007199254741999,'Legacy explicit')");
const next=await as(ids.a,()=>scalar("SELECT ua_teacher_create_class('After legacy')"));check(next.id,'9007199254742000');
await deny(()=>as(ids.a,()=>db.query("SELECT ua_teacher_create_class('')")));
check(await scalar('SELECT count(*)::int FROM classes'),5);
// Undo stress policies; compare the pupil path under the ORIGINAL policies.
for(const t of ['profiles','classes','teacher_classes','attempts','answers','student_reflections'])await db.exec(`DROP POLICY bad_legacy ON ${t}`);
await db.query('UPDATE profiles SET class_id=9007199254740993 WHERE id=$1',[ids.s]);
const after=await as(ids.s,async()=>({profile:(await db.query('SELECT * FROM profiles')).rows,quiz:(await db.query('SELECT * FROM quizzes')).rows,attempt:(await db.query('SELECT * FROM attempts')).rows,answer:(await db.query('SELECT * FROM answers')).rows,reflection:(await db.query('SELECT * FROM student_reflections')).rows}));
check(after,before);
await as(ids.s,()=>db.query("INSERT INTO student_reflections(id,student_id,reflection) VALUES(2,$1,'New own reflection')",[ids.s]));
check((await as(ids.s,()=>db.query('SELECT * FROM student_reflections'))).rows.length,2);
await deny(()=>as(ids.s,()=>db.query('UPDATE profiles SET class_id=$1 WHERE id=$2',[ca.id,ids.s])));
// Existing restrictive policies cannot be bypassed by new permissive SELECT.
await db.exec('CREATE POLICY extra_denial ON attempts AS RESTRICTIVE FOR SELECT TO authenticated USING(false)');
check((await as(ids.a,()=>db.query('SELECT * FROM attempts'))).rows,[]);
await db.exec('DROP POLICY extra_denial ON attempts');
if(process.env.UA_TEST_LEARNING==='1'){const {testLearning}=await import('./learning-postgres-cases.mjs');await testLearning({db,as,scalar,check,deny,ids,ca,cb});}
await db.exec(readFileSync(new URL('../database/teacher-workspace-v2/03-rollback-review.sql',import.meta.url),'utf8'));
check(await scalar('SELECT count(*)::int FROM classes'),5);
check(await scalar("SELECT pg_get_functiondef('public.create_student_profile()'::regprocedure)"),originalTrigger);
check(await scalar("SELECT count(*)::int FROM pg_policies WHERE policyname LIKE 'ua_ws_%'"),0);
check(await scalar("SELECT has_schema_privilege('authenticated','ua_teacher_private','USAGE')"),false);
console.log(`PASS ${checks} local PostgreSQL checks. No live Supabase migration executed.`);
await db.close();
