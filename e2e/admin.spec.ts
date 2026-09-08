import { test, expect } from '@playwright/test';
import { login, ADMIN , resetDb } from './helpers';

test.describe('Admin mailbox', () => {
  test.beforeAll(resetDb);

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN, 'admin');
  });

  test('menampilkan tabel mailbox dan kuota', async ({ page }) => {
    await expect(page.getByTestId('quota')).toContainText('/ 100');
    await expect(page.getByTestId('mailbox-row')).toHaveCount(2);
  });

  test('membuat mailbox baru dan menampilkan password sementara', async ({ page }) => {
    const local = `uji${Date.now().toString().slice(-6)}`;
    await page.getByTestId('new-mailbox').click();
    await page.getByTestId('form-name').fill('Customer Uji');
    await page.getByTestId('form-personal').fill(`${local}@gmail.com`);
    await page.getByTestId('form-localpart').fill(local);
    await page.getByTestId('form-submit').click();

    await expect(page.getByTestId('created-credentials')).toContainText(`${local}@easylegal.co.id`);
    await expect(page.getByTestId('temp-password')).not.toBeEmpty();
    await expect(page.getByTestId('mailbox-row').filter({ hasText: local })).toHaveCount(1);
  });

  test('local part duplikat ditolak', async ({ page }) => {
    await page.getByTestId('new-mailbox').click();
    await page.getByTestId('form-name').fill('Duplikat');
    await page.getByTestId('form-personal').fill(`dup${Date.now()}@gmail.com`);
    await page.getByTestId('form-localpart').fill('budi');
    await page.getByTestId('form-submit').click();
    await expect(page.getByTestId('form-error')).toContainText('sudah dipakai');
  });

  test('local part tidak valid ditolak', async ({ page }) => {
    await page.getByTestId('new-mailbox').click();
    await page.getByTestId('form-name').fill('Invalid');
    await page.getByTestId('form-personal').fill(`inv${Date.now()}@gmail.com`);
    await page.getByTestId('form-localpart').fill('a b!c');
    await page.getByTestId('form-submit').click();
    await expect(page.getByTestId('form-error')).toContainText('tidak valid');
  });

  test('nonaktifkan lalu aktifkan kembali mailbox', async ({ page }) => {
    const row = page.getByTestId('mailbox-row').filter({ hasText: 'budi@easylegal.co.id' });
    await row.getByTestId('deactivate').click();
    await expect(row).toContainText('inactive');
    await row.getByTestId('reactivate').click();
    await expect(row).toContainText('active');
  });

  test('mailbox nonaktif tidak bisa login', async ({ page }) => {
    // beforeEach leaves us signed in as admin, and /login bounces an authenticated
    // user straight back to their dashboard — so drop the session first.
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByTestId('email').fill('siti@easylegal.co.id');
    await page.getByTestId('password').fill('Customer123!');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  });
});
