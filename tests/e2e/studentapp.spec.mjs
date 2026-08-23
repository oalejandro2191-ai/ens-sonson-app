import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { appendFileSync, mkdirSync } from 'node:fs';

const url=process.env.SUPABASE_URL;
const anonKey=process.env.SUPABASE_ANON_KEY;
if(!url || !anonKey) throw new Error('local Supabase env missing');
const password='LocalPilot!2026';
const routeCode='A1-V3';
const lessonId='44444444-4444-4444-4444-444444444444';
const wordBe='55555555-5555-5555-5555-555555555551';
const artifacts='artifacts/e2e';
mkdirSync(artifacts,{recursive:true});

async function apiLogin(email){
  const c=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await c.auth.signInWithPassword({email,password});
  if(error) throw error;
  return c;
}

async function browserLogin(page,email,pass=password){
  await page.goto('/estudiante');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(pass);
  await page.getByTestId('login-submit').click();
  if(pass===password) await expect(page.getByTestId('identity-chip')).toBeVisible();
}

async function active(client){
  const r=await client.rpc('get_my_active_route_session_v1',{target_route_code:routeCode});
  if(r.error) throw r.error;
  return r.data;
}

async function correctAnswer(page){
  const text=(await page.getByTestId('practice-card').textContent()) ?? '';
  if(text.includes('¿Qué significa “be”?')) return 'ser o estar';
  if(text.includes('¿Qué significa “hello”?')) return 'hola';
  if(text.includes('ser o estar')) return 'be';
  if(text.includes('hola')) return 'hello';
  throw new Error(`Unknown local fixture prompt: ${text}`);
}

async function answerCurrentCorrect(page){
  const value=await correctAnswer(page);
  await page.getByTestId('lesson-answer').fill(value);
  await page.getByTestId('submit-answer').click();
  await expect.poll(async()=>
    (await page.locator('.server-feedback').isVisible().catch(()=>false)) ||
    (await page.getByTestId('lesson-finish').isVisible().catch(()=>false))
  ).toBe(true);
}

