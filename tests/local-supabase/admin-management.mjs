import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL:url, SUPABASE_ANON_KEY:anonKey } = process.env;
assert(url && anonKey);
const password='LocalPilot!2026';

async function login(email){
  const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) throw error;
  return client;
}

const admin=await login('admin@ens.local');
const teacher=await login('teacher@ens.local');
const student=await login('student1@ens.local');
const outsider=await login('student5@ens.local');
const student2=await login('student2@ens.local');

let r=await admin.rpc('get_my_admin_portal_v1');
assert.ifError(r.error);
assert.equal(r.data.profile.role,'institution_admin');
assert.equal(r.data.profile.institution,'ENS Local Pilot');

r=await teacher.rpc('get_admin_groups_v1');
assert(r.error,'teacher must not access institution admin group API');
r=await student.rpc('get_admin_students_v1',{provided_search:null,provided_group_id:null});
assert(r.error,'student must not access institution admin student API');
r=await outsider.rpc('get_admin_vocabulary_v1',{provided_search:null,provided_status:null,provided_limit:10,provided_offset:0});
assert(r.error,'other institution student must not access vocabulary administration');

r=await admin.rpc('get_admin_groups_v1');
assert.ifError(r.error);
assert(r.data.some(group=>group.name==='8A PILOT'));
assert(!r.data.some(group=>group.name==='8X OTHER'));

const createdGroup=await admin.rpc('admin_create_group_v1',{
  provided_name:'7A ADMIN TEST',provided_grade:'7',provided_academic_year_id:'22222222-2222-2222-2222-222222222221'
});
assert.ifError(createdGroup.error);
const groupId=createdGroup.data.id;
assert(groupId);

r=await admin.rpc('admin_update_group_v1',{
  target_group_id:groupId,provided_name:'7B ADMIN TEST',provided_grade:'7',provided_academic_year_id:'22222222-2222-2222-2222-222222222221'
});
assert.ifError(r.error);
assert.equal(r.data.name,'7B ADMIN TEST');

r=await admin.rpc('admin_archive_group_v1',{target_group_id:groupId});
assert.ifError(r.error);
assert.equal(r.data.status,'archived');
r=await admin.rpc('admin_restore_group_v1',{target_group_id:groupId});
assert.ifError(r.error);
assert.equal(r.data.status,'active');

r=await admin.rpc('get_admin_students_v1',{provided_search:null,provided_group_id:null});
assert.ifError(r.error);
assert.equal(r.data.length,4);
assert(!r.data.some(item=>item.full_name==='Outside Student'));
const student1Row=r.data.find(item=>item.full_name==='Student 1');
const student2Row=r.data.find(item=>item.full_name==='Student 2');
assert(student1Row && student2Row);

r=await admin.rpc('admin_assign_student_group_v1',{target_user_id:student1Row.user_id,target_group_id:groupId});
assert.ifError(r.error);
assert.equal(r.data.group_id,groupId);
r=await admin.rpc('get_admin_students_v1',{provided_search:'Student 1',provided_group_id:groupId});
assert.ifError(r.error);
assert.equal(r.data.length,1);
assert.equal(r.data[0].group_name,'7B ADMIN TEST');

r=await admin.rpc('admin_set_student_status_v1',{target_user_id:student2Row.user_id,provided_status:'suspended'});
assert.ifError(r.error);
assert.equal(r.data.status,'suspended');
r=await admin.rpc('admin_set_student_status_v1',{target_user_id:student2Row.user_id,provided_status:'active'});
assert.ifError(r.error);
assert.equal(r.data.status,'active');

r=await admin.rpc('admin_validate_student_access_reset_v1',{target_user_id:student1Row.user_id});
assert.ifError(r.error);
assert.equal(r.data.authorized,true);
r=await teacher.rpc('admin_validate_student_access_reset_v1',{target_user_id:student1Row.user_id});
assert(r.error);
r=await student.rpc('admin_validate_student_access_reset_v1',{target_user_id:student1Row.user_id});
assert(r.error);

