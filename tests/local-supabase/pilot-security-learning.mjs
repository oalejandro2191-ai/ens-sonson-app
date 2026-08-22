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
  const { data, error }=await service.auth.admin.listUsers({page:1,perPage:100});
  if(error) throw error;
  for (const u of data.users) if (emails.includes(u.email)) ids[u.email]=u.id;
}
assert.equal(Object.keys(ids).length,7);

const school='11111111-1111-1111-1111-111111111111';
const otherSchool='11111111-1111-1111-1111-111111111112';
const group='66666666-6666-6666-6666-666666666661';
const otherGroup='66666666-6666-6666-6666-666666666662';
const year='22222222-2222-2222-2222-222222222221';
const lesson='44444444-4444-4444-4444-444444444444';
const wordBe='55555555-5555-5555-5555-555555555551';
const wordHello='55555555-5555-5555-5555-555555555552';

const profiles=[
  {id:ids['admin@ens.local'],school_id:school,role:'teacher',display_alias:'Admin Pilot'},
  {id:ids['teacher@ens.local'],school_id:school,role:'teacher',display_alias:'Teacher Pilot'},
  ...['student1','student2','student3','student4'].map((n,i)=>({id:ids[`${n}@ens.local`],school_id:school,role:'student',display_alias:`Student ${i+1}`})),
  {id:ids['student5@ens.local'],school_id:otherSchool,role:'student',display_alias:'Outside Student'}
];
let z=await service.from('profiles').upsert(profiles);
if(z.error) throw z.error;

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

async function login(email){
  const c=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await c.auth.signInWithPassword({email,password});
  if(error) throw error;
  return c;
}

const admin=await login('admin@ens.local');
const teacher=await login('teacher@ens.local');
const student1=await login('student1@ens.local');
const student2=await login('student2@ens.local');
const student3=await login('student3@ens.local');
const student4=await login('student4@ens.local');
const outsider=await login('student5@ens.local');

