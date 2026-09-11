/**
 * KBLI (Klasifikasi Baku Lapangan Usaha Indonesia) 2025 Reference & Validator
 *
 * Sesuai regulasi penyesuaian KBLI 2025:
 * - Kode KBLI 2020 tertentu telah dihapus, dimekarkan, atau direklasifikasi.
 * - Golongan Pokok 45 (Perdagangan dan Reparasi Mobil dan Sepeda Motor, seperti 45101, 45201, 45301, 45401, dsb.)
 *   telah DIHAPUS dan DIMEKARKAN pada KBLI 2025 ke kelompok 46, 47, atau 95.
 * - Tenggat migrasi KBLI 2025 telah berakhir sehingga setiap entitas yang masih menggunakan
 *   KBLI 2020 lama otomatis ditandai untuk dilakukan penyesuaian anggaran dasar / OSS.
 */

export interface KbliItem {
  code: string;
  title: string;
  riskLevel?: 'Rendah' | 'Menengah Rendah' | 'Menengah Tinggi' | 'Tinggi';
  version: '2025' | '2020_deprecated';
  migrationNote?: string;
}

// Katalog KBLI 2025 Utama (Paling sering digunakan korporasi, PT, CV, dan PMA)
export const KBLI_2025_CATALOG: Record<string, { title: string; riskLevel: 'Rendah' | 'Menengah Rendah' | 'Menengah Tinggi' | 'Tinggi' }> = {
  // Aktivitas Konsultasi & Jasa Profesional (Golongan Pokok 70, 69, 71, 74)
  '70209': { title: 'Aktivitas Konsultasi Manajemen Lainnya', riskLevel: 'Rendah' },
  '70201': { title: 'Aktivitas Konsultasi Manajemen Umum', riskLevel: 'Rendah' },
  '69101': { title: 'Aktivitas Pengacara/Penasihat Hukum', riskLevel: 'Rendah' },
  '69102': { title: 'Aktivitas Notaris dan PPAT', riskLevel: 'Rendah' },
  '69201': { title: 'Aktivitas Akuntansi, Pembukuan dan Pemeriksa (Audit)', riskLevel: 'Menengah Rendah' },
  '71101': { title: 'Aktivitas Arsitektur', riskLevel: 'Menengah Rendah' },
  '71102': { title: 'Aktivitas Keinsinyuran dan Konsultasi Teknis', riskLevel: 'Menengah Rendah' },
  '73100': { title: 'Periklanan', riskLevel: 'Rendah' },
  '74902': { title: 'Aktivitas Penerjemah dan Juru Bahasa', riskLevel: 'Rendah' },

  // Teknologi Informasi & Komunikasi (Golongan Pokok 62, 63)
  '62019': { title: 'Aktivitas Pemrograman Komputer Lainnya', riskLevel: 'Rendah' },
  '62011': { title: 'Aktivitas Pemrograman Berbasis Web', riskLevel: 'Rendah' },
  '62012': { title: 'Aktivitas Pemrograman Aplikasi Perangkat Bergerak', riskLevel: 'Rendah' },
  '62021': { title: 'Aktivitas Konsultasi Keamanan Informasi', riskLevel: 'Menengah Rendah' },
  '62090': { title: 'Aktivitas Teknologi Informasi dan Jasa Komputer Lainnya', riskLevel: 'Rendah' },
  '63111': { title: 'Aktivitas Pengolahan Data (Hosting & Cloud Services)', riskLevel: 'Rendah' },
  '63122': { title: 'Portal Web dan/atau Platform Digital Dengan Tujuan Komersial', riskLevel: 'Menengah Rendah' },

  // Perdagangan Besar (Golongan Pokok 46)
  '46100': { title: 'Perdagangan Besar Atas Dasar Balas Jasa (Fee) Atau Kontrak', riskLevel: 'Rendah' },
  '46511': { title: 'Perdagangan Besar Komputer dan Perlengkapannya', riskLevel: 'Rendah' },
  '46512': { title: 'Perdagangan Besar Piranti Lunak (Software)', riskLevel: 'Rendah' },
  '46521': { title: 'Perdagangan Besar Perlengkapan Telekomunikasi', riskLevel: 'Rendah' },
  '46311': { title: 'Perdagangan Besar Beras', riskLevel: 'Menengah Rendah' },
  '46321': { title: 'Perdagangan Besar Daging dan Olahan', riskLevel: 'Menengah Tinggi' },
  '46411': { title: 'Perdagangan Besar Tekstil', riskLevel: 'Rendah' },
  '46693': { title: 'Perdagangan Besar Bahan dan Barang Kimia', riskLevel: 'Tinggi' },
  '46900': { title: 'Perdagangan Besar Berbagai Macam Barang (General Trading)', riskLevel: 'Rendah' },

  // Perdagangan Eceran (Golongan Pokok 47)
  '47111': { title: 'Perdagangan Eceran Berbagai Macam Barang Utamanya Makanan, Minuman, atau Tembakau di Minimarket/Supermarket', riskLevel: 'Menengah Rendah' },
  '47411': { title: 'Perdagangan Eceran Komputer dan Perlengkapannya', riskLevel: 'Rendah' },
  '47413': { title: 'Perdagangan Eceran Telepon Seluler dan Aksesori', riskLevel: 'Rendah' },
  '47911': { title: 'Perdagangan Eceran Melalui Media (Online Shop / E-Commerce)', riskLevel: 'Rendah' },

  // Konstruksi & Real Estat (Golongan Pokok 41, 42, 43, 68)
  '41011': { title: 'Konstruksi Gedung Hunian', riskLevel: 'Menengah Tinggi' },
  '41012': { title: 'Konstruksi Gedung Perkantoran', riskLevel: 'Menengah Tinggi' },
  '43211': { title: 'Instalasi Listrik', riskLevel: 'Menengah Tinggi' },
  '68111': { title: 'Real Estat Yang Dimiliki Sendiri Atau Disewa', riskLevel: 'Menengah Rendah' },

  // Pengangkutan, Pergudangan & Logistik (Golongan Pokok 49, 52)
  '49431': { title: 'Angkutan Bermotor untuk Barang Umum', riskLevel: 'Menengah Tinggi' },
  '52101': { title: 'Pergudangan dan Penyimpanan', riskLevel: 'Menengah Rendah' },
  '52291': { title: 'Jasa Pengurusan Transportasi (Freight Forwarding)', riskLevel: 'Menengah Rendah' },

  // Makanan & Minuman / Pariwisata (Golongan Pokok 56)
  '56101': { title: 'Restoran', riskLevel: 'Menengah Rendah' },
  '56301': { title: 'Kafe / Bar', riskLevel: 'Menengah Rendah' },
  '56210': { title: 'Jasa Boga untuk Suatu Event Tertentu (Catering)', riskLevel: 'Menengah Rendah' },
};