async function answerRemaining(page){
  for(let i=0;i<12;i++){
    if(await page.getByTestId('lesson-finish').isVisible().catch(()=>false)) return;
    if(await page.getByTestId('practice-card').isVisible().catch(()=>false)){
      await answerCurrentCorrect(page);
      continue;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('lesson did not reach finish state');
}

async function startLesson(page){
  await page.goto('/estudiante/aprender');
  await expect(page.getByTestId('lesson-start')).toBeVisible();
  await page.getByTestId('start-lesson').click();
  await expect(page.getByTestId('practice-card')).toBeVisible();
}

test.afterEach(async ({},testInfo)=>{
  appendFileSync(`${artifacts}/matrix.ndjson`,JSON.stringify({scenario:testInfo.title,status:testInfo.status,expected:testInfo.expectedStatus,duration_ms:testInfo.duration})+'\n');
});

test.describe.serial('ENS English local StudentApp E2E',()=>{
  test('01 login válido',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
    await page.screenshot({path:`${artifacts}/01-login.png`,fullPage:true});
  });

  test('02 login inválido',async({page})=>{
    await browserLogin(page,'student1@ens.local','bad-password');
    await expect(page.getByTestId('login-error')).toContainText('Credenciales no válidas');
  });

  test('03 sesión persistente al recargar',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
  });

  test('04 logout invalida navegación protegida',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('login-page')).toBeVisible();
    await page.goto('/estudiante/aprender');
    await expect(page.getByTestId('login-page')).toBeVisible();
  });

  test('05 identidad estudiante',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await page.goto('/estudiante/perfil');
    await expect(page.getByTestId('identity-panel')).toContainText('Student 1');
    await expect(page.getByTestId('identity-panel')).toContainText('Estudiante');
    await expect(page.getByTestId('identity-panel')).toContainText('ENS Local Pilot');
    await expect(page.getByTestId('identity-panel')).toContainText('8A PILOT');
  });

  test('06 identidad docente',async({page})=>{
    await browserLogin(page,'teacher@ens.local');
    await expect(page.getByTestId('role-home')).toContainText('Teacher Pilot');
    await expect(page.getByTestId('role-home')).toContainText('Docente');
  });

  test('07 identidad administrador',async({page})=>{
    await browserLogin(page,'admin@ens.local');
    await expect(page.getByTestId('role-home')).toContainText('Admin Pilot');
    await expect(page.getByTestId('role-home')).toContainText('Administrador institucional');
  });

  test('08 dashboard real del estudiante',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
    await expect(page.getByTestId('metric-mastered')).toHaveText('0');
    await page.screenshot({path:`${artifacts}/08-dashboard.png`,fullPage:true});
  });

  test('09 estudiante inicia lección',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    const c=await apiLogin('student1@ens.local');
    const s=await active(c);
    expect(s).not.toBeNull();
    expect(s.tasks).toHaveLength(8);
    await page.screenshot({path:`${artifacts}/09-lesson.png`,fullPage:true});
  });

  test('10 respuesta correcta',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    await answerCurrentCorrect(page);
    const c=await apiLogin('student1@ens.local');
    const s=await active(c);
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].correct).toBe(true);
  });

  test('11 respuesta incorrecta',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    await page.getByTestId('lesson-answer').fill('definitely wrong');
    await page.getByTestId('submit-answer').click();
    await expect(page.locator('.server-feedback')).toBeVisible();
    const c=await apiLogin('student1@ens.local');
    const s=await active(c);
    expect(s.attempts).toHaveLength(2);
    expect(s.attempts.at(-1).correct).toBe(false);
  });

  test('12 servidor determina corrección y cliente no envía is_correct/mastery/reward',async({page})=>{
    const bodies=[];
    page.on('request',request=>{
      if(request.url().includes('/rpc/record_route_lesson_attempt_v1')) bodies.push(request.postData() ?? '');
    });
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    await answerCurrentCorrect(page);
    expect(bodies.length).toBeGreaterThan(0);
    const body=bodies.at(-1);
    expect(body).not.toContain('is_correct');
    expect(body).not.toContain('mastery_state');
    expect(body).not.toContain('xp');
    expect(body).not.toContain('coins');
    expect(body).not.toContain('ranking');
  });

  test('13 doble clic no crea dos intentos',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    const c=await apiLogin('student1@ens.local');
    const before=await active(c);
    const answer=await correctAnswer(page);
    await page.getByTestId('lesson-answer').fill(answer);
    await page.getByTestId('submit-answer').evaluate(button=>{ button.click(); button.click(); });
    await expect.poll(async()=> (await active(c)).attempts.length).toBe(before.attempts.length+1);
  });

  test('14 mismo client_event_id es idempotente',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    const c=await apiLogin('student1@ens.local');
    const before=await active(c);
    const task=before.tasks.find(item=>!before.attempts.some(a=>a.word_id===item.word_id&&a.activity_type===item.activity_type));
    expect(task).toBeTruthy();
    const eventId=`lesson:${before.session_id}:${task.word_id}:${task.activity_type}`;
    const args={target_session_id:before.session_id,target_word_id:task.word_id,target_activity_type:task.activity_type,provided_answer:'wrong but stable',provided_response_time_ms:900,provided_client_event_id:eventId,provided_attempt_number:1};
    const one=await c.rpc('record_route_lesson_attempt_v1',args);
    const two=await c.rpc('record_route_lesson_attempt_v1',args);
    expect(one.error).toBeNull();
    expect(two.error).toBeNull();
    expect(two.data.idempotent_replay).toBe(true);
    expect(two.data.attempt_id).toBe(one.data.attempt_id);
  });

  test('15 completar sesión dos veces es idempotente',async({page})=>{
    await browserLogin(page,'student1@ens.local');
    await startLesson(page);
    await answerRemaining(page);
    const c=await apiLogin('student1@ens.local');
    const before=await active(c);
    expect(before.confirmed_count).toBe(before.expected_count);
    await page.getByTestId('complete-lesson').click();
    await expect(page.getByTestId('lesson-result')).toBeVisible();
    await page.screenshot({path:`${artifacts}/15-result.png`,fullPage:true});
    const replay=await c.rpc('complete_route_lesson_session_v1',{target_session_id:before.session_id});
    expect(replay.error).toBeNull();
    expect(replay.data.idempotent_replay).toBe(true);
  });

  test('16 Omitir no crea intento ni evidencia',async({page})=>{
    await browserLogin(page,'student2@ens.local');
    await startLesson(page);
    const c=await apiLogin('student2@ens.local');
    const before=await active(c);
    expect(before.attempts).toHaveLength(0);
    await page.getByTestId('skip-activity').click();
    const after=await active(c);
    expect(after.attempts).toHaveLength(0);
    expect(after.confirmed_count).toBe(0);
  });

  test('17 Salir conserva sesión sin completarla',async({page})=>{
    await browserLogin(page,'student2@ens.local');
    await startLesson(page);
    const c=await apiLogin('student2@ens.local');
    const before=await active(c);
    await answerCurrentCorrect(page);
    await page.getByTestId('exit-lesson').click();
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
    const after=await active(c);
    expect(after.session_id).toBe(before.session_id);
    expect(after.status).toBe('in_progress');
    expect(after.attempts.length).toBeGreaterThanOrEqual(1);
  });

  test('18 recuperar sesión desde servidor tras cerrar contexto',async({browser})=>{
    const api=await apiLogin('student2@ens.local');
    const expected=await active(api);
    const context=await browser.newContext();
    const page=await context.newPage();
    await browserLogin(page,'student2@ens.local');
    await startLesson(page);
    const recovered=await active(api);
    expect(recovered.session_id).toBe(expected.session_id);
    expect(recovered.attempts.length).toBe(expected.attempts.length);
    await context.close();
  });

  test('19 docente no puede jugar como estudiante',async({page})=>{
    await browserLogin(page,'teacher@ens.local');
    await page.goto('/estudiante/aprender');
    await expect(page.getByTestId('role-home')).toContainText('no puede iniciar lecciones');
    const c=await apiLogin('teacher@ens.local');
    const r=await c.rpc('start_route_lesson_session_v1',{target_route_code:routeCode,target_lesson_id:lessonId,provided_client_session_id:'teacher_e2e_block',provided_client_context:{}});
    expect(r.error).toBeTruthy();
  });

  test('20 estudiante no puede usar sesión ajena',async()=>{
    const owner=await apiLogin('student2@ens.local');
    const intruder=await apiLogin('student3@ens.local');
    const s=await active(owner);
    const r=await intruder.rpc('record_route_lesson_attempt_v1',{target_session_id:s.session_id,target_word_id:wordBe,target_activity_type:'recall',provided_answer:'be',provided_response_time_ms:1000,provided_client_event_id:'foreign_session_e2e',provided_attempt_number:1});
    expect(r.error).toBeTruthy();
  });

  test('21 otra institución no ve datos ENS',async({page})=>{
    await browserLogin(page,'student5@ens.local');
    await page.goto('/estudiante/perfil');
    await expect(page.getByTestId('identity-panel')).toContainText('Other School Test');
    await expect(page.getByTestId('identity-panel')).not.toContainText('ENS Local Pilot');
    const outsider=await apiLogin('student5@ens.local');
    const profiles=await outsider.from('profiles').select('display_alias');
    expect(profiles.error).toBeNull();
    expect(profiles.data.map(x=>x.display_alias)).toEqual(['Outside Student']);
  });

  test('22 usuario no puede escribir mastery directamente',async()=>{
    const c=await apiLogin('student3@ens.local');
    const r=await c.from('student_word_progress').insert({student_id:'00000000-0000-0000-0000-000000000000',word_id:wordBe,mastery_state:'mastered'});
    expect(r.error).toBeTruthy();
  });

  test('23 usuario no puede asignarse XP',async()=>{
    const c=await apiLogin('student3@ens.local');
    const {data:userData}=await c.auth.getUser();
    const r=await c.from('student_stats').insert({student_id:userData.user.id,total_xp:999999,coins:999999});
    expect(r.error).toBeTruthy();
  });

  test('24 segundo contexto de navegador recibe progreso del servidor',async({browser})=>{
    const contextA=await browser.newContext();
    const pageA=await contextA.newPage();
    await browserLogin(pageA,'student4@ens.local');
    await startLesson(pageA);
    await answerRemaining(pageA);
    await pageA.getByTestId('complete-lesson').click();
    await expect(pageA.getByTestId('lesson-result')).toBeVisible();
    await contextA.close();

    const contextB=await browser.newContext();
    const pageB=await contextB.newPage();
    await browserLogin(pageB,'student4@ens.local');
    await expect(pageB.getByTestId('metric-learning')).toHaveText('2');
    await pageB.screenshot({path:`${artifacts}/24-second-browser.png`,fullPage:true});
    await contextB.close();
  });

  test('25 progreso persiste tras borrar localStorage y volver a autenticar',async({browser})=>{
    const context=await browser.newContext();
    const page=await context.newPage();
    await browserLogin(page,'student4@ens.local');
    await expect(page.getByTestId('metric-learning')).toHaveText('2');
    await page.evaluate(()=>localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('login-page')).toBeVisible();
    await browserLogin(page,'student4@ens.local');
    await expect(page.getByTestId('metric-learning')).toHaveText('2');
    await page.getByTestId('logout').click();
    await browserLogin(page,'student4@ens.local');
    await expect(page.getByTestId('metric-learning')).toHaveText('2');
    await context.close();
  });
});
