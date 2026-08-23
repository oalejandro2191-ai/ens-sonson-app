import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL:url, SUPABASE_ANON_KEY:anonKey } = process.env;
assert(url && anonKey, 'local Supabase env is required');
const password='LocalPilot!2026';
const lesson='44444444-4444-4444-4444-444444444444';
const wordBe='55555555-5555-5555-5555-555555555551';

async function login(email){
  const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) throw error;
  return client;
}

const anonymous=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const student=await login('student1@ens.local');
const otherStudent=await login('student2@ens.local');
const teacher=await login('teacher@ens.local');

let r=await anonymous.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert(r.error,'anonymous caller must be rejected');

r=await student.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data,null);

const first=await student.rpc('start_route_lesson_session_v1',{
  target_route_code:'A1-V3',target_lesson_id:lesson,
  provided_client_session_id:'runtime_probe_01',provided_client_context:{runtime_probe:true}
});
assert.ifError(first.error);

r=await student.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data.session_id,first.data.session_id);
assert.equal(r.data.tasks.length,8);
assert.equal(r.data.attempts.length,0);

// Another student cannot discover or mutate this active session.
r=await otherStudent.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data,null);
const foreignAttempt=await otherStudent.rpc('record_route_lesson_attempt_v1',{
  target_session_id:first.data.session_id,
  target_word_id:wordBe,
  target_activity_type:'recall',
  provided_answer:'be',
  provided_response_time_ms:800,
  provided_client_event_id:'runtime_foreign_attempt_01',
  provided_attempt_number:1
});
assert(foreignAttempt.error,'foreign session mutation must be rejected');

const recovered=await student.rpc('start_route_lesson_session_v1',{
  target_route_code:'A1-V3',target_lesson_id:lesson,
  provided_client_session_id:'browser_lost_client_id_02',provided_client_context:{runtime_probe:true}
});
assert.ifError(recovered.error);
assert.equal(recovered.data.session_id,first.data.session_id);
assert.equal(recovered.data.recovered,true);

const attempt=await student.rpc('record_route_lesson_attempt_v1',{
  target_session_id:first.data.session_id,
  target_word_id:wordBe,
  target_activity_type:'association',
  provided_answer:'ser o estar',
  provided_response_time_ms:1200,
  provided_client_event_id:`lesson:${first.data.session_id}:${wordBe}:association`,
  provided_attempt_number:1
});
assert.ifError(attempt.error);
assert.equal(attempt.data.correct,true);

r=await student.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert.ifError(r.error);
assert.equal(r.data.attempts.length,1);
assert.equal(r.data.confirmed_count,1);

const incomplete=await student.rpc('complete_route_lesson_session_v1',{target_session_id:first.data.session_id});
assert(incomplete.error,'incomplete session must not complete');

const teacherActive=await teacher.rpc('get_my_active_route_session_v1',{target_route_code:'A1-V3'});
assert(teacherActive.error,'teacher must not access a student runtime session');
const teacherStart=await teacher.rpc('start_route_lesson_session_v1',{
  target_route_code:'A1-V3',target_lesson_id:lesson,
  provided_client_session_id:'teacher_runtime_denied_01',provided_client_context:{}
});
assert(teacherStart.error,'teacher must not start a student route session');

console.log(JSON.stringify({
  ok:true,
  anonymous_denied:'PASS',
  server_session_recovery:'PASS',
  task_contract:'PASS',
  confirmed_attempt_recovery:'PASS',
  incomplete_completion_blocked:'PASS',
  foreign_session_hidden:'PASS',
  foreign_session_mutation_denied:'PASS',
  teacher_student_runtime_denied:'PASS'
},null,2));
