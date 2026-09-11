import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL:url, SUPABASE_ANON_KEY:anonKey, SUPABASE_SERVICE_ROLE_KEY:serviceKey } = process.env;
assert(url && anonKey && serviceKey, 'local Supabase env is required');

const service = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
const password='LocalPilot!2026';
const emails=['admin@ens.local','teacher@ens.local','student1@ens.local','student2@ens.local','student3@ens.local','student4@ens.local','student5@ens.local','student6@ens.local'];
const ids={};

for (const email of emails) {
  const pendingActivation=email==='student6@ens.local';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm:true, app_metadata: pendingActivation ? { must_change_password:true } : {} });
  if (error && !/already/i.test(error.message)) throw error;
  if (data?.user?.id) ids[email]=data.user.id;
}
if (Object.keys(ids).length!==emails.length) {
  const { data, error }=await service.auth.admin.listUsers({page:1,perPage:100});
  if(error) throw error;
  for (const user of data.users) if (emails.includes(user.email)) ids[user.email]=user.id;
}
assert.equal(Object.keys(ids).length,8);

const school='11111111-1111-1111-1111-111111111111';
const otherSchool='11111111-1111-1111-1111-111111111112';
const group='66666666-6666-6666-6666-666666666661';
const otherGroup='66666666-6666-6666-6666-666666666662';
const year='22222222-2222-2222-2222-222222222221';

const profiles=[
  {id:ids['admin@ens.local'],school_id:school,role:'teacher',display_alias:'Admin Pilot'},
  {id:ids['teacher@ens.local'],school_id:school,role:'teacher',display_alias:'Teacher Pilot'},
  ...['student1','student2','student3','student4'].map((name,index)=>({id:ids[`${name}@ens.local`],school_id:school,role:'student',display_alias:`Student ${index+1}`})),
  {id:ids['student5@ens.local'],school_id:otherSchool,role:'student',display_alias:'Outside Student'},
  {id:ids['student6@ens.local'],school_id:school,role:'student',display_alias:'Pending Student'},
];
const profileResult=await service.from('profiles').upsert(profiles);
if(profileResult.error) throw profileResult.error;

async function membership(userId,schoolId,role,groupId=null,academicYearId=null){
  const { error }=await service.rpc('local_test_configure_membership',{
    target_user_id:userId,
    target_school_id:schoolId,
    target_role:role,
    target_group_id:groupId,
    target_academic_year_id:academicYearId,
  });
  if(error) throw error;
}

await membership(ids['admin@ens.local'],school,'institution_admin');
await membership(ids['teacher@ens.local'],school,'teacher',group,year);
for(const name of ['student1','student2','student3','student4']) await membership(ids[`${name}@ens.local`],school,'student',group);
await membership(ids['student5@ens.local'],otherSchool,'student',otherGroup);
const pendingResult=await service.rpc('local_test_configure_pending_student',{target_user_id:ids['student6@ens.local'],target_school_id:school,target_group_id:group});
if(pendingResult.error) throw pendingResult.error;

console.log(JSON.stringify({ok:true,accounts:emails,password_hint:'local fixture only'},null,2));