let r=await student1.rpc('get_my_auth_context');
assert.ifError(r.error);
assert.equal(r.data.role,'student');
r=await student1.rpc('get_my_portal_identity_v1');
assert.ifError(r.error);
assert.equal(r.data.institution_role,'student');
r=await student1.rpc('get_my_learning_dashboard_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data.group.name,'8A PILOT');
r=await student1.rpc('get_my_route_progress_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data.lessons.length,1);

r=await student1.from('profiles').select('id');
assert.ifError(r.error);
assert.deepEqual(r.data.map(x=>x.id),[ids['student1@ens.local']]);
r=await teacher.from('profiles').select('id');
assert.ifError(r.error);
assert(r.data.some(x=>x.id===ids['student1@ens.local']));
assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r=await admin.from('profiles').select('id');
assert.ifError(r.error);
assert(r.data.some(x=>x.id===ids['teacher@ens.local']));
assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r=await outsider.from('profiles').select('id');
assert.ifError(r.error);
assert.deepEqual(r.data.map(x=>x.id),[ids['student5@ens.local']]);

r=await student1.from('student_stats').insert({student_id:ids['student1@ens.local'],total_xp:999999,coins:999999});
assert(r.error);
r=await student1.from('student_word_progress').insert({student_id:ids['student1@ens.local'],word_id:wordBe,mastery_state:'mastered'});
assert(r.error);
r=await student1.schema('private').from('practice_session_receipts').select('*');
assert(r.error);
r=await teacher.rpc('start_route_lesson_session_v1',{target_route_code:'A1-V3',target_lesson_id:lesson,provided_client_session_id:'teacher_blocked_01',provided_client_context:{}});
assert(r.error);

const words=[
  {id:wordBe,en:'be',es:'ser o estar'},
  {id:wordHello,en:'hello',es:'hola'}
];
const activities=['association','listening','writing','recall'];
let serial=0;

function expectedAnswer(word, activity){
  return activity==='association' ? word.es : word.en;
}

async function cycle(client,label,wrongCounts={}) {
  serial++;
  const tag=`${label}_${String(serial).padStart(2,'0')}`.replace(/[^A-Za-z0-9:_-]/g,'_');
  const started=await client.rpc('start_route_lesson_session_v1',{
    target_route_code:'A1-V3',
    target_lesson_id:lesson,
    provided_client_session_id:tag,
    provided_client_context:{test:true}
  });
  assert.ifError(started.error);
  const sid=started.data.session_id;
  let replay;
  for(const word of words){
    const wrongLimit=wrongCounts[word.id] ?? 0;
    for(let i=0;i<activities.length;i++){
      const activity=activities[i];
      const answer=i<wrongLimit ? `wrong_${i}` : expectedAnswer(word,activity);
      const eid=`${tag}_${word.id.slice(-4)}_${activity}`;
      const result=await client.rpc('record_route_lesson_attempt_v1',{
        target_session_id:sid,
        target_word_id:word.id,
        target_activity_type:activity,
        provided_answer:answer,
        provided_response_time_ms:1200,
        provided_client_event_id:eid,
        provided_attempt_number:1
      });
      assert.ifError(result.error);
      replay ??={word,activity,answer,eid,id:result.data.attempt_id};
    }
  }
  const duplicate=await client.rpc('record_route_lesson_attempt_v1',{
    target_session_id:sid,
    target_word_id:replay.word.id,
    target_activity_type:replay.activity,
    provided_answer:replay.answer,
    provided_response_time_ms:1200,
    provided_client_event_id:replay.eid,
    provided_attempt_number:1
  });
  assert.ifError(duplicate.error);
  assert.equal(duplicate.data.idempotent_replay,true);
  assert.equal(duplicate.data.attempt_id,replay.id);

  const done=await client.rpc('complete_route_lesson_session_v1',{target_session_id:sid});
  assert.ifError(done.error);
  const replayDone=await client.rpc('complete_route_lesson_session_v1',{target_session_id:sid});
  assert.ifError(replayDone.error);
  assert.equal(replayDone.data.idempotent_replay,true);
  return {sid,result:done.data};
}

async function wordProgress(client,wordId){
  const q=await client.from('student_word_progress')
    .select('word_id,mastery_state,correct_streak,interval_days,next_review_at,total_attempts,correct_attempts')
    .eq('word_id',wordId)
    .single();
  assert.ifError(q.error);
  return q.data;
}

// Scenario 1: 4/4 correct -> pass, streak increments, interval is scheduled.
const perfect=await cycle(student1,'student1_perfect');
const perfectProgress=await wordProgress(student1,wordBe);
assert.equal(perfectProgress.correct_streak,1);
assert.equal(perfectProgress.interval_days,1);
assert(new Date(perfectProgress.next_review_at).getTime()>Date.now());

// Scenario 2: 3/4 correct -> still passes and must be spaced.
const threeOfFour=await cycle(student2,'student2_three',{[wordBe]:1});
assert.equal(threeOfFour.result.percentage,87.5);
const threeProgress=await wordProgress(student2,wordBe);
assert.equal(threeProgress.correct_streak,1);
assert.equal(threeProgress.interval_days,1);
assert(new Date(threeProgress.next_review_at).getTime()>Date.now());

// An immediate replay is allowed as practice but is not mastery/reward eligible.
const beforeEarly=await wordProgress(student2,wordBe);
const early=await cycle(student2,'student2_early',{[wordBe]:1});
assert.equal(early.result.xp,0);
assert.equal(early.result.coins,0);
const afterEarly=await wordProgress(student2,wordBe);
assert.deepEqual(afterEarly,beforeEarly);

// Scenario 3: 2/4 correct -> fail; streak does not increase and no mastery.
await cycle(student3,'student3_two',{[wordBe]:2});
const twoProgress=await wordProgress(student3,wordBe);
assert.equal(twoProgress.correct_streak,0);
assert.equal(twoProgress.interval_days,0);
assert.equal(twoProgress.mastery_state,'learning');

// Cross-user session attack is rejected.
r=await student2.rpc('record_route_lesson_attempt_v1',{
  target_session_id:perfect.sid,
  target_word_id:wordBe,
  target_activity_type:'recall',
  provided_answer:'be',
  provided_response_time_ms:1000,
  provided_client_event_id:'cross_user_attack_01',
  provided_attempt_number:1
});
assert(r.error);

// Scenario 5: five due cycles -> mastered with interval >=21 days.
for(let i=1;i<=5;i++){
  if(i>1){
    const t=await service.from('student_word_progress')
      .update({next_review_at:new Date(Date.now()-60000).toISOString()})
      .eq('student_id',ids['student4@ens.local']);
    if(t.error) throw t.error;
  }
  await cycle(student4,`student4_cycle_${i}`);
}
r=await student4.from('student_word_progress').select('mastery_state,correct_streak,interval_days');
assert.ifError(r.error);
assert(r.data.every(x=>x.mastery_state==='mastered'&&x.correct_streak===5&&x.interval_days>=21));

// Scenario 6: a valid later failure degrades the current policy.
z=await service.from('student_word_progress')
  .update({next_review_at:new Date(Date.now()-60000).toISOString()})
  .eq('student_id',ids['student4@ens.local']);
if(z.error) throw z.error;
await cycle(student4,'student4_valid_failure',{[wordBe]:4,[wordHello]:4});
r=await student4.from('student_word_progress').select('mastery_state,correct_streak,interval_days');
assert.ifError(r.error);
assert(r.data.every(x=>x.mastery_state==='learning'&&x.correct_streak===0&&x.interval_days===0));

// Second authenticated client sees persisted server state.
const secondDevice=await login('student4@ens.local');
r=await secondDevice.from('student_word_progress').select('word_id,mastery_state');
assert.ifError(r.error);
assert.equal(r.data.length,2);

// Teacher can read assigned-group progress; outsider cannot cross institution boundary.
r=await teacher.from('student_word_progress').select('word_id').eq('student_id',ids['student4@ens.local']);
assert.ifError(r.error);
assert.equal(r.data.length,2);
r=await outsider.from('student_word_progress').select('word_id').eq('student_id',ids['student4@ens.local']);
assert.ifError(r.error);
assert.equal(r.data.length,0);

// Completion replay created only one reward event for the first session.
const rc=await service.from('reward_events').select('*',{count:'exact',head:true})
  .eq('student_id',ids['student1@ens.local'])
  .eq('source_id',perfect.sid);
if(rc.error) throw rc.error;
assert.equal(rc.count,1);

console.log(JSON.stringify({
  ok:true,
  fake_accounts:emails,
  auth:'PASS',
  identity_rpc:'PASS',
  dashboard_rpc:'PASS',
  route_progress_rpc:'PASS',
  rls:'PASS',
  direct_academic_writes_denied:'PASS',
  private_schema_hidden:'PASS',
  teacher_scope:'PASS',
  cross_school_isolation:'PASS',
  rpc_server_validation:'PASS',
  attempt_idempotency:'PASS',
  completion_idempotency:'PASS',
  perfect_4_of_4_spaced:'PASS',
  valid_3_of_4_spaced:'PASS',
  failed_2_of_4_not_advanced:'PASS',
  early_review_antifarming:'PASS',
  multidevice_persistence:'PASS',
  mastery_5_cycles_21_days:'PASS',
  valid_failure_degrades:'PASS'
},null,2));
