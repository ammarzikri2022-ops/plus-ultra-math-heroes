import {readFileSync} from 'node:fs';
export async function testLearning({db,as,scalar,check,deny,ids,ca,cb}){
 await db.exec(readFileSync(new URL('../database/learning-activation/03-learning-and-classes-review.sql',import.meta.url),'utf8'));
 await as(ids.s,()=>db.query("SELECT ua_complete_profile('Murid Fixture','bakugo')"));
 check((await as(ids.s,()=>scalar('SELECT ua_account_preferences()'))).avatar,'bakugo');
 await as(ids.a,()=>db.query('SELECT ua_teacher_rename_class($1,$2)',[ca.id,'5 Amanah Baharu']));
 await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_rename_class($1,$2)',[ca.id,'Stolen class'])));
 await deny(()=>as(ids.s,()=>db.query('SELECT ua_teacher_create_invite($1)',[ca.id])));
 await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_create_invite($1)',[ca.id])));
 const inviteA=await as(ids.a,()=>scalar('SELECT ua_teacher_create_invite($1)',[ca.id]));
 check(inviteA.code.length,64);
 check((await as(ids.a,()=>scalar('SELECT ua_teacher_invites($1)',[ca.id])))[0].code_hash,undefined);
 await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_invites($1)',[ca.id])));
 await db.query('UPDATE profiles SET class_id=NULL WHERE id=$1',[ids.s]); // trusted fixture setup only.
 check((await as(ids.s,()=>scalar('SELECT ua_student_join_class($1)',[inviteA.code]))).class_id,ca.id);
 await as(ids.s,()=>db.query('SELECT ua_student_join_class($1)',[inviteA.code]));
 check((await as(ids.a,()=>scalar('SELECT ua_teacher_invites($1)',[ca.id])))[0].uses,1);
 check((await as(ids.a,()=>scalar('SELECT ua_teacher_class_roster($1)',[ca.id]))).map(s=>s.student_id),[ids.s]);
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('directory')"))).map(s=>s.student_id),[ids.s]);
 check(await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('directory')")),[]);
 await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_class_roster($1)',[ca.id])));
 const key=[1,1,1,1,2,2,1,1,1,2],v='tokoyami-5.1.1-v1',rid='10000000-0000-4000-8000-000000000001';
 const submit=(sid,answers=key)=>as(ids.s,()=>scalar('SELECT ua_submit_quiz($1,$2::jsonb,$3)',[sid,JSON.stringify(answers),v]));
 const saved=await submit(rid);check(saved.score,10);check(saved.class_id,ca.id);
 check(await submit(rid),saved);
 check(await scalar('SELECT count(*)::int FROM ua_teacher_private.quiz_results'),1);
 await deny(()=>submit(rid,Array(10).fill(0)));
 await deny(()=>submit('10000000-0000-4000-8000-000000000009',[true,1,1,1,2,2,1,1,1,2]));
 await deny(()=>submit('10000000-0000-4000-8000-000000000009',[1,1]));
 await deny(()=>as(ids.a,()=>db.query('SELECT ua_submit_quiz($1,$2::jsonb,$3)',[rid,JSON.stringify(key),v])));
 await deny(()=>as(null,()=>db.query('SELECT ua_student_results()'),'anon'));
 await deny(()=>as(ids.s,()=>db.query('SELECT * FROM ua_teacher_private.quiz_keys')));
 await deny(()=>as(ids.s,()=>db.query('UPDATE ua_teacher_private.quiz_results SET score=10')));
 check((await as(ids.s,()=>scalar('SELECT ua_student_results()')))[0].score,10);
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('report')"))).map(r=>r.score),[10]);
 check(await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('report')")),[]);
 await as(ids.s,()=>db.query("SELECT ua_save_learning_reflection('yakin','cm-mm',4,'Saya faham',false)"));
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('teacher-reflections')"))).length,1);
 check(await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('teacher-reflections')")),[]);
 check((await as(ids.s,()=>scalar('SELECT ua_my_learning_reflections()'))).length,3); // two original + one new.
 await deny(()=>as(ids.b,()=>db.query('SELECT ua_teacher_remove_student($1,$2)',[ca.id,ids.s])));
 await as(ids.a,()=>db.query('SELECT ua_teacher_remove_student($1,$2)',[ca.id,ids.s]));
 const inviteB=await as(ids.b,()=>scalar('SELECT ua_teacher_create_invite($1)',[cb.id]));
 await as(ids.s,()=>db.query('SELECT ua_student_join_class($1)',[inviteB.code]));
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('report')"))).map(r=>r.score),[10]);
 check(await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('report')")),[]); // new teacher cannot read old class history.
 check(await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('teacher-reflections')")),[]);
 check((await submit('10000000-0000-4000-8000-000000000002',Array(10).fill(0))).score,0);
 check((await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('report')"))).map(r=>r.score),[0]);
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('report')"))).map(r=>r.score),[10]);
 check((await as(ids.s,()=>scalar('SELECT ua_student_results()'))).length,2);
 await deny(()=>as(ids.s,()=>db.query('SELECT ua_student_join_class($1)',[inviteA.code]))); // no self-transfer.
 await as(ids.b,()=>db.query('SELECT ua_teacher_revoke_invite($1,$2)',[cb.id,inviteB.id]));
 await deny(()=>as(ids.s,()=>db.query('SELECT ua_student_join_class($1)',[inviteB.code])));
 check(await scalar('SELECT count(*)::int FROM public.attempts'),1); // legacy records untouched.
 check(await scalar('SELECT count(*)::int FROM public.answers'),1);
 // Three-stage extension: local PostgreSQL only; no production SQL.
 await db.exec(readFileSync(new URL('../database/learning-activation/05-quiz-levels-review.sql',import.meta.url),'utf8'));
 const medium='tokoyami-5.1.1-medium-v1', hard='tokoyami-5.1.1-hard-v1',mk=[0,2,1,3,0,2,1,3,0,2],hk=[1,3,0,2,1,3,0,2,1,3];
 let sequence=30;
 const levelSubmit=(version,answers)=>as(ids.s,()=>scalar('SELECT ua_submit_quiz($1,$2::jsonb,$3)',[`10000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,JSON.stringify(answers),version]));
 const scoreN=(key,n)=>key.map((a,i)=>i<n?a:(a+1)%4);
 // Remove fixture Easy pass temporarily as trusted admin; restore it after boundary checks.
 await db.query('UPDATE ua_teacher_private.quiz_results SET score=5 WHERE id=$1',[rid]);
 await deny(()=>levelSubmit(medium,mk));await deny(()=>levelSubmit(hard,hk));
 await db.query('UPDATE ua_teacher_private.quiz_results SET score=10 WHERE id=$1',[rid]);
 check((await levelSubmit(medium,scoreN(mk,5))).score,5);
 await deny(()=>levelSubmit(hard,hk));
 check((await levelSubmit(medium,scoreN(mk,6))).score,6);
 check((await levelSubmit(hard,hk)).score,10);
 await deny(()=>as(ids.a,()=>db.query('SELECT ua_submit_quiz($1,$2::jsonb,$3)',['10000000-0000-4000-8000-000000000099',JSON.stringify(hk),hard])));
 await deny(()=>as(ids.s,()=>db.query('SELECT * FROM ua_teacher_private.quiz_keys')));
 check((await as(ids.a,()=>scalar("SELECT ua_teacher_learning_records('report')"))).map(r=>r.score),[10]);
 check((await as(ids.b,()=>scalar("SELECT ua_teacher_learning_records('report')"))).length,4);
 await db.exec(readFileSync(new URL('../database/learning-activation/06-rollback-quiz-levels-review.sql',import.meta.url),'utf8'));
 check(await scalar('SELECT count(*)::int FROM ua_teacher_private.quiz_results'),5);
 await db.exec(readFileSync(new URL('../database/learning-activation/04-rollback-learning-review.sql',import.meta.url),'utf8'));
 check(await scalar('SELECT count(*)::int FROM ua_teacher_private.quiz_results'),5); // records archived, not deleted.
 await deny(()=>as(ids.s,()=>db.query('SELECT ua_student_results()')));
}
