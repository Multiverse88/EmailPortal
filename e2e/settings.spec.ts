import { test, expect } from '@playwright/test';
import { login, loginAsCustomer, CUSTOMER , resetDb } from './helpers';

test.describe('Pengaturan akun', () => {
  test.beforeEach(resetDb);

  test('menolak password lama yang salah', async ({ page }) => {
    await loginAsCustomer(page);
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('account-email')).toHaveText(CUSTOMER.email);

    await page.getByTestId('pw-current').fill('SalahLama123');
    await page.getByTestId('pw-new').fill('BaruAman123');
    await page.getByTestId('pw-confirm').fill('BaruAman123');
    await page.getByTestId('pw-submit').click();
    await expect(page.getByTestId('pw-error')).toContainText('Password saat ini salah');
  });

  test('menolak password baru yang lemah', async ({ page }) => {
    await loginAsCustomer(page);
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('pw-current').fill(CUSTOMER.password);
    await page.getByTestId('pw-new').fill('lemah');
    await page.getByTestId('pw-confirm').fill('lemah');
    await page.getByTestId('pw-submit').click();
    await expect(page.getByTestId('pw-error')).toContainText('minimal 8 karakter');
  });

  test('menolak konfirmasi yang tidak cocok', async ({ page }) => {
    await loginAsCustomer(page);
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('pw-current').fill(CUSTOMER.password);
    await page.getByTestId('pw-new').fill('BaruAman123');
    await page.getByTestId('pw-confirm').fill('BedaLagi123');
    await page.getByTestId('pw-submit').click();
    await expect(page.getByTestId('pw-error')).toContainText('tidak cocok');
  });

  test('mengganti password lalu login dengan password baru', async ({ page }) => {
    const next = 'PasswordBaru123';
    await loginAsCustomer(page);
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('pw-current').fill(CUSTOMER.password);
    await page.getByTestId('pw-new').fill(next);
    await page.getByTestId('pw-confirm').fill(next);
    await page.getByTestId('pw-submit').click();
    await expect(page.getByTestId('pw-success')).toBeVisible();

    await page.getByTestId('back-inbox').click();
    await page.getByTestId('logout').click();
    await login(page, { email: CUSTOMER.email, password: next }, 'customer');

    // restore so the rest of the suite keeps the seeded password
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('pw-current').fill(next);
    await page.getByTestId('pw-new').fill(CUSTOMER.password);
    await page.getByTestId('pw-confirm').fill(CUSTOMER.password);
    await page.getByTestId('pw-submit').click();
    await expect(page.getByTestId('pw-success')).toBeVisible();
  });

  test('navigasi antar tab dan dukungan URL parameter ?tab=security', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/settings?tab=general');
    await expect(page.getByTestId('select-language')).toBeVisible();

    // Pindah ke tab Profile
    await page.getByTestId('tab-profile').click();
    await expect(page.getByText('Rincian Identitas Mailbox')).toBeVisible();

    // Pindah ke tab Notifications
    await page.getByTestId('tab-notifications').click();
    await expect(page.getByTestId('toggle-notify-email')).toBeVisible();

    // Pindah ke tab Security & Activity
    await page.getByTestId('tab-security').click();
    await expect(page.getByTestId('toggle-2fa')).toBeVisible();
    await expect(page.getByTestId('pw-current')).toBeVisible();

    // Akses langsung ?tab=security
    await page.goto('/settings?tab=security');
    await expect(page.getByTestId('toggle-2fa')).toBeVisible();
  });

  test('mengaktifkan dan menonaktifkan fitur 2FA', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/settings?tab=security');

    // Pastikan tombol toggle 2FA ada
    const toggleBtn = page.getByTestId('toggle-2fa');
    await expect(toggleBtn).toBeVisible();

    // Toggle 2FA to ON
    await toggleBtn.click();
    await expect(page.getByTestId('badge-2fa-on')).toBeVisible();

    // Toggle 2FA to OFF
    await toggleBtn.click();
    await expect(page.getByTestId('badge-2fa-off')).toBeVisible();
  });

  test('menghentikan sesi login perangkat lain', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/settings?tab=security');

    // Handle dialog konfirmasi
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const terminateBtn = page.getByTestId('terminate-sessions-btn');
    await expect(terminateBtn).toBeVisible();
    await terminateBtn.click();

    // Verifikasi pesan konfirmasi berhasil
    await expect(page.getByText(/berhasil dihentikan/i)).toBeVisible();
  });

  test('menyimpan preferensi umum dan preferensi notifikasi', async ({ page }) => {
    await loginAsCustomer(page);

    // Tab General
    await page.goto('/settings?tab=general');
    await page.getByTestId('select-language').selectOption('en');
    await page.getByTestId('select-timezone').selectOption('Asia/Makassar');
    await page.getByTestId('input-signature').fill('Best regards,\nBudi Client\nEasyLegal Corp');
    await page.getByTestId('save-general-prefs').click();
    await expect(page.getByTestId('general-success')).toBeVisible();

    // Tab Notifications
    await page.getByTestId('tab-notifications').click();
    await page.getByTestId('toggle-notify-sound').click();
    await page.getByTestId('save-notification-prefs').click();
    await expect(page.getByTestId('notif-success')).toBeVisible();
  });
});
