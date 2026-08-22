import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL:url, SUPABASE_ANON_KEY:anonKey, SUPABASE_SERVICE_ROLE_KEY:serviceKey } = process.env;
assert(url && anonKey && serviceKey);
const service = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
const password='LocalPilot!2026';
const emails=['admin@ens.local','teacher@ens.local','student1@ens.local','student2@ens.local','student3@ens.local','student4@ens.local','student5@ens.local'];
const ids={};
for (const email of emails) {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm:true });
  if (error && !/already/i.test(error.message)) throw error;
  if (data?.user?.id) ids[email]=data.user.id;
}
if (Object.keys(ids).length!==emails.length) {
  const { data, error }=await service.auth.admin.listUsers({page:1,perPage:100}); if(error) throw error;
  for (const u of data.users) if (emails.includes(u.email)) ids[u.email]=u.id;
}
assert.equal(Object.keys(ids).length,7);

const school='11111111-1111-1111-1111-111111111111', otherSchool='11111111-1111-1111-1111-111111111112';
const group='66666666-6666-6666-6666-666666666661', otherGroup='66666666-6666-6666-6666-666666666662';
const year='22222222-2222-2222-2222-222222222221', lesson='44444444-4444-4444-4444-444444444444';
const wordBe='55555555-5555-5555-5555-555555555551', wordHello='55555555-5555-5555-5555-555555555552';
const profiles=[
  {id:ids['admin@ens.local'],school_id:school,role:'teacher',display_alias:'Admin Pilot'},
  {id:ids['teacher@ens.local'],school_id:school,role:'teacher',display_alias:'Teacher Pilot'},
  ...['student1','student2','student3','student4'].map((n,i)=>({id:ids[`${n}@ens.local`],school_id:school,role:'student',display_alias:`Student ${i+1}`})),
  {id:ids['student5@ens.local'],school_id:otherSchool,role:'student',display_alias:'Outside Student'}
];
let z=await service.from('profiles').upsert(profiles); if(z.error) throw z.error;

async function configureMembership(userId, schoolId, role, groupId=null, academicYearId=null) {
  const { error } = await service.rpc('local_test_configure_membership', {
    target_user_id:userId,
    target_school_id:schoolId,
    target_role:role,
    target_group_id:groupId,
    target_academic_year_id:academicYearId
  });
  if (error) throw error;
}
await configureMembership(ids['admin@ens.local'],school,'institution_admin');
await configureMembership(ids['teacher@ens.local'],school,'teacher',group,year);
for (const n of ['student1','student2','student3','student4']) await configureMembership(ids[`${n}@ens.local`],school,'student',group);
await configureMembership(ids['student5@ens.local'],otherSchool,'student',otherGroup);

async function login(email){ const c=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}}); const {error}=await c.auth.signInWithPassword({email,password}); if(error) throw error; return c; }
const admin=await login('admin@ens.local'), teacher=await login('teacher@ens.local'), student=await login('student1@ens.local'), student2=await login('student2@ens.local'), outsider=await login('student5@ens.local');

let r=await student.rpc('get_my_auth_context'); assert.ifError(r.error); assert.equal(r.data.role,'student');
r=await student.from('profiles').select('id'); assert.ifError(r.error); assert.deepEqual(r.data.map(x=>x.id),[ids['student1@ens.local']]);
r=await teacher.from('profiles').select('id'); assert.ifError(r.error); assert(r.data.some(x=>x.id===ids['student1@ens.local'])); assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r=await admin.from('profiles').select('id'); assert.ifError(r.error); assert(r.data.some(x=>x.id===ids['teacher@ens.local'])); assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r=await outsider.from('profiles').select('id'); assert.ifError(r.error); assert.deepEqual(r.data.map(x=>x.id),[ids['student5@ens.local']]);

r=await student.from('student_stats').insert({student_id:ids['student1@ens.local'],total_xp:999999,coins:999999}); assert(r.error);
r=await student.from('student_word_progress').insert({student_id:ids['student1@ens.local'],word_id:wordBe,mastery_state:'mastered'}); assert(r.error);
r=await student.schema('private').from('practice_session_receipts').select('*'); assert(r.error);
r=await teacher.rpc('start_route_lesson_session_v1',{target_route_code:'A1-V3',target_lesson_id:lesson,provided_client_session_id:'teacher_blocked_01',provided_client_context:{}}); assert(r.error);