/**
 * Daftar Golongan Pokok 45 (KBLI 2020) yang DIHAPUS / DIMEKARKAN pada KBLI 2025.
 * Semua kode yang diawali dengan '45' wajib ditandai sebagai USANG / PERLU MIGRASI KBLI 2025.
 */
export const DEPRECATED_KBLI_2020_GROUP_45: Record<string, { title: string; migrationTarget: string }> = {
  '45101': { title: 'Perdagangan Besar Mobil Baru', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 46 (Perdagangan Besar)' },
  '45102': { title: 'Perdagangan Besar Mobil Bekas', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 46 (Perdagangan Besar)' },
  '45103': { title: 'Perdagangan Eceran Mobil Baru', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 47 (Perdagangan Eceran)' },
  '45104': { title: 'Perdagangan Eceran Mobil Bekas', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 47 (Perdagangan Eceran)' },
  '45201': { title: 'Reparasi dan Perawatan Mobil', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 95 (Reparasi Komputer & Barang Personal/Kendaraan)' },
  '45202': { title: 'Pencucian dan Salon Mobil', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 95 / Jasa Perawatan' },
  '45301': { title: 'Perdagangan Besar Suku Cadang dan Aksesori Mobil', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 46' },
  '45302': { title: 'Perdagangan Eceran Suku Cadang dan Aksesori Mobil', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 47' },
  '45401': { title: 'Perdagangan Besar Sepeda Motor Baru dan Bekas', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 46' },
  '45402': { title: 'Perdagangan Eceran Sepeda Motor Baru dan Bekas', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 47' },
  '45403': { title: 'Perdagangan Besar Suku Cadang dan Aksesori Sepeda Motor', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 46' },
  '45404': { title: 'Perdagangan Eceran Suku Cadang dan Aksesori Sepeda Motor', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 47' },
  '45405': { title: 'Reparasi dan Perawatan Sepeda Motor', migrationTarget: 'Migrasi ke KBLI 2025 Golongan Pokok 95' },
};

export interface KbliValidationResult {
  code: string;
  title: string;
  isValid2025: boolean;
  isDeprecated2020: boolean;
  riskLevel?: 'Rendah' | 'Menengah Rendah' | 'Menengah Tinggi' | 'Tinggi';
  note?: string;
  migrationAdvice?: string;
}

/**
 * Validates any 5-digit KBLI code against the KBLI 2025 specification.
 * Automatically flags deprecated KBLI 2020 codes (especially Group 45).
 */
export function validateKbliCode(rawCode: string, rawTitle = ''): KbliValidationResult {
  const code = rawCode.trim().replace(/\D/g, '');

  // Cek apakah kode diawali '45' (Golongan Pokok 45 KBLI 2020 yang hilang)
  if (code.startsWith('45')) {
    const deprecatedMeta = DEPRECATED_KBLI_2020_GROUP_45[code];
    const title = rawTitle || deprecatedMeta?.title || `Perdagangan/Reparasi Kendaraan Bermotor (${code})`;
    return {
      code,
      title,
      isValid2025: false,
      isDeprecated2020: true,
      note: 'KBLI 2020 Kedaluwarsa: Golongan Pokok 45 telah dihapus pada KBLI 2025.',
      migrationAdvice: deprecatedMeta?.migrationTarget || 'Wajib migrasi ke Golongan Pokok 46/47/95 pada sistem OSS RBA.',
    };
  }

  // Cek apakah terdaftar di katalog resmi 2025
  const official = KBLI_2025_CATALOG[code];
  if (official) {
    return {
      code,
      title: official.title,
      isValid2025: true,
      isDeprecated2020: false,
      riskLevel: official.riskLevel,
      note: 'Valid KBLI 2025',
    };
  }

  // Format 5 digit standar yang sah di KBLI 2025
  if (code.length === 5 && !code.startsWith('45')) {
    return {
      code,
      title: rawTitle || `Aktivitas Usaha KBLI ${code}`,
      isValid2025: true,
      isDeprecated2020: false,
      riskLevel: 'Rendah',
      note: 'Terformat 5 Digit Standar KBLI 2025',
    };
  }

  return {
    code,
    title: rawTitle || 'Kode Tidak Standar',
    isValid2025: false,
    isDeprecated2020: false,
    note: 'Panjang kode tidak sesuai format 5 digit resmi OSS.',
  };
}

/**
 * Scans text to extract KBLI codes (5 digits) with their accompanying titles
 */
export function extractKbliListFromText(text: string): KbliValidationResult[] {
  const results: KbliValidationResult[] = [];
  const seenCodes = new Set<string>();

  // Pattern 1: KBLI 12345 (Judul)
  const pattern1 = /(?:KBLI|Kode|Bidang Usaha)[^\d\n\r]{0,20}(\d{5})\s*[-–:]?\s*([A-Za-z0-9\s,\(\)\/]{3,80})/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern1.exec(text)) !== null) {
    const code = match[1];
    const rawTitle = match[2]?.trim().replace(/[\r\n\t]+/g, ' ');
    if (!seenCodes.has(code)) {
      seenCodes.add(code);
      results.push(validateKbliCode(code, rawTitle));
    }
  }

  // Pattern 2: standalone 5 digits preceded or followed by KBLI
  const pattern2 = /\b(\d{5})\b(?:\s*[-–]\s*([A-Za-z\s,]{4,60}))?/g;
  while ((match = pattern2.exec(text)) !== null) {
    const code = match[1];
    // Pastikan bukan kode pos, tahun, atau angka acak
    if (!seenCodes.has(code) && (text.includes('KBLI') || code.startsWith('70') || code.startsWith('62') || code.startsWith('46') || code.startsWith('47') || code.startsWith('45'))) {
      const rawTitle = match[2]?.trim();
      seenCodes.add(code);
      results.push(validateKbliCode(code, rawTitle));
    }
  }

  return results;
}
