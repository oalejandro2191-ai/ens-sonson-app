import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, 'Local Supabase environment variables are required');

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = 'LocalPilot!2026';
const accounts = [
  ['admin@ens.local','Admin Pilot'],
  ['teacher@ens.local','Teacher Pilot'],
  ['student1@ens.local','Student One'],
  ['student2@ens.local','Student Two'],
  ['student3@ens.local','Student Three'],
  ['student4@ens.local','Student Four'],
  ['student5@ens.local','Outside Student'],
];

const ids = {};
for (const [email, label] of accounts) {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { label } });
  if (error && !/already/i.test(error.message)) throw error;
  if (data?.user?.id) ids[email] = data.user.id;
}
if (Object.keys(ids).length !== accounts.length) {
  const { data: listed, error } = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  for (const u of listed.users) if (accounts.some(([e]) => e === u.email)) ids[u.email] = u.id;
}
assert.equal(Object.keys(ids).length, 7);

const school = '11111111-1111-1111-1111-111111111111';
const otherSchool = '11111111-1111-1111-1111-111111111112';
const group = '66666666-6666-6666-6666-666666666661';
const otherGroup = '66666666-6666-6666-6666-666666666662';
const year = '22222222-2222-2222-2222-222222222221';
const lesson = '44444444-4444-4444-4444-444444444444';
const wordBe = '55555555-5555-5555-5555-555555555551';
const wordHello = '55555555-5555-5555-5555-555555555552';

const profiles = [
  { id: ids['admin@ens.local'], school_id: school, role: 'teacher', display_alias: 'Admin Pilot' },
  { id: ids['teacher@ens.local'], school_id: school, role: 'teacher', display_alias: 'Teacher Pilot' },
  ...['student1','student2','student3','student4'].map((n, i) => ({ id: ids[`${n}@ens.local`], school_id: school, role: 'student', display_alias: `Student ${i+1}` })),
  { id: ids['student5@ens.local'], school_id: otherSchool, role: 'student', display_alias: 'Outside Student' },
];
let q = await service.from('profiles').upsert(profiles); if (q.error) throw q.error;
const memberships = [
  { school_id: school, user_id: ids['admin@ens.local'], role: 'institution_admin', status: 'active' },
  { school_id: school, user_id: ids['teacher@ens.local'], role: 'teacher', status: 'active' },
  ...['student1','student2','student3','student4'].map(n => ({ school_id: school, user_id: ids[`${n}@ens.local`], role: 'student', status: 'active' })),
  { school_id: otherSchool, user_id: ids['student5@ens.local'], role: 'student', status: 'active' },
];
q = await service.schema('private').from('institution_memberships').upsert(memberships, { onConflict: 'school_id,user_id,role' }); if (q.error) throw q.error;
q = await service.from('group_members').upsert(['student1','student2','student3','student4'].map(n => ({ group_id: group, student_id: ids[`${n}@ens.local`], status: 'active' })), { onConflict: 'group_id,student_id' }); if (q.error) throw q.error;
q = await service.from('group_members').upsert({ group_id: otherGroup, student_id: ids['student5@ens.local'], status: 'active' }, { onConflict: 'group_id,student_id' }); if (q.error) throw q.error;
const { data: teacherMembership, error: tmErr } = await service.schema('private').from('institution_memberships').select('id').eq('user_id', ids['teacher@ens.local']).eq('role','teacher').single(); if (tmErr) throw tmErr;
q = await service.schema('private').from('teacher_assignments').upsert({ membership_id: teacherMembership.id, group_id: group, academic_year_id: year, status: 'active' }, { onConflict: 'membership_id,group_id,academic_year_id' }); if (q.error) throw q.error;

async function login(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}
const admin = await login('admin@ens.local');
const teacher = await login('teacher@ens.local');
const student = await login('student1@ens.local');
const student2 = await login('student2@ens.local');
const outsider = await login('student5@ens.local');

// Auth + institutional context.
let r = await student.rpc('get_my_auth_context'); assert.ifError(r.error); assert.equal(r.data.role, 'student'); assert.equal(r.data.school_id, school);

