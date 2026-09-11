import request from 'supertest';
import jwt from 'jsonwebtoken';
import app, { prisma } from '../src/app';
import { parseIndonesianLegalText } from '../src/lib/document-extractor';
import { executeDocumentCrossCheck, normalizeEntityName, normalizeCityName } from '../src/lib/document-cross-checker';
import { validateKbliCode, extractKbliListFromText } from '../src/lib/kbli-data';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const signAdminToken = (id: string, email: string, role: 'superadmin' | 'officer') =>
  jwt.sign({ id, email, type: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });

describe('3-Layer Legal Document Metadata Extraction & Automated Cross-Check Engine', () => {
  let officerToken: string;

  beforeAll(async () => {
    officerToken = signAdminToken('officer-test-1', 'officer@clienteasylegal.co.id', 'officer');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Layer 1 & Layer 2 Heuristic Extraction & Normalization', () => {
    it('normalizes entity names correctly, removing PT, CV, and extra noise', () => {
      expect(normalizeEntityName('PT. Inovasi Teknologi Nusantara')).toBe('INOVASI TEKNOLOGI NUSANTARA');
      expect(normalizeEntityName('PERSEROAN TERBATAS INOVASI TEKNOLOGI NUSANTARA TBK')).toBe('INOVASI TEKNOLOGI NUSANTARA');
      expect(normalizeEntityName('CV Maju Bersama')).toBe('MAJU BERSAMA');
    });

    it('normalizes city names for location matching', () => {
      expect(normalizeCityName('Kota Administrasi Jakarta Selatan')).toBe('JAKARTA SELATAN');
      expect(normalizeCityName('Kabupaten Bogor')).toBe('BOGOR');
    });

    it('extracts Layer 1 and Layer 2 for Akta Notaris with full structured fields', () => {
      const sampleAktaText = `
        AKTA PENDIRIAN PERSEROAN TERBATAS
        PT MAJU TEKNOLOGI NUSANTARA
        Nomor: 24
        Pada hari ini, Senin tanggal 15 Januari 2026, berhadapan dengan saya,
        HENDRA WIJAYA, S.H., M.Kn., Notaris di Kota Administrasi Jakarta Selatan.
        Perseroan berkedudukan di Jakarta Selatan.
        Maksud dan Tujuan: KBLI 62019 Aktivitas Pemrograman Komputer Lainnya dan KBLI 70209 Konsultasi Manajemen.
        Modal Dasar: Rp 1.000.000.000,- terbagi atas 1.000 lembar saham.
        Direktur Utama: Budi Setiawan (NIK: 3171012345670001).
        Komisaris: Hendra Pratama (NIK: 3171012345670002).
      `;

      const meta = parseIndonesianLegalText(sampleAktaText, 'Akta-Pendirian.pdf', 'sample-hash-1', 4);

      // Layer 1
      expect(meta.docType).toContain('Akta');
      expect(meta.subType).toContain('Pendirian');
      expect(meta.companyName).toContain('MAJU TEKNOLOGI NUSANTARA');
      expect(meta.normalizedEntityName).toBe('MAJU TEKNOLOGI NUSANTARA');
      expect(meta.notaryName).toContain('HENDRA WIJAYA');
      expect(meta.pageCount).toBe(4);
      expect(meta.verificationStatus).toBe('otomatis');

      // Layer 2
      expect(meta.specificFields?.aktaNotaris).toBeDefined();
      expect(meta.specificFields?.aktaNotaris?.namaPerseroan).toContain('MAJU TEKNOLOGI NUSANTARA');
      expect(meta.specificFields?.aktaNotaris?.tempatKedudukan).toBe('Jakarta Selatan');
      expect(meta.specificFields?.aktaNotaris?.daftarKbli.length).toBeGreaterThan(0);
    });

    it('extracts Layer 1 and Layer 2 for SK Kemenkumham AHU with automatic classification pattern', () => {
      const sampleSkText = `
        KEPUTUSAN MENTERI HUKUM DAN HAK ASASI MANUSIA REPUBLIK INDONESIA
        NOMOR: AHU-0012345.AH.01.01.TAHUN 2026
        TENTANG PENGESAHAN PENDIRIAN BADAN HUKUM PERSEROAN TERBATAS
        PT MAJU TEKNOLOGI NUSANTARA
        Berdasarkan Akta Notaris Nomor 24 tanggal 15 Januari 2026 yang dibuat oleh Notaris HENDRA WIJAYA, S.H., M.Kn.
        Berkedudukan di Jakarta Selatan.
        Nomor Daftar Perseroan: AHU-0099887.AH.01.11.TAHUN 2026
        Tanggal: 18 Januari 2026.
      `;

      const meta = parseIndonesianLegalText(sampleSkText, 'SK-Kemenkumham.pdf');

      expect(meta.docType).toBe('SK Kemenkumham');
      expect(meta.subType).toContain('AH.01.01');
      expect(meta.publisher).toContain('Kementerian Hukum');
      expect(meta.specificFields?.skKemenkumham?.polaKlasifikasi).toBe('AH.01.01');
      expect(meta.specificFields?.skKemenkumham?.rujukanAkta).toBeDefined();
    });
  });

  describe('KBLI 2025 Validator & Deprecated Golongan Pokok 45 Detection', () => {
    it('validates official KBLI 2025 codes as valid', () => {
      const res1 = validateKbliCode('70209');
      expect(res1.isValid2025).toBe(true);
      expect(res1.isDeprecated2020).toBe(false);

      const res2 = validateKbliCode('62019');
      expect(res2.isValid2025).toBe(true);
      expect(res2.isDeprecated2020).toBe(false);
    });

    it('automatically marks Golongan Pokok 45 codes (KBLI 2020) as deprecated / invalid in 2025', () => {
      // 45101, 45201, 45301, 45401
      const res = validateKbliCode('45101', 'Perdagangan Mobil Baru');
      expect(res.isValid2025).toBe(false);
      expect(res.isDeprecated2020).toBe(true);
      expect(res.note).toContain('Golongan Pokok 45 telah dihapus pada KBLI 2025');
      expect(res.migrationAdvice).toContain('Migrasi ke KBLI 2025');
    });

    it('extracts multiple KBLI codes from text and flags deprecated codes', () => {
      const text = 'Bidang usaha perseroan adalah KBLI 70209 Konsultasi Manajemen dan KBLI 45101 Perdagangan Mobil Baru.';
      const list = extractKbliListFromText(text);
      expect(list.some((k) => k.code === '70209' && k.isValid2025)).toBe(true);
      expect(list.some((k) => k.code === '45101' && k.isDeprecated2020)).toBe(true);
    });
  });

  describe('Layer 3 Automated Cross-Check Engine (7 Core Rules)', () => {
    it('Rule 1: Identifies matching company names across documents', () => {
      const docs = [
        {
          docType: 'Akta Notaris',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'Akta No. 24',
        },
        {
          docType: 'SK Kemenkumham',
          companyName: 'PT Maju Teknologi Nusantara',
          documentNumber: 'AHU-0012345.AH.01.01.TAHUN 2026',
        },
      ];

      const findings = executeDocumentCrossCheck(docs);
      const nameFinding = findings.find((f) => f.category === 'identitas_perusahaan');
      expect(nameFinding?.status).toBe('cocok');
    });

    it('Rule 1: Identifies mismatching company names', () => {
      const docs = [
        {
          docType: 'Akta Notaris',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'Akta No. 24',
        },
        {
          docType: 'NIB OSS',
          companyName: 'PT MAJU TEKNO NUSANTARA', // Misspelled
          documentNumber: '0220108371928',
        },
      ];

      const findings = executeDocumentCrossCheck(docs);
      const nameFinding = findings.find((f) => f.category === 'identitas_perusahaan');
      expect(nameFinding?.status).toBe('tidak cocok');
      expect(nameFinding?.detail).toContain('MAJU TEKNOLOGI NUSANTARA');
    });

    it('Rule 2: Validates Akta and SK Kemenkumham reference', () => {
      const docs = [
        {
          docType: 'Akta Notaris',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'Akta No. 24',
          effectiveDate: '15 Januari 2026',
        },
        {
          docType: 'SK Kemenkumham',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'AHU-0012345.AH.01.01.TAHUN 2026',
          effectiveDate: '18 Januari 2026',
          specificFields: {
            skKemenkumham: {
              rujukanAkta: {
                nomorAkta: 'Akta No. 24',
                tanggalAkta: '15 Januari 2026',
                notaris: 'Hendra Wijaya, S.H.',
              },
            },
          },
        },
      ];

      const findings = executeDocumentCrossCheck(docs);
      const refFinding = findings.find((f) => f.category === 'rujukan_akta_sk');
      expect(refFinding?.status).toBe('cocok');
    });

    it('Rule 3: Flags deprecated KBLI Group 45 as tidak cocok / migration needed', () => {
      const docs = [
        {
          docType: 'Akta Notaris',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'Akta No. 24',
          specificFields: {
            aktaNotaris: {
              daftarKbli: [
                { kode: '45101', judul: 'Perdagangan Mobil Baru', isValid2025: false, isDeprecated2020: true },
              ],
            },
          },
        },
      ];

      const findings = executeDocumentCrossCheck(docs);
      const kbliFinding = findings.find((f) => f.category === 'kbli_2025');
      expect(kbliFinding?.status).toBe('tidak cocok');
      expect(kbliFinding?.summary).toContain('Golongan Pokok 45');
    });

    it('Rule 5: Flags foreign shareholder with PMDN NIB as tidak cocok', () => {
      const docs = [
        {
          docType: 'Akta Notaris',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: 'Akta No. 24',
          specificFields: {
            aktaNotaris: {
              pemegangSaham: [
                { nama: 'John Doe', kewarganegaraan: 'WNA', jumlahSaham: 100, persentaseSaham: '50%' },
              ],
            },
          },
        },
        {
          docType: 'NIB OSS',
          companyName: 'PT MAJU TEKNOLOGI NUSANTARA',
          documentNumber: '0220108371928',
          specificFields: {
            nibOss: {
              statusPmaPmdn: 'PMDN', // Conflict! Should be PMA
            },
          },
        },
      ];

      const findings = executeDocumentCrossCheck(docs);
      const pmaFinding = findings.find((f) => f.category === 'status_pma');
      expect(pmaFinding?.status).toBe('tidak cocok');
      expect(pmaFinding?.summary).toContain('Pelanggaran Status PMA');
    });
  });

  describe('API Endpoints for 3-Layer Document Operations', () => {
    it('POST /api/admin/documents/cross-check executes multi-document analysis', async () => {
      const res = await request(app)
        .post('/api/admin/documents/cross-check')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          documentPayloads: [
            {
              docType: 'Akta Notaris',
              companyName: 'PT INDO PERSADA GLOBAL',
              documentNumber: 'Akta No. 12',
              cityLocation: 'Jakarta Selatan',
            },
            {
              docType: 'NIB OSS',
              companyName: 'PT INDO PERSADA GLOBAL',
              documentNumber: '0987654321012',
              registeredAddress: 'Jakarta Selatan',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.findings)).toBe(true);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.cocokCount).toBeGreaterThan(0);
    });
  });
});
