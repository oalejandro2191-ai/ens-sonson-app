import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(path, 'utf8');
}

test('manual student creation authorizes before Auth Admin and rolls back orphan accounts', () => {
  const code = source('supabase/functions/admin-student-create/index.ts');
  const authorizeAt = code.indexOf('admin_validate_student_creation_v1');
  const createAt = code.indexOf('auth.admin.createUser');
  const provisionAt = code.indexOf('admin_provision_created_student_v1');
  const cleanupAt = code.indexOf('auth.admin.deleteUser');

  assert(authorizeAt >= 0, 'student creation authorization RPC missing');
  assert(createAt > authorizeAt, 'Auth user must never be created before institution_admin authorization');
  assert(provisionAt > createAt, 'institutional provisioning must occur after Auth creation');
  assert(cleanupAt > provisionAt, 'failed institutional provisioning must clean up the fresh Auth account');
  assert.match(code, /status:\s*"pending_activation"/);
  assert.match(code, /must_change_password:\s*true/);
  assert.doesNotMatch(code, /console\.(log|info|warn|error)\([^)]*temporaryPassword/i, 'temporary password must not be logged');
});

test('password reset authorizes target before privileged password mutation', () => {
  const code = source('supabase/functions/admin-student-access/index.ts');
  const authorizeAt = code.indexOf('admin_validate_student_access_reset_v1');
  const mutateAt = code.indexOf('auth.admin.updateUserById');

  assert(authorizeAt >= 0, 'password reset authorization RPC missing');
  assert(mutateAt > authorizeAt, 'password must never be reset before institution_admin authorization');
  assert.match(code, /must_change_password:\s*true/);
  assert.doesNotMatch(code, /console\.(log|info|warn|error)\([^)]*temporaryPassword/i, 'temporary password must not be logged');
});


test('student activation validates state before privileged password mutation and completes through service-only RPC', () => {
  const code = source('supabase/functions/student-activate/index.ts');
  const stateAt = code.indexOf('get_my_student_activation_state_v1');
  const mutateAt = code.indexOf('auth.admin.updateUserById');
  const completeAt = code.indexOf('service_complete_student_activation_v1');

  assert(stateAt >= 0, 'activation-state RPC missing');
  assert(mutateAt > stateAt, 'password must never be changed before activation state is validated');
  assert(completeAt > mutateAt, 'membership activation must happen after the new password is stored');
  assert.match(code, /app_metadata:[\\s\\S]*must_change_password:\\s*false/);
  assert.doesNotMatch(code, /console\\.(log|info|warn|error)\\([^)]*newPassword/i, 'new password must not be logged');
});
