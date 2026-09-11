import {
  detectMagicBytes,
  scanAttachmentBuffer,
  scanEmailContent,
} from '../src/lib/security-scanner';
import { generateThreatCardPng } from '../src/lib/card-generator';

describe('Security Scanner & AI Threat Shield Engine', () => {
  describe('detectMagicBytes', () => {
    it('should correctly detect Windows PE Executable (MZ header)', () => {
      const peBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
      const res = detectMagicBytes(peBuffer);
      expect(res.isExecutable).toBe(true);
      expect(res.type).toBe('windows-pe-executable');
    });

    it('should correctly detect Linux ELF Executable', () => {
      const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01]);
      const res = detectMagicBytes(elfBuffer);
      expect(res.isExecutable).toBe(true);
      expect(res.type).toBe('linux-elf-executable');
    });

    it('should correctly detect genuine PDF header', () => {
      const pdfBuffer = Buffer.from('%PDF-1.7\nSample content');
      const res = detectMagicBytes(pdfBuffer);
      expect(res.isExecutable).toBe(false);
      expect(res.type).toBe('pdf');
    });

    it('should correctly detect genuine PNG header', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
      const res = detectMagicBytes(pngBuffer);
      expect(res.isExecutable).toBe(false);
      expect(res.type).toBe('png');
    });
  });

  describe('scanAttachmentBuffer', () => {
    it('should quarantine blacklisted dangerous executable files (.exe, .scr, .bat)', () => {
      const exeRes = scanAttachmentBuffer('payload.exe', Buffer.from('dummy data'));
      expect(exeRes.status).toBe('quarantined');
      expect(exeRes.threatType).toContain('Executable');

      const scrRes = scanAttachmentBuffer('screensaver.scr', Buffer.from('dummy data'));
      expect(scrRes.status).toBe('quarantined');

      const batRes = scanAttachmentBuffer('script.bat', Buffer.from('echo test'));
      expect(batRes.status).toBe('quarantined');
    });

    it('should quarantine double-extension attack trickery (.pdf.exe, .xlsx.scr)', () => {
      const attackRes = scanAttachmentBuffer('Surat_Perjanjian.pdf.exe', Buffer.from('harmless looking bytes'));
      expect(attackRes.status).toBe('quarantined');
      expect(attackRes.threatType).toContain('Double Extension');
    });

    it('should quarantine disguised executables disguised as PDF (PE header with .pdf name)', () => {
      const disguisedPe = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x00, 0x00]);
      const disguisedRes = scanAttachmentBuffer('kontrak_resmi.pdf', disguisedPe);
      expect(disguisedRes.status).toBe('quarantined');
      expect(disguisedRes.threatType).toContain('Payload Executable Terselubung');
    });

    it('should pass genuine clean documents and images', () => {
      const cleanPdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj');
      const cleanRes = scanAttachmentBuffer('perjanjian_kerjasama.pdf', cleanPdf);
      expect(cleanRes.status).toBe('clean');
      expect(cleanRes.details).toContain('Terverifikasi aman');

      const cleanPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const cleanPngRes = scanAttachmentBuffer('lampiran_foto.png', cleanPng);
      expect(cleanPngRes.status).toBe('clean');
    });

    it('should quarantine ZIP archive containing hidden dangerous executables', () => {
      // Build a minimal synthetic ZIP local file header containing "trojan.exe"
      const entryName = 'trojan.exe';
      const nameBuffer = Buffer.from(entryName, 'utf8');
      const zipHeader = Buffer.alloc(30 + nameBuffer.length);
      zipHeader[0] = 0x50;
      zipHeader[1] = 0x4B;
      zipHeader[2] = 0x03;
      zipHeader[3] = 0x04;
      zipHeader.writeUInt16LE(nameBuffer.length, 26); // file name length
      zipHeader.writeUInt16LE(0, 28); // extra field length
      nameBuffer.copy(zipHeader, 30);

      const zipRes = scanAttachmentBuffer('arsip_dokumen.zip', zipHeader);
      expect(zipRes.status).toBe('quarantined');
      expect(zipRes.threatType).toContain('ZIP');
    });
  });

  describe('scanEmailContent (Anti-Spam & Anti-Scam)', () => {
    it('should verify clean legitimate business emails', () => {
      const cleanEmail = scanEmailContent({
        sender: 'notaris@kantor-notaris.co.id',
        subject: 'Draft Perjanjian Sewa Kantor 2026',
        bodyText: 'Yth. Bapak/Ibu, Terlampir kami sampaikan draf akta untuk ditinjau.',
      });
      expect(cleanEmail.status).toBe('clean');
      expect(cleanEmail.threats.length).toBe(0);
      expect(cleanEmail.spamScore).toBeLessThan(30);
    });

    it('should detect brand impersonation / display name spoofing', () => {
      const spoofedEmail = scanEmailContent({
        sender: 'Bank Mandiri Official <fraud@random-hacker-mail.xyz>',
        subject: 'Pembaruan Layanan Mandiri',
        bodyText: 'Silakan verifikasi akun Anda.',
      });
      expect(spoofedEmail.status).toBe('threat');
      expect(spoofedEmail.threats.some((t) => t.includes('Pemalsuan Identitas'))).toBe(true);
    });

    it('should detect phishing urgency and coercion extortion patterns', () => {
      const phishingEmail = scanEmailContent({
        sender: 'support@billing-info.org',
        subject: 'Peringatan: Akun Anda akan diblokir dalam 24 jam',
        bodyText: 'Segera verifikasi kata sandi Anda sekarang sebelum akses dinonaktifkan permanen.',
      });
      expect(phishingEmail.status).toBe('threat');
      expect(phishingEmail.threats.some((t) => t.includes('Pola Rekayasa Sosial'))).toBe(true);
    });

    it('should detect deceptive HTML link discrepancy', () => {
      const deceptiveEmail = scanEmailContent({
        sender: 'admin@notifikasi-info.net',
        subject: 'Akses Dokumen EasyLegal',
        bodyHtml: '<p>Klik tautan ini: <a href="http://malicious-phish-domain.ru/steal">https://clienteasylegal.co.id/login</a></p>',
      });
      expect(deceptiveEmail.status).toBe('threat');
      expect(deceptiveEmail.threats.some((t) => t.includes('Tautan Palsu'))).toBe(true);
    });
  });

  describe('generateThreatCardPng', () => {
    it('should generate a high-resolution PNG card for threat alert', async () => {
      const cardBuffer = await generateThreatCardPng({
        accountName: 'PT Maju Bersama',
        mailboxAddress: 'info@majubersama.co.id',
        sender: 'scam@phish-attacker.ru',
        subject: 'URGENT: Verify your account',
        threatType: 'Payload Executable Terselubung (windows-pe-executable)',
        threatDetails: 'Header biner berkas teridentifikasi sebagai windows-pe-executable meski berekstensi .pdf',
        filename: 'dokumen_pajak.pdf',
        fileSizeStr: '124.5 KB',
        actionTaken: 'Berkas Dikarantina Otomatis (Akses Unduh Ditangguhkan)',
      });

      expect(cardBuffer).toBeDefined();
      expect(Buffer.isBuffer(cardBuffer)).toBe(true);
      if (cardBuffer) {
        expect(cardBuffer.length).toBeGreaterThan(1000);
      }
    });
  });
});
