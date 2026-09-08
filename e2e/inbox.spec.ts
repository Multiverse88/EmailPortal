import { test, expect } from '@playwright/test';
import { loginAsCustomer , resetDb } from './helpers';

test.describe('Inbox customer', () => {
  test.beforeEach(resetDb);

  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
  });

  test('menampilkan folder, jumlah belum dibaca, dan daftar email', async ({ page }) => {
    for (const f of ['INBOX', 'Sent', 'Drafts', 'Trash']) {
      await expect(page.getByTestId(`folder-${f}`)).toBeVisible();
    }
    await expect(page.getByTestId('unread-INBOX')).toHaveText('4');
    await expect(page.getByTestId('message-row')).toHaveCount(6);
  });

  test('membuka email menampilkan isi dan menandainya dibaca', async ({ page }) => {
    await page.getByTestId('message-row').first().click();
    await expect(page.getByTestId('message-view')).toBeVisible();
    await expect(page.getByTestId('msg-subject')).toContainText('Invoice');
    await expect(page.getByTestId('msg-body')).toContainText('INV-2025-014');
    await page.getByTestId('back').click();
    await expect(page.getByTestId('unread-INBOX')).toHaveText('3');
  });

  test('tandai belum dibaca mengembalikan hitungan', async ({ page }) => {
    await page.getByTestId('message-row').nth(1).click();
    await expect(page.getByTestId('message-view')).toBeVisible();
    await page.getByTestId('msg-unread').click();
    await expect(page.getByTestId('message-list')).toBeVisible();
    // opened (4 -> 3) then marked unread again, so we are back to the seeded 4
    await expect(page.getByTestId('unread-INBOX')).toHaveText('4');
  });

  test('bintang bisa di-toggle dari daftar', async ({ page }) => {
    const star = page.getByTestId('row-star').nth(2);
    await star.click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(star.locator('svg')).toHaveClass(/fill-amber-400/);
  });

  test('pencarian menyaring email', async ({ page }) => {
    await page.getByTestId('search-input').fill('invoice');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('message-row')).toHaveCount(1);
    await expect(page.getByTestId('message-row')).toContainText('Invoice');
  });

  test('pencarian tanpa hasil menampilkan empty state', async ({ page }) => {
    await page.getByTestId('search-input').fill('zzzznothing');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('empty-state')).toContainText('Tidak ada hasil');
  });

  test('pindah folder ke Terkirim', async ({ page }) => {
    await page.getByTestId('folder-Sent').click();
    await expect(page.getByTestId('message-row')).toHaveCount(1);
    await expect(page.getByTestId('message-row')).toContainText('Konfirmasi jadwal');
  });

  test('hapus email memindahkannya ke Sampah', async ({ page }) => {
    await page.getByTestId('message-row').last().click();
    const subject = await page.getByTestId('msg-subject').textContent();
    await page.getByTestId('msg-delete').click();
    await expect(page.getByTestId('toast')).toContainText('Sampah');
    await page.getByTestId('folder-Trash').click();
    await expect(page.getByTestId('message-row')).toContainText(subject!.slice(0, 20));
  });
});