// RLS profile visibility.
r = await student.from('profiles').select('id'); assert.ifError(r.error); assert.deepEqual(r.data.map(x=>x.id), [ids['student1@ens.local']]);
r = await teacher.from('profiles').select('id'); assert.ifError(r.error); assert(r.data.some(x=>x.id===ids['student1@ens.local'])); assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r = await admin.from('profiles').select('id'); assert.ifError(r.error); assert(r.data.some(x=>x.id===ids['teacher@ens.local'])); assert(!r.data.some(x=>x.id===ids['student5@ens.local']));
r = await outsider.from('profiles').select('id'); assert.ifError(r.error); assert.deepEqual(r.data.map(x=>x.id), [ids['student5@ens.local']]);

// Browser roles cannot author academic truth directly.
r = await student.from('student_stats').insert({ student_id: ids['student1@ens.local'], total_xp: 999999, coins: 999999 }); assert(r.error, 'student_stats direct insert must be denied');
r = await student.from('student_word_progress').insert({ student_id: ids['student1@ens.local'], word_id: wordBe, mastery_state: 'mastered' }); assert(r.error, 'mastery direct insert must be denied');
r = await student.schema('private').from('practice_session_receipts').select('*'); assert(r.error, 'private schema must not be browser-exposed');

// Teacher cannot start a student learning session.
r = await teacher.rpc('start_route_lesson_session_v1', { target_route_code:'A1-V3', target_lesson_id:lesson, provided_client_session_id:'teacher_blocked_01', provided_client_context:{} }); assert(r.error);

const words = [
  { id: wordBe, english:'be', spanish:'ser o estar' },
  { id: wordHello, english:'hello', spanish:'hola' },
];
const activities = ['association','listening','writing','recall'];
let serial = 0;
async function runCycle(client, { wrongAll=false, firstAssociationWrong=false }={}) {
  serial++;
  const sid = `student1_cycle_${String(serial).padStart(2,'0')}`;
  let x = await client.rpc('start_route_lesson_session_v1', { target_route_code:'A1-V3', target_lesson_id:lesson, provided_client_session_id:sid, provided_client_context:{ test:true } }); assert.ifError(x.error);
  const sessionId = x.data.session_id;
  let replayEvent = null;
  for (const w of words) for (const a of activities) {
    const event = `${sid}_${w.id.slice(-4)}_${a}`;
    let answer = a === 'association' ? w.spanish : w.english;
    if (wrongAll || (firstAssociationWrong && w.id===wordBe && a==='association')) answer='definitely-wrong';
    const attempt = await client.rpc('record_route_lesson_attempt_v1', { target_session_id:sessionId, target_word_id:w.id, target_activity_type:a, provided_answer:answer, provided_response_time_ms:1200, provided_client_event_id:event, provided_attempt_number:1 }); assert.ifError(attempt.error);
    if (!replayEvent) { replayEvent={ sessionId,w,a,answer,event,attemptId:attempt.data.attempt_id }; }
  }
  const dup = await client.rpc('record_route_lesson_attempt_v1', { target_session_id:replayEvent.sessionId, target_word_id:replayEvent.w.id, target_activity_type:replayEvent.a, provided_answer:replayEvent.answer, provided_response_time_ms:1200, provided_client_event_id:replayEvent.event, provided_attempt_number:1 }); assert.ifError(dup.error); assert.equal(dup.data.idempotent_replay,true); assert.equal(dup.data.attempt_id,replayEvent.attemptId);
  const done = await client.rpc('complete_route_lesson_session_v1', { target_session_id:sessionId }); assert.ifError(done.error);
  const doneAgain = await client.rpc('complete_route_lesson_session_v1', { target_session_id:sessionId }); assert.ifError(doneAgain.error); assert.equal(doneAgain.data.idempotent_replay,true);
  return { sessionId, result:done.data };
}

