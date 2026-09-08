import { test, expect } from '@playwright/test';
import { loginAsCustomer , resetDb } from './helpers';

test.describe('Compose, balas, teruskan', () => {
  test.beforeAll(resetDb);

  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
  });

  test('mengirim email baru dan muncul di folder Terkirim', async ({ page }) => {
    const subject = `Uji kirim ${Date.now()}`;
    await page.getByTestId('compose-open').click();
    await expect(page.getByTestId('compose-modal')).toBeVisible();
    await page.getByTestId('compose-to').fill('penerima@contoh.com');
    await page.getByTestId('compose-subject').fill(subject);
    await page.getByTestId('compose-body').fill('Isi pesan pengujian otomatis.');
    await page.getByTestId('compose-send').click();

    await expect(page.getByTestId('compose-modal')).toBeHidden();
    await expect(page.getByTestId('toast')).toContainText('terkirim');

    await page.getByTestId('folder-Sent').click();
    await expect(page.getByTestId('message-row').first()).toContainText(subject);
  });

  test('penerima kosong ditolak sebelum request', async ({ page }) => {
    await page.getByTestId('compose-open').click();
    await page.getByTestId('compose-subject').fill('Tanpa penerima');
    await page.getByTestId('compose-send').click();
    await expect(page.getByTestId('compose-modal')).toBeVisible();
  });

  test('balas mengisi penerima dan subjek Re:', async ({ page }) => {
    await page.getByTestId('message-row').first().click();
    await page.getByTestId('reply').click();
    await expect(page.getByTestId('compose-to')).toHaveValue(/@/);
    await expect(page.getByTestId('compose-subject')).toHaveValue(/^Re: /);
  });

  test('teruskan mengisi subjek Fwd: dengan penerima kosong', async ({ page }) => {
    await page.getByTestId('message-row').first().click();
    await page.getByTestId('forward').click();
    await expect(page.getByTestId('compose-subject')).toHaveValue(/^Fwd: /);
    await expect(page.getByTestId('compose-to')).toHaveValue('');
  });

  test('tombol tutup membatalkan compose', async ({ page }) => {
    await page.getByTestId('compose-open').click();
    await page.getByTestId('compose-close').click();
    await expect(page.getByTestId('compose-modal')).toBeHidden();
  });
});
