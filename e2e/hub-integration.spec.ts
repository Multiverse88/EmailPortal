import { test, expect } from '@playwright/test';
import { loginAsCustomer, resetDb } from './helpers';

test.describe('EasyLegal Hub - End-to-End Suite Integration', () => {
  test.beforeEach(resetDb);

  test('navigasi lengkap lintas aplikasi EasyLegal Hub via App Launcher', async ({ page }) => {
    // 1. Login sebagai Customer -> /inbox
    await loginAsCustomer(page);
    await expect(page).toHaveURL(/\/inbox/);

    // 2. Navigasi ke Legal Documents via App Launcher
    await page.getByTestId('app-launcher-btn').click();
    await page.getByTestId('app-launcher-item-documents').click();
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.getByText('EasyLegal', { exact: true })).toBeVisible();
    await expect(page.getByText('Drive', { exact: true })).toBeVisible();

    // 3. Dari Documents navigasi ke Support Desk via App Launcher
    await page.getByTestId('app-launcher-btn').click();
    await page.getByTestId('app-launcher-item-support').click();
    await expect(page).toHaveURL(/\/support/);
    await expect(page.getByText(/Pusat Bantuan & Layanan Pelanggan/i)).toBeVisible();

    // 4. Dari Support navigasi ke Settings & Security via App Launcher
    await page.getByTestId('app-launcher-btn').click();
    await page.getByTestId('app-launcher-item-settings').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/Pengaturan Akun & Keamanan/i)).toBeVisible();

    // 5. Dari Settings navigasi kembali ke Mailbox via App Launcher
    await page.getByTestId('app-launcher-btn').click();
    await page.getByTestId('app-launcher-item-mail').click();
    await expect(page).toHaveURL(/\/inbox/);
    await expect(page.getByTestId('message-list')).toBeVisible();
  });
});
