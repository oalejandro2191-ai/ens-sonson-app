import { test, expect } from '@playwright/test';

const password='LocalPilot!2026';

async function loginThroughAdmin(page,email='admin@ens.local'){
  await page.goto('/admin');
  await expect(page.getByTestId('admin-login-page')).toBeVisible();
  await page.getByTestId('admin-login-email').fill(email);
  await page.getByTestId('admin-login-password').fill(password);
  await page.getByTestId('admin-login-submit').click();
}

test.describe.serial('ENS English protected admin routes',()=>{
  test('R01 institution_admin abre creación manual y ve grupos propios',async({page})=>{
    await loginThroughAdmin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await page.goto('/admin/estudiantes/nuevo');
    await expect(page.getByTestId('admin-student-create-page')).toBeVisible();
    await expect(page.getByTestId('student-create-form')).toBeVisible();
    const group=page.getByTestId('student-create-group');
    await expect(group).toContainText('8A PILOT');
    await expect(group).not.toContainText('8X OTHER');
    await expect(page.getByTestId('student-create-submit')).toBeDisabled();
  });

  test('R02 estudiante autenticado no puede abrir creación manual',async({page})=>{
    await loginThroughAdmin(page,'student1@ens.local');
    await expect(page.getByTestId('admin-access-denied')).toBeVisible();
    await page.goto('/admin/estudiantes/nuevo');
    await expect(page.getByRole('heading',{name:'Acceso administrativo requerido'})).toBeVisible();
    await expect(page.getByTestId('student-create-form')).toHaveCount(0);
  });

  test('R03 institution_admin abre catálogo completo paginado',async({page})=>{
    await loginThroughAdmin(page);
    await expect(page.getByTestId('admin-portal')).toBeVisible();
    await page.goto('/admin/vocabulario');
    await expect(page.getByTestId('admin-vocabulary-catalog')).toBeVisible();
    await expect(page.getByTestId('vocabulary-total')).toContainText('2 Learning Units');
    await expect(page.getByTestId('vocabulary-range')).toContainText('Mostrando 1–2 de 2');
    await expect(page.getByTestId('vocabulary-page')).toContainText('Página 1 de 1');
  });
});
