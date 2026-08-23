import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { appendFileSync, mkdirSync } from 'node:fs';

const url=process.env.SUPABASE_URL;
const anonKey=process.env.SUPABASE_ANON_KEY;
if(!url || !anonKey) throw new Error('local Supabase env missing');
const password='LocalPilot!2026';
const artifacts='artifacts/admin-e2e';
mkdirSync(artifacts,{recursive:true});

async function apiLogin(email){
  const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) throw error;
  return client;
}

async function adminLogin(page,email='admin@ens.local',pass=password){
  await page.goto('/admin');
  await expect(page.getByTestId('admin-login-page')).toBeVisible();
  await page.getByTestId('admin-login-email').fill(email);
  await page.getByTestId('admin-login-password').fill(pass);
  await page.getByTestId('admin-login-submit').click();
}

async function openTab(page,name){
  await page.getByRole('button',{name}).click();
}

function studentRow(page,name){
  return page.locator('.student-row').filter({hasText:name});
}

function vocabRow(page,english){
  return page.locator('.table-row').filter({hasText:english});
}

test.afterEach(async ({},testInfo)=>{
  appendFileSync(`${artifacts}/matrix.ndjson`,JSON.stringify({scenario:testInfo.title,status:testInfo.status,expected:testInfo.expectedStatus,duration_ms:testInfo.duration})+'\n');
});

