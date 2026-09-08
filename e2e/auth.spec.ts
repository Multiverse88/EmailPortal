import { test, expect } from '@playwright/test';
import { login, CUSTOMER, ADMIN , resetDb } from './helpers';

test.describe('Autentikasi', () => {
  test.beforeAll(resetDb);

  test('halaman login tampil lengkap', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Email Portal' })).toBeVisible();
    await expect(page.getByTestId('email')).toBeVisible();
    await expect(page.getByTestId('password')).toBeVisible();
    await expect(page.getByTestId('tab-customer')).toBeVisible();
    await expect(page.getByTestId('tab-admin')).toBeVisible();
  });

  test('root redirect ke /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('kredensial salah menampilkan error dan tetap di halaman login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email').fill(CUSTOMER.email);
    await page.getByTestId('password').fill('SalahBanget123');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('login-error')).toContainText('salah');
    await expect(page).toHaveURL(/\/login/);
  });

  test('halaman terproteksi menolak akses tanpa token', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login/);
  });

  test('customer tidak bisa membuka halaman admin', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/inbox/);
  });

  test('admin login masuk ke dashboard admin', async ({ page }) => {
    await login(page, ADMIN, 'admin');
    await expect(page.getByTestId('mailbox-table')).toBeVisible();
  });

  test('logout membersihkan sesi', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login/);
  });
});
