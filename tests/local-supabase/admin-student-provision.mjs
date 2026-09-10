import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
} = process.env;
assert(url && anonKey && serviceRoleKey, 'local Supabase env missing');

const fixturePassword = 'LocalPilot!2026';
const candidateEmail = 'manualnew@ens.local';
const candidatePassword = 'ManualLocal!2026';
const candidateName = 'Manual New Student';

function clientWith(key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function login(email) {
  const client = clientWith(anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: fixturePassword });
  if (error) throw error;
  return client;
}

const service = clientWith(serviceRoleKey);
const admin = await login('admin@ens.local');
const teacher = await login('teacher@ens.local');
const student = await login('student1@ens.local');

const groups = await admin.rpc('get_admin_groups_v1');
assert.ifError(groups.error);
const targetGroup = groups.data.find((group) => group.name === '8A PILOT' && group.status === 'active');
assert(targetGroup, 'active local pilot group missing');

let validation = await admin.rpc('admin_validate_student_creation_v1', {
  provided_full_name: candidateName,
  provided_email: candidateEmail,
  target_group_id: targetGroup.id,
});
assert.ifError(validation.error);
assert.equal(validation.data.authorized, true);
assert.equal(validation.data.group_id, targetGroup.id);

const teacherValidation = await teacher.rpc('admin_validate_student_creation_v1', {
  provided_full_name: candidateName,
  provided_email: candidateEmail,
  target_group_id: targetGroup.id,
});
assert(teacherValidation.error, 'teacher must not authorize student creation');

const studentValidation = await student.rpc('admin_validate_student_creation_v1', {
  provided_full_name: candidateName,
  provided_email: candidateEmail,
  target_group_id: targetGroup.id,
});
assert(studentValidation.error, 'student must not authorize student creation');

const authCreated = await service.auth.admin.createUser({
  email: candidateEmail,
  password: candidatePassword,
  email_confirm: true,
  user_metadata: { full_name: candidateName, test_only: true },
});
assert.ifError(authCreated.error);
assert(authCreated.data.user?.id);
const createdUserId = authCreated.data.user.id;

const provision = await admin.rpc('admin_provision_created_student_v1', {
  target_user_id: createdUserId,
  provided_full_name: candidateName,
  target_group_id: targetGroup.id,
});
assert.ifError(provision.error);
assert.equal(provision.data.status, 'pending_activation');
assert.equal(provision.data.group_id, targetGroup.id);

const profile = await service.from('profiles').select('id,school_id,role,display_alias').eq('id', createdUserId).single();
assert.ifError(profile.error);
assert.equal(profile.data.role, 'student');
assert.equal(profile.data.display_alias, candidateName);

const groupMembership = await service.from('group_members')
  .select('group_id,student_id,status').eq('student_id', createdUserId).eq('status', 'active').single();
assert.ifError(groupMembership.error);
assert.equal(groupMembership.data.group_id, targetGroup.id);

const stats = await service.from('student_stats')
  .select('student_id,total_xp,coins,current_streak,longest_streak').eq('student_id', createdUserId).single();
assert.ifError(stats.error);
assert.equal(stats.data.total_xp, 0);
assert.equal(stats.data.coins, 0);
assert.equal(stats.data.current_streak, 0);
assert.equal(stats.data.longest_streak, 0);

const listed = await admin.rpc('get_admin_students_v1', { provided_search: candidateName, provided_group_id: targetGroup.id });
assert.ifError(listed.error);
assert.equal(listed.data.length, 1);
assert.equal(listed.data[0].email, candidateEmail);
assert.equal(listed.data[0].status, 'pending_activation');
assert.equal(listed.data[0].group_id, targetGroup.id);

const candidate = clientWith(anonKey);
const candidateLogin = await candidate.auth.signInWithPassword({ email: candidateEmail, password: candidatePassword });
assert.ifError(candidateLogin.error);

const activationBefore = await candidate.rpc('get_my_student_activation_state_v1');
assert.ifError(activationBefore.error);
assert.equal(activationBefore.data.required, true);
assert.equal(activationBefore.data.status, 'pending_activation');

const directCompletion = await candidate.rpc('service_complete_student_activation_v1', { target_user_id: createdUserId });
assert(directCompletion.error, 'student must not execute the privileged activation completion RPC directly');

const activationComplete = await service.rpc('service_complete_student_activation_v1', { target_user_id: createdUserId });
assert.ifError(activationComplete.error);
assert.equal(activationComplete.data.status, 'active');
assert.equal(activationComplete.data.activated, true);

const activationAfter = await candidate.rpc('get_my_student_activation_state_v1');
assert.ifError(activationAfter.error);
assert.equal(activationAfter.data.required, false);
assert.equal(activationAfter.data.status, 'active');

const audit = await admin.rpc('get_admin_audit_v1', { provided_limit: 200 });
assert.ifError(audit.error);
const creationAudit = audit.data.find((item) => item.action === 'student.created' && item.target_id === createdUserId);
assert(creationAudit, 'student.created audit event missing');
assert.equal(creationAudit.metadata.source, 'manual_admin');
assert.equal(creationAudit.metadata.group_id, targetGroup.id);
assert.equal(creationAudit.metadata.status, 'pending_activation');

const activationAudit = audit.data.find((item) => item.action === 'student.activated' && item.target_id === createdUserId);
assert(activationAudit, 'student.activated audit event missing');
assert.equal(activationAudit.metadata.source, 'self_service_first_login');

validation = await admin.rpc('admin_validate_student_creation_v1', {
  provided_full_name: 'Duplicate Student',
  provided_email: candidateEmail,
  target_group_id: targetGroup.id,
});
assert(validation.error, 'duplicate Auth email must be rejected');

const secondProvision = await admin.rpc('admin_provision_created_student_v1', {
  target_user_id: createdUserId,
  provided_full_name: candidateName,
  target_group_id: targetGroup.id,
});
assert(secondProvision.error, 'already provisioned Auth user must not be provisioned twice');

console.log(JSON.stringify({
  ok: true,
  institution_admin_authorized: 'PASS',
  teacher_denied: 'PASS',
  student_denied: 'PASS',
  profile_created: 'PASS',
  institution_membership_pending_activation: 'PASS',
  group_membership_created: 'PASS',
  zeroed_student_stats: 'PASS',
  audit_student_created: 'PASS',
  duplicate_email_denied: 'PASS',
  double_provision_denied: 'PASS',
  activation_state_pending: 'PASS',
  direct_activation_rpc_denied: 'PASS',
  student_activation_completed: 'PASS',
  activation_audit_logged: 'PASS',
  cleanup: 'ephemeral stack destroyed after workflow',
}, null, 2));