test.describe.serial('ENS English local institution admin E2E',()=>{
  test('A01 institution_admin entra y ve backend real',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await expect(page.getByTestId('admin-institution')).toHaveText('ENS Local Pilot');
    await expect(page.getByTestId('admin-role')).toHaveText('institution_admin');
    await expect(page.getByTestId('admin-dashboard')).toContainText('Estudiantes activos');
    await page.screenshot({path:`${artifacts}/A01-dashboard.png`,fullPage:true});
  });

  test('A02 estudiante autenticado queda fuera del portal',async({page})=>{
    await adminLogin(page,'student1@ens.local');
    await expect(page.getByTestId('admin-access-denied')).toBeVisible();
    await expect(page.getByTestId('admin-access-denied')).toContainText('institution_admin');
  });

  test('A03 docente sin rol administrativo queda fuera',async({page})=>{
    await adminLogin(page,'teacher@ens.local');
    await expect(page.getByTestId('admin-access-denied')).toBeVisible();
  });

  test('A04 crea, edita, archiva y restaura grupo',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Grupos');
    const module=page.getByTestId('admin-groups-module');
    await expect(module).toBeVisible();
    await module.getByLabel('Nombre').fill('7A UI TEST');
    await module.getByLabel('Grado').fill('7');
    await module.getByRole('button',{name:'Crear grupo'}).click();
    await expect(module).toContainText('7A UI TEST');

    let card=module.locator('.management-card').filter({hasText:'7A UI TEST'});
    await card.getByRole('button',{name:'Editar'}).click();
    await module.getByLabel('Nombre').fill('7B UI TEST');
    await module.getByRole('button',{name:'Guardar cambios'}).click();
    await expect(module).toContainText('7B UI TEST');

    card=module.locator('.management-card').filter({hasText:'7B UI TEST'});
    page.once('dialog',dialog=>dialog.accept());
    await card.getByRole('button',{name:'Archivar'}).click();
    card=module.locator('.management-card').filter({hasText:'7B UI TEST'});
    await expect(card).toContainText('archived');
    await card.getByRole('button',{name:'Restaurar'}).click();
    await expect(card).toContainText('active');
    await page.screenshot({path:`${artifacts}/A04-groups.png`,fullPage:true});
  });

  test('A05 lista estudiantes, busca y filtra por grupo',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Estudiantes');
    const module=page.getByTestId('admin-students-module');
    await expect(module).toContainText('Student 1');
    await module.getByPlaceholder('Buscar estudiante').fill('Student 1');
    await module.getByRole('button',{name:'Buscar'}).click();
    await expect(module.locator('.student-row')).toHaveCount(1);
    await expect(module).not.toContainText('Outside Student');
  });

  test('A06 mueve estudiante, suspende, reactiva y conserva controles',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Estudiantes');
    let row=studentRow(page,'Student 1');
    await row.locator('select').selectOption({label:'7B UI TEST'});
    await row.getByRole('button',{name:'Mover'}).click();
    row=studentRow(page,'Student 1');
    await expect(row).toContainText('7B UI TEST');
    await expect(row.getByRole('button',{name:'Regenerar acceso'})).toBeVisible();

    let row2=studentRow(page,'Student 2');
    await row2.getByRole('button',{name:'Suspender'}).click();
    row2=studentRow(page,'Student 2');
    await expect(row2).toContainText('suspended');
    await row2.getByRole('button',{name:'Reactivar'}).click();
    row2=studentRow(page,'Student 2');
    await expect(row2).toContainText('active');

    row=studentRow(page,'Student 1');
    await row.locator('select').selectOption({label:'8A PILOT'});
    await row.getByRole('button',{name:'Mover'}).click();
    await expect(studentRow(page,'Student 1')).toContainText('8A PILOT');
    await page.screenshot({path:`${artifacts}/A06-students.png`,fullPage:true});
  });

  test('A07 catálogo permite crear y editar Learning Unit',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Vocabulario');
    const module=page.getByTestId('admin-vocabulary-module');
    await module.getByLabel('Inglés').fill('checkpointui');
    await module.getByLabel('Español').fill('punto de control ui');
    await module.getByLabel('Categoría').fill('testing');
    await module.getByRole('button',{name:'Agregar al catálogo'}).click();
    await module.getByPlaceholder('Buscar en inglés o español').fill('checkpointui');
    await module.getByRole('button',{name:'Filtrar'}).click();
    let row=vocabRow(page,'checkpointui');
    await expect(row).toBeVisible();
    await row.getByTitle('Editar').click();
    await module.getByLabel('Español').fill('punto de comprobación ui');
    await module.getByRole('button',{name:'Guardar Learning Unit'}).click();
    await module.getByPlaceholder('Buscar en inglés o español').fill('checkpointui');
    await module.getByRole('button',{name:'Filtrar'}).click();
    row=vocabRow(page,'checkpointui');
    await expect(row).toContainText('punto de comprobación ui');
  });

  test('A08 archiva, restaura y elimina físicamente solo vocabulario sin uso',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Vocabulario');
    const module=page.getByTestId('admin-vocabulary-module');
    await module.getByPlaceholder('Buscar en inglés o español').fill('checkpointui');
    await module.getByRole('button',{name:'Filtrar'}).click();
    let row=vocabRow(page,'checkpointui');
    await row.getByTitle('Archivar').click();
    row=vocabRow(page,'checkpointui');
    await expect(row).toContainText('archived');
    await row.getByTitle('Restaurar').click();
    row=vocabRow(page,'checkpointui');
    await expect(row).toContainText('active');
    page.once('dialog',dialog=>dialog.accept());
    await row.getByTitle('Eliminar si nunca se usó').click();
    await module.getByPlaceholder('Buscar en inglés o español').fill('checkpointui');
    await module.getByRole('button',{name:'Filtrar'}).click();
    await expect(vocabRow(page,'checkpointui')).toHaveCount(0);
  });

  test('A09 palabra usada no permite borrado destructivo',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Vocabulario');
    const module=page.getByTestId('admin-vocabulary-module');
    await module.getByPlaceholder('Buscar en inglés o español').fill('be');
    await module.getByRole('button',{name:'Filtrar'}).click();
    const row=vocabRow(page,'be');
    await expect(row).toBeVisible();
    await expect(row.getByTitle('Eliminar si nunca se usó')).toBeDisabled();
    await page.screenshot({path:`${artifacts}/A09-vocabulary.png`,fullPage:true});
  });

  test('A10 institution_admin tampoco puede escribir XP ni mastery directamente',async()=>{
    const admin=await apiLogin('admin@ens.local');
    const students=await admin.rpc('get_admin_students_v1',{provided_search:'Student 1',provided_group_id:null});
    assertNoError(students.error);
    const studentId=students.data[0].user_id;
    const xp=await admin.from('student_stats').update({total_xp:123456}).eq('student_id',studentId);
    expect(xp.error).toBeTruthy();
    const mastery=await admin.from('student_word_progress').update({mastery_state:'mastered'}).eq('student_id',studentId);
    expect(mastery.error).toBeTruthy();
  });

  test('A11 auditoría muestra acciones administrativas',async({page})=>{
    await adminLogin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await openTab(page,'Auditoría');
    const module=page.getByTestId('admin-audit-module');
    await expect(module).toContainText('group.created');
    await expect(module).toContainText('student.group_changed');
    await expect(module).toContainText('vocabulary.created');
    await page.screenshot({path:`${artifacts}/A11-audit.png`,fullPage:true});
  });
});

function assertNoError(error){
  if(error) throw error;
}