const createdWord=await admin.rpc('admin_create_vocabulary_word_v1',{
  provided_english:'checkpoint',provided_spanish:'punto de control',provided_unit_type:'word',
  provided_accepted_forms:['checkpoint'],provided_category:'testing',provided_difficulty:1,
  provided_example_en:'This is a checkpoint.',provided_example_es:'Este es un punto de control.',provided_priority:1
});
assert.ifError(createdWord.error);
const wordId=createdWord.data.id;

r=await admin.rpc('admin_update_vocabulary_word_v1',{
  target_word_id:wordId,provided_english:'checkpoint',provided_spanish:'punto de comprobación',provided_unit_type:'word',
  provided_accepted_forms:['checkpoint'],provided_category:'testing',provided_difficulty:2,
  provided_example_en:'This checkpoint is safe.',provided_example_es:'Este punto de comprobación es seguro.',provided_priority:2
});
assert.ifError(r.error);
assert.equal(r.data.spanish,'punto de comprobación');

r=await admin.rpc('admin_archive_vocabulary_word_v1',{target_word_id:wordId});
assert.ifError(r.error);
assert.equal(r.data.status,'archived');
r=await admin.rpc('admin_restore_vocabulary_word_v1',{target_word_id:wordId});
assert.ifError(r.error);
r=await admin.rpc('admin_delete_unused_vocabulary_word_v1',{target_word_id:wordId});
assert.ifError(r.error);
assert.equal(r.data.deleted,true);

r=await admin.rpc('admin_delete_unused_vocabulary_word_v1',{target_word_id:'55555555-5555-5555-5555-555555555551'});
assert(r.error,'used vocabulary must not be physically deleted');

r=await admin.rpc('get_admin_vocabulary_v1',{provided_search:'be',provided_status:null,provided_limit:20,provided_offset:0});
assert.ifError(r.error);
assert(r.data.items.some(item=>item.english==='be'));

const xpAttack=await admin.from('student_stats').update({total_xp:777777}).eq('student_id',student1Row.user_id);
assert(xpAttack.error,'institution admin must not have direct XP writes');
const masteryAttack=await admin.from('student_word_progress').update({mastery_state:'mastered'}).eq('student_id',student1Row.user_id);
assert(masteryAttack.error,'institution admin must not have direct mastery writes');

r=await admin.rpc('get_admin_audit_v1',{provided_limit:100});
assert.ifError(r.error);
const actions=new Set(r.data.map(item=>item.action));
for(const required of ['group.created','group.updated','group.archived','group.restored','student.group_changed','student.status_changed','vocabulary.created','vocabulary.updated','vocabulary.archived','vocabulary.restored','vocabulary.deleted_unused']){
  assert(actions.has(required),`missing audit action ${required}`);
}

// Return student1 to the original group so subsequent local smoke expectations remain intuitive.
r=await admin.rpc('admin_assign_student_group_v1',{target_user_id:student1Row.user_id,target_group_id:'66666666-6666-6666-6666-666666666661'});
assert.ifError(r.error);

// Ensure direct APIs still see the student as active after the suspend/reactivate cycle.
r=await admin.rpc('get_admin_students_v1',{provided_search:'Student 2',provided_group_id:null});
assert.ifError(r.error);
assert.equal(r.data[0].status,'active');

console.log(JSON.stringify({
  ok:true,
  admin_authorization:'PASS',
  teacher_denied:'PASS',
  student_denied:'PASS',
  cross_institution_denied:'PASS',
  groups_crud_archive:'PASS',
  student_group_move:'PASS',
  student_suspend_reactivate:'PASS',
  reset_authorization:'PASS',
  vocabulary_create_update_archive_restore:'PASS',
  unused_vocabulary_delete:'PASS',
  used_vocabulary_delete_blocked:'PASS',
  direct_mastery_write_denied:'PASS',
  direct_xp_write_denied:'PASS',
  audit_trail:'PASS'
},null,2));