const words=[{id:wordBe,en:'be',es:'ser o estar'},{id:wordHello,en:'hello',es:'hola'}], acts=['association','listening','writing','recall'];
let serial=0;
async function cycle({wrongAll=false,firstAssociationWrong=false}={}){
  serial++; const tag=`student1_cycle_${String(serial).padStart(2,'0')}`;
  let x=await student.rpc('start_route_lesson_session_v1',{target_route_code:'A1-V3',target_lesson_id:lesson,provided_client_session_id:tag,provided_client_context:{test:true}}); assert.ifError(x.error); const sid=x.data.session_id;
  let replay;
  for(const w of words) for(const a of acts){ let answer=a==='association'?w.es:w.en; if(wrongAll||(firstAssociationWrong&&w.id===wordBe&&a==='association')) answer='wrong'; const eid=`${tag}_${w.id.slice(-4)}_${a}`; const y=await student.rpc('record_route_lesson_attempt_v1',{target_session_id:sid,target_word_id:w.id,target_activity_type:a,provided_answer:answer,provided_response_time_ms:1200,provided_client_event_id:eid,provided_attempt_number:1}); assert.ifError(y.error); replay??={w,a,answer,eid,id:y.data.attempt_id}; }
  const dup=await student.rpc('record_route_lesson_attempt_v1',{target_session_id:sid,target_word_id:replay.w.id,target_activity_type:replay.a,provided_answer:replay.answer,provided_response_time_ms:1200,provided_client_event_id:replay.eid,provided_attempt_number:1}); assert.ifError(dup.error); assert.equal(dup.data.idempotent_replay,true); assert.equal(dup.data.attempt_id,replay.id);
  const done=await student.rpc('complete_route_lesson_session_v1',{target_session_id:sid}); assert.ifError(done.error); const replayDone=await student.rpc('complete_route_lesson_session_v1',{target_session_id:sid}); assert.ifError(replayDone.error); assert.equal(replayDone.data.idempotent_replay,true); return {sid,result:done.data};
}

const c1=await cycle({firstAssociationWrong:true}); assert.equal(c1.result.percentage,87.5);
r=await student.from('student_word_progress').select('word_id,mastery_state,correct_streak,interval_days').order('word_id'); assert.ifError(r.error); assert(r.data.every(x=>x.correct_streak===1&&x.mastery_state==='learning'&&x.interval_days===1));
const secondDevice=await login('student1@ens.local'); r=await secondDevice.from('student_word_progress').select('word_id'); assert.ifError(r.error); assert.equal(r.data.length,2);
r=await student2.rpc('record_route_lesson_attempt_v1',{target_session_id:c1.sid,target_word_id:wordBe,target_activity_type:'recall',provided_answer:'be',provided_response_time_ms:1000,provided_client_event_id:'cross_user_attack_01',provided_attempt_number:1}); assert(r.error);

const before=await student.from('student_word_progress').select('word_id,correct_streak,interval_days').order('word_id'); assert.ifError(before.error); const early=await cycle(); assert.equal(early.result.xp,0); assert.equal(early.result.coins,0); const after=await student.from('student_word_progress').select('word_id,correct_streak,interval_days').order('word_id'); assert.ifError(after.error); assert.deepEqual(after.data,before.data);
for(let i=2;i<=5;i++){ const t=await service.from('student_word_progress').update({next_review_at:new Date(Date.now()-60000).toISOString()}).eq('student_id',ids['student1@ens.local']); if(t.error) throw t.error; await cycle(); }
r=await student.from('student_word_progress').select('mastery_state,correct_streak,interval_days'); assert.ifError(r.error); assert(r.data.every(x=>x.mastery_state==='mastered'&&x.correct_streak===5&&x.interval_days>=21));
r=await teacher.from('student_word_progress').select('word_id').eq('student_id',ids['student1@ens.local']); assert.ifError(r.error); assert.equal(r.data.length,2);
r=await outsider.from('student_word_progress').select('word_id').eq('student_id',ids['student1@ens.local']); assert.ifError(r.error); assert.equal(r.data.length,0);
z=await service.from('student_word_progress').update({next_review_at:new Date(Date.now()-60000).toISOString()}).eq('student_id',ids['student1@ens.local']); if(z.error) throw z.error; await cycle({wrongAll:true});
r=await student.from('student_word_progress').select('mastery_state,correct_streak,interval_days'); assert.ifError(r.error); assert(r.data.every(x=>x.mastery_state==='learning'&&x.correct_streak===0&&x.interval_days===0));
const rc=await service.from('reward_events').select('*',{count:'exact',head:true}).eq('student_id',ids['student1@ens.local']).eq('source_id',c1.sid); if(rc.error) throw rc.error; assert.equal(rc.count,1);

console.log(JSON.stringify({ok:true,fake_accounts:emails,auth:'PASS',rls:'PASS',direct_academic_writes_denied:'PASS',private_schema_hidden:'PASS',teacher_scope:'PASS',cross_school_isolation:'PASS',rpc_server_validation:'PASS',attempt_idempotency:'PASS',completion_idempotency:'PASS',early_review_antifarming:'PASS',multidevice_persistence:'PASS',mastery_5_cycles_21_days:'PASS',valid_failure_degrades:'PASS'},null,2));
