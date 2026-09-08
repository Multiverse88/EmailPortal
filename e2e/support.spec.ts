import { test, expect } from '@playwright/test';
import { loginAsCustomer, resetDb } from './helpers';

test.describe('Support Desk & Ticket Thread', () => {
  test.beforeEach(resetDb);

  test('menampilkan pusat bantuan, daftar tiket dan accordion FAQ', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/support');

    // Pastikan header Support dan banner muncul
    await expect(page.getByText('EasyLegal', { exact: true })).toBeVisible();
    await expect(page.getByText('Support', { exact: true })).toBeVisible();
    await expect(page.getByText(/Pusat Bantuan & Layanan Pelanggan/i)).toBeVisible();

    // Tombol buat tiket
    await expect(page.getByRole('button', { name: /Buat Tiket Bantuan/i })).toBeVisible();

    // FAQ section
    await expect(page.getByText(/Tanya Jawab \(FAQ\)/i)).toBeVisible();
    await expect(page.getByText(/Bagaimana cara membagikan dokumen hukum secara aman\?/i)).toBeVisible();
  });

  test('membuka thread percakapan tiket dan mengirim balasan', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/support');

    // Klik tiket pertama dari daftar
    const ticketCard = page.locator('.cursor-pointer').filter({ hasText: /Kategori:/i }).first();
    await expect(ticketCard).toBeVisible({ timeout: 10000 });
    await ticketCard.click();

    // Modal percakapan terbuka
    await expect(page.getByRole('button', { name: /Kembali/i })).toBeVisible();
    await expect(page.getByText(/Catatan Internal/i).first()).toBeVisible();

    // Kirim balasan
    const replyInput = page.getByPlaceholder(/Ketik balasan Anda ke tim support/i);
    await expect(replyInput).toBeVisible();
    await replyInput.fill('Terima kasih, dokumen revisi sudah kami cek dan sesuai kebutuhan.');
    await page.getByRole('button', { name: /Kirim Balasan/i }).click();

    // Pesan baru muncul dalam thread
    await expect(
      page.getByText('Terima kasih, dokumen revisi sudah kami cek dan sesuai kebutuhan.')
    ).toBeVisible({ timeout: 10000 });

    // Tutup thread modal
    await page.getByRole('button', { name: /Kembali/i }).click();
    await expect(page.getByPlaceholder(/Ketik balasan Anda ke tim support/i)).not.toBeVisible();
  });

  test('menutup tiket sebagai selesai (resolved)', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/support');

    // Auto-accept window.confirm dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Buka tiket pertama yang berstatus open
    const ticketCard = page.locator('.cursor-pointer').filter({ hasText: /Open/i }).first();
    await expect(ticketCard).toBeVisible({ timeout: 10000 });
    await ticketCard.click();

    // Klik tombol Tutup Tiket
    const closeBtn = page.getByRole('button', { name: /Tutup Tiket/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Badge status berubah menjadi Selesai dan composer digantikan info tertutup
    await expect(page.getByText(/Tiket ini telah ditutup dan diselesaikan/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('membuat tiket bantuan baru melalui formulir modal', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/support');

    // Buka modal Buat Tiket
    await page.getByRole('button', { name: /Buat Tiket Bantuan/i }).click();
    await expect(page.getByText('Buat Tiket Bantuan Baru')).toBeVisible();

    // Isi formulir
    await page.getByPlaceholder(/Mis\. Kendala verifikasi/i).fill('Pertanyaan Integrasi API Baru');
    await page.getByPlaceholder(/Jelaskan kendala Anda secara detail/i).fill(
      'Halo tim EasyLegal, kami membutuhkan petunjuk teknis webhook integrasi dokumen terbaru.'
    );

    // Kirim formulir
    await page.getByRole('button', { name: /Ajukan Tiket/i }).click();

    // Otomatis membuka modal thread tiket yang baru dibuat
    await expect(page.getByText('Pertanyaan Integrasi API Baru')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Halo tim EasyLegal, kami membutuhkan petunjuk teknis webhook/i)
    ).toBeVisible();
  });
});
