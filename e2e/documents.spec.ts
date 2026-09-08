import { test, expect } from '@playwright/test';
import { loginAsCustomer, resetDb } from './helpers';

test.describe('Legal Documents Drive & Preview', () => {
  test.beforeEach(resetDb);

  test('menampilkan repositori dokumen legal dan folder', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/documents');

    // Cek header brand Drive
    await expect(page.getByText('EasyLegal', { exact: true })).toBeVisible();
    await expect(page.getByText('Drive', { exact: true })).toBeVisible();

    // Cek tombol Unggah Dokumen
    await expect(page.getByRole('button', { name: /Unggah Dokumen/i })).toBeVisible();

    // Cek daftar berkas hasil seed
    await expect(page.getByText(/Semua Berkas/i)).toBeVisible();
  });

  test('membuka modal preview dokumen dan menampilkan riwayat versi', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/documents');

    // Tunggu berkas dimuat dan klik berkas pertama
    const firstDoc = page.locator('.cursor-pointer').filter({ hasText: /KB|MB/i }).first();
    await expect(firstDoc).toBeVisible({ timeout: 10000 });
    await firstDoc.click();

    // Modal preview terbuka
    await expect(page.getByRole('button', { name: /Kembali ke Berkas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unduh Berkas', exact: true })).toBeVisible();
    await expect(page.getByText(/Riwayat Versi/i)).toBeVisible();

    // Tutup modal
    await page.getByRole('button', { name: /Kembali ke Berkas/i }).click();
    await expect(page.getByRole('button', { name: 'Unduh Berkas', exact: true })).not.toBeVisible();
  });

  test('menandai bintang pada dokumen', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/documents');

    // Klik tombol bintang pada kartu dokumen pertama
    const starBtn = page.locator('button[title="Tandai Bintang"]').first();
    await expect(starBtn).toBeAttached();
    await starBtn.click({ force: true });
  });
});