// Cycle 1: 3/4 on BE is exactly 75% => valid per-word review.
const cycle1 = await runCycle(student, { firstAssociationWrong:true }); assert.equal(cycle1.result.percentage, 87.5);
r = await student.from('student_word_progress').select('word_id,mastery_state,correct_streak,interval_days').order('word_id'); assert.ifError(r.error); assert.equal(r.data.length,2); assert(r.data.every(x=>x.correct_streak===1 && x.mastery_state==='learning' && x.interval_days===1));

// Second device/session sees the same server progress.
const secondDevice = await login('student1@ens.local');
r = await secondDevice.from('student_word_progress').select('word_id,correct_streak'); assert.ifError(r.error); assert.equal(r.data.length,2);

// Cross-user session ownership is enforced.
r = await student2.rpc('record_route_lesson_attempt_v1', { target_session_id:cycle1.sessionId, target_word_id:wordBe, target_activity_type:'recall', provided_answer:'be', provided_response_time_ms:1000, provided_client_event_id:'cross_user_attack_01', provided_attempt_number:1 }); assert(r.error);

// Early review: answers can be stored, but they must not advance mastery or award competitive XP.
const beforeEarly = await student.from('student_word_progress').select('word_id,correct_streak,interval_days').order('word_id'); assert.ifError(beforeEarly.error);
const early = await runCycle(student); assert.equal(early.result.xp,0); assert.equal(early.result.coins,0);
const afterEarly = await student.from('student_word_progress').select('word_id,correct_streak,interval_days').order('word_id'); assert.ifError(afterEarly.error); assert.deepEqual(afterEarly.data,beforeEarly.data);

// Time travel only through service role in test harness, never through student client.
for (let cycle=2; cycle<=5; cycle++) {
  const t = await service.from('student_word_progress').update({ next_review_at:new Date(Date.now()-60_000).toISOString() }).eq('student_id',ids['student1@ens.local']); if (t.error) throw t.error;
  await runCycle(student);
}
r = await student.from('student_word_progress').select('word_id,mastery_state,correct_streak,interval_days'); assert.ifError(r.error); assert.equal(r.data.length,2); assert(r.data.every(x=>x.mastery_state==='mastered' && x.correct_streak===5 && x.interval_days>=21));

// Teacher can read assigned student's progress, another-school student cannot.
r = await teacher.from('student_word_progress').select('student_id,word_id').eq('student_id',ids['student1@ens.local']); assert.ifError(r.error); assert.equal(r.data.length,2);
r = await outsider.from('student_word_progress').select('student_id,word_id').eq('student_id',ids['student1@ens.local']); assert.ifError(r.error); assert.equal(r.data.length,0);

// A valid failed review degrades mastered -> learning. Technical/skip paths are not used to degrade.
q = await service.from('student_word_progress').update({ next_review_at:new Date(Date.now()-60_000).toISOString() }).eq('student_id',ids['student1@ens.local']); if (q.error) throw q.error;
await runCycle(student,{wrongAll:true});
r = await student.from('student_word_progress').select('mastery_state,correct_streak,interval_days'); assert.ifError(r.error); assert(r.data.every(x=>x.mastery_state==='learning' && x.correct_streak===0 && x.interval_days===0));

// Reward event remains one per completed session despite completion replay.
const rewardCount = await service.from('reward_events').select('*',{count:'exact',head:true}).eq('student_id',ids['student1@ens.local']).eq('source_id',cycle1.sessionId); if (rewardCount.error) throw rewardCount.error; assert.equal(rewardCount.count,1);

console.log(JSON.stringify({
  ok:true,
  fake_accounts:accounts.map(([email])=>email),
  auth_context:'PASS',
  rls_profiles:'PASS',
  direct_xp_write_denied:'PASS',
  direct_mastery_write_denied:'PASS',
  private_tables_hidden:'PASS',
  teacher_student_scope:'PASS',
  cross_school_isolation:'PASS',
  rpc_server_validation:'PASS',
  attempt_idempotency:'PASS',
  completion_idempotency:'PASS',
  early_review_antifarming:'PASS',
  multid device_persistence:'PASS'.replace('d device','device'),
  mastery_five_valid_cycles_and_21_days:'PASS',
  valid_failure_degrades_mastery:'PASS'
}, null, 2));
