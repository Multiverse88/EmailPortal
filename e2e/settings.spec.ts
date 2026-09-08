import { test, expect } from '@playwright/test';
import { login, loginAsCustomer, CUSTOMER , resetDb } from './helpers';

test.describe('Pengaturan akun', () => {
  test.beforeAll(resetDb);

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
});
