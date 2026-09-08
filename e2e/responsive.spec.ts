import { test, expect } from '@playwright/test';
import { login, CUSTOMER , resetDb } from './helpers';

// NFR Kompatibilitas: panel harus tetap terpakai di layar mobile.
test.describe('Tampilan mobile', () => {
  test.beforeAll(resetDb);

  test('login form muat tanpa scroll horizontal', async ({ page }) => {
    await page.goto('/login');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test('sidebar tersembunyi dan dibuka lewat tombol menu', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    await expect(page.getByTestId('sidebar')).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await page.getByTestId('folder-Sent').click();
    await expect(page.getByTestId('sidebar')).toBeHidden();
  });

  test('daftar email tidak meluber di layar sempit', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    await expect(page.getByTestId('message-list')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test('pengirim tetap terlihat di daftar email mobile', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    // Regression: sender was `hidden sm:block`, so on a phone you could not tell
    // who an email came from.
    await expect(page.getByTestId('message-row').first()).toContainText('billing@vendor.co.id');
  });

  test('backdrop menutup sidebar saat disentuh di luar', async ({ page }) => {
    await login(page, CUSTOMER, 'customer');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    // the backdrop spans the viewport, so its centre sits *under* the 240px
    // drawer — tap to the right of the drawer instead
    await page.getByTestId('sidebar-backdrop').click({ position: { x: 340, y: 300 } });
    await expect(page.getByTestId('sidebar')).toBeHidden();
  });
});
