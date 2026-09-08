import { test, expect } from '@playwright/test';
import { loginAsCustomer, resetDb } from './helpers';

test.describe('App Launcher & Cross-App Navigation', () => {
  test.beforeEach(resetDb);

  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
  });

  test('menampilkan tombol launcher 9-dots dan membuka popover', async ({ page }) => {
    const launcherBtn = page.getByTestId('app-launcher-btn');
    await expect(launcherBtn).toBeVisible();

    // Open popover
    await launcherBtn.click();
    const popover = page.getByTestId('app-launcher-popover');
    await expect(popover).toBeVisible();

    // Verify apps list
    await expect(page.getByTestId('app-launcher-item-mail')).toBeVisible();
    await expect(page.getByTestId('app-launcher-item-documents')).toBeVisible();
    await expect(page.getByTestId('app-launcher-item-support')).toBeVisible();
    await expect(page.getByTestId('app-launcher-item-settings')).toBeVisible();

    // Verify current app badge
    await expect(page.getByTestId('app-launcher-item-mail')).toContainText('Aktif');

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible();

    // Reopen and close on outside click
    await launcherBtn.click();
    await expect(popover).toBeVisible();
    await page.getByTestId('refresh').click();
    await expect(popover).not.toBeVisible();
  });

  test('navigasi ke Settings dari launcher popover', async ({ page }) => {
    await page.getByTestId('app-launcher-btn').click();
    await page.getByTestId('app-launcher-item-settings').click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('menampilkan menu navigasi aplikasi di bagian bawah sidebar', async ({ page }) => {
    await expect(page.getByTestId('nav-sidebar-documents')).toBeVisible();
    await expect(page.getByTestId('nav-sidebar-support')).toBeVisible();
    await expect(page.getByTestId('nav-sidebar-settings')).toBeVisible();

    // Test clicking settings from sidebar
    await page.getByTestId('nav-sidebar-settings').click();
    await expect(page).toHaveURL(/\/settings/);
  });
});
