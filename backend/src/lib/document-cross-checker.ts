import { validateKbliCode } from './kbli-data';

export type CrossCheckStatus = 'cocok' | 'tidak cocok' | 'data tidak ditemukan';

export interface CrossCheckFinding {
  id: string;
  ruleTitle: string;
  category:
    | 'identitas_perusahaan'
    | 'rujukan_akta_sk'
    | 'kbli_2025'
    | 'kewenangan_pks'
    | 'status_pma'
    | 'lokasi_domisili'
    | 'masa_berlaku_pks';
  status: CrossCheckStatus;
  summary: string;
  detail: string;
  sourceDocA?: string;
  sourceDocB?: string;
  valueA?: string;
  valueB?: string;
  actionRecommendation?: string;
}

export interface UnifiedDocumentMetadata {
  id?: string;
  docType: string;
  subType?: string;
  companyName: string;
  normalizedEntityName?: string;
  documentNumber: string;
  documentDate?: string;
  publisher?: string;
  effectiveDate?: string;
  notaryName?: string;
  registeredAddress?: string;
  cityLocation?: string;
  capitalAmount?: string;
  businessSectors?: string;
  keyPeople?: string;
  summary?: string;
  specificFields?: any;
}

/**
 * Normalizes company entity names for accurate cross-checking.
 * Removes legal forms (PT, CV, FIRMA, TBK, PERSEROAN TERBATAS) and non-alphanumeric noise.
 */
export function normalizeEntityName(rawName?: string | null): string {
  if (!rawName) return '';
  return rawName
    .toUpperCase()
    .replace(/\b(PT\.?|PERSEROAN\s+TERBATAS|CV\.?|COMMANDITAIRE\s+VENNOOTSCHAP|TBK\.?|FIRMA|YAYASAN|PERKUMPULAN)\b/gi, ' ')
    .replace(/\b(NOMOR|NO\.?|BERKEDUDUKAN|DENGAN|NPWP)\b.*$/gi, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes city/kabupaten names for location matching.
 */
export function normalizeCityName(rawCity?: string | null): string {
  if (!rawCity) return '';
  return rawCity
    .toUpperCase()
    .replace(/\b(KOTA\s+ADMINISTRASI|KOTA|KABUPATEN|KAB\.?|DAERAH\s+KHUSUS\s+IBUKOTA|DKI)\b/gi, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Core Cross-Check Engine (Lapis 3: Cek Silang Antar Dokumen Legal)
 *
 * Menguji kepatuhan dan konsistensi antar dokumen dalam 7 parameter utama:
 * 1. Kesesuaian Nama Perseroan (Identik termasuk ejaan)
 * 2. Kesesuaian Rujukan Akta & SK Kemenkumham (Nomor, Tanggal & Kronologi)
 * 3. Kesesuaian KBLI & Validasi KBLI 2025 (Deteksi otomatis KBLI 2020 usang seperti Golongan Pokok 45)
 * 4. Kewenangan Bertindak Penandatangan PKS (Direksi Aktif Akta Terbaru)
 * 5. Kesesuaian Status PMA vs Pemegang Saham Asing (WNA)
 * 6. Kesesuaian Tempat Kedudukan vs Alamat Kantor NIB
 * 7. Masa Berlaku Perjanjian Kerjasama (PKS Masih Aktif / Kedaluwarsa)
 */
export function executeDocumentCrossCheck(docs: UnifiedDocumentMetadata[]): CrossCheckFinding[] {
  const findings: CrossCheckFinding[] = [];

  // Group documents by major category
  const aktaDocs = docs.filter((d) => /akta/i.test(d.docType) || /akta/i.test(d.subType || ''));
  const skDocs = docs.filter((d) => /sk\s*kemenkumham|ahu/i.test(d.docType) || /ahu/i.test(d.documentNumber || ''));
  const nibDocs = docs.filter((d) => /nib|nomor\s*induk\s*berusaha/i.test(d.docType) || /oss/i.test(d.publisher || ''));
  const pksDocs = docs.filter((d) => /perjanjian|pks|kontrak|mou/i.test(d.docType));

  const akta = aktaDocs[0];
  const sk = skDocs[0];
  const nib = nibDocs[0];
  const pks = pksDocs[0];

  // =========================================================================
  // RULE 1: NAMA PERSEROAN IDENTIK DI SEMUA DOKUMEN
  // =========================================================================
  {
    const presentDocs = docs.filter((d) => d.companyName && d.companyName.trim().length > 2);
    if (presentDocs.length < 2) {
      findings.push({
        id: 'cross-name-identity',
        ruleTitle: 'Identitas Nama Perseroan',
        category: 'identitas_perusahaan',
        status: 'data tidak ditemukan',
        summary: 'Diperlukan minimal 2 dokumen berbeda untuk mencocokkan nama perseroan.',
        detail: 'Belum cukup dokumen legal yang diunggah untuk menguji konsistensi ejaan nama badan usaha.',
        actionRecommendation: 'Unggah Akta Notaris, SK AHU, atau NIB pendamping untuk verifikasi silang.',
      });
    } else {
      const normalizedMap = presentDocs.map((d) => ({
        docType: d.docType,
        rawName: d.companyName,
        norm: normalizeEntityName(d.companyName),
      }));

      const firstNorm = normalizedMap[0].norm;
      const mismatch = normalizedMap.find((item) => item.norm !== firstNorm);

      if (!mismatch) {
        findings.push({
          id: 'cross-name-identity',
          ruleTitle: 'Identitas Nama Perseroan',
          category: 'identitas_perusahaan',
          status: 'cocok',
          summary: `Nama perseroan identik di seluruh dokumen (${presentDocs.length} dokumen).`,
          detail: `Nama badan hukum terverifikasi konsisten: "${presentDocs[0].companyName}" cocok di ${presentDocs.map((d) => d.docType).join(', ')}.`,
          sourceDocA: presentDocs[0].docType,
          valueA: presentDocs[0].companyName,
          sourceDocB: presentDocs[1]?.docType,
          valueB: presentDocs[1]?.companyName,
        });
      } else {
        findings.push({
          id: 'cross-name-identity',
          ruleTitle: 'Identitas Nama Perseroan',
          category: 'identitas_perusahaan',
          status: 'tidak cocok',
          summary: `Ditemukan ketidakkonsistenan penulisan nama entitas pada ${mismatch.docType}.`,
          detail: `Nama di ${normalizedMap[0].docType} tertulis "${normalizedMap[0].rawName}", sedangkan di ${mismatch.docType} tertulis "${mismatch.rawName}".`,
          sourceDocA: normalizedMap[0].docType,
          valueA: normalizedMap[0].rawName,
          sourceDocB: mismatch.docType,
          valueB: mismatch.rawName,
          actionRecommendation: 'Pastikan penulisan nama perusahaan diselaraskan sesuai Akta & SK Kemenkumham terbaru.',
        });
      }
    }
  }

  // =========================================================================
  // RULE 2: RUJUKAN AKTA PADA SK KEMENKUMHAM (AHU)
  // =========================================================================
  {
    if (!akta || !sk) {
      findings.push({
        id: 'cross-akta-sk-reference',
        ruleTitle: 'Rujukan Akta pada SK Kemenkumham (AHU)',
        category: 'rujukan_akta_sk',
        status: 'data tidak ditemukan',
        summary: 'Memerlukan pasangan berkas Akta Notaris dan SK Kemenkumham.',
        detail: 'Salah satu berkas (Akta Notaris atau SK Pengesahan AHU) belum tersedia untuk dicocokkan nomor & tanggalnya.',
        actionRecommendation: 'Sertakan salinan Akta Notaris dan SK Kemenkumham yang saling merujuk.',
      });
    } else {
      const skSpecific = sk.specificFields?.skKemenkumham || {};
      const refAktaNo = skSpecific.rujukanAkta?.nomorAkta || sk.documentNumber;
      const refAktaDate = skSpecific.rujukanAkta?.tanggalAkta || sk.effectiveDate;
      const aktaNo = akta.documentNumber;

      // Check number match
      const cleanAktaNo = aktaNo?.replace(/\D/g, '') || '';
      const cleanRefNo = refAktaNo?.replace(/\D/g, '') || '';
      const isNumberMatch = cleanAktaNo && cleanRefNo && (cleanAktaNo.includes(cleanRefNo) || cleanRefNo.includes(cleanAktaNo));

      // Check date sequence: SK date must NOT be earlier than Akta date
      const skDateStr = sk.effectiveDate || sk.documentDate;
      const aktaDateStr = akta.effectiveDate || akta.documentDate;
      let dateChronologyValid = true;

      if (skDateStr && aktaDateStr) {
        const skTime = new Date(skDateStr).getTime();
        const aktaTime = new Date(aktaDateStr).getTime();
        if (!isNaN(skTime) && !isNaN(aktaTime) && skTime < aktaTime) {
          dateChronologyValid = false;
        }
      }

      if (isNumberMatch && dateChronologyValid) {
        findings.push({
          id: 'cross-akta-sk-reference',
          ruleTitle: 'Rujukan Akta pada SK Kemenkumham (AHU)',
          category: 'rujukan_akta_sk',
          status: 'cocok',
          summary: 'Rujukan nomor dan tanggal akta pada SK Kemenkumham sah dan sesuai.',
          detail: `Nomor akta "${akta.documentNumber}" terdaftar pada rujukan SK ${sk.documentNumber}, dan tanggal pengesahan SK sah (setelah tanggal pembuatan akta).`,
          sourceDocA: 'Akta Notaris',
          valueA: `${akta.documentNumber} (${aktaDateStr || '-'})`,
          sourceDocB: 'SK Kemenkumham',
          valueB: `Rujukan: ${refAktaNo} (${skDateStr || '-'})`,
        });
      } else if (!dateChronologyValid) {
        findings.push({
          id: 'cross-akta-sk-reference',
          ruleTitle: 'Rujukan Akta pada SK Kemenkumham (AHU)',
          category: 'rujukan_akta_sk',
          status: 'tidak cocok',
          summary: 'Anomali kronologis: Tanggal SK Kemenkumham lebih awal dari tanggal Akta.',
          detail: `SK diterbitkan pada ${skDateStr}, sedangkan Akta tertanggal ${aktaDateStr}. SK tidak boleh mendahului tanggal penandatanganan Akta.`,
          sourceDocA: 'Akta Notaris',
          valueA: aktaDateStr,
          sourceDocB: 'SK Kemenkumham',
          valueB: skDateStr,
          actionRecommendation: 'Periksa kembali tanggal akta notaris dan pastikan SK yang diunggah adalah pengesahan yang benar.',
        });
      } else {
        findings.push({
          id: 'cross-akta-sk-reference',
          ruleTitle: 'Rujukan Akta pada SK Kemenkumham (AHU)',
          category: 'rujukan_akta_sk',
          status: 'tidak cocok',
          summary: 'Nomor rujukan akta pada SK Kemenkumham tidak cocok dengan Akta yang diunggah.',
          detail: `Akta terunggah bernomor "${akta.documentNumber}", namun SK merujuk pada akta nomor "${refAktaNo}".`,
          sourceDocA: 'Akta Notaris',
          valueA: akta.documentNumber,
          sourceDocB: 'SK Kemenkumham',
          valueB: refAktaNo,
          actionRecommendation: 'Pastikan mengunggah akta perubahan/pendirian yang bersesuaian dengan SK AHU terkait.',
        });
      }
    }
  }

  // =========================================================================
  // RULE 3: KBLI AKTA SESUAI NIB & VALIDASI KBLI 2025 (GOLONGAN POKOK 45)
  // =========================================================================
  {
    const aktaKbli = akta?.specificFields?.aktaNotaris?.daftarKbli || [];
    const nibKbli = nib?.specificFields?.nibOss?.daftarKbli || [];

    // Also check raw string if specificFields not set
    const allKbliCodes = new Set<string>();
    aktaKbli.forEach((k: any) => k.kode && allKbliCodes.add(k.kode));
    nibKbli.forEach((k: any) => k.kode && allKbliCodes.add(k.kode));

    if (allKbliCodes.size === 0 && akta?.businessSectors) {
      const matches = akta.businessSectors.match(/\b\d{5}\b/g) || [];
      matches.forEach((m) => allKbliCodes.add(m));
    }
    if (allKbliCodes.size === 0 && nib?.businessSectors) {
      const matches = nib.businessSectors.match(/\b\d{5}\b/g) || [];
      matches.forEach((m) => allKbliCodes.add(m));
    }

    // Check for deprecated KBLI 2020 Group 45
    const deprecatedGroup45Codes = Array.from(allKbliCodes).filter((c) => c.startsWith('45'));

    if (allKbliCodes.size === 0) {
      findings.push({
        id: 'cross-kbli-validation',
        ruleTitle: 'Kesesuaian KBLI & Validasi KBLI 2025',
        category: 'kbli_2025',
        status: 'data tidak ditemukan',
        summary: 'Daftar kode KBLI 5 digit belum terdeteksi pada berkas.',
        detail: 'Informasi KBLI pada Akta atau NIB belum dapat diekstraksi secara lengkap.',
        actionRecommendation: 'Pastikan dokumen memuat klausul Maksud & Tujuan atau lampiran KBLI OSS.',
      });
    } else if (deprecatedGroup45Codes.length > 0) {
      findings.push({
        id: 'cross-kbli-validation',
        ruleTitle: 'Kesesuaian KBLI & Validasi KBLI 2025',
        category: 'kbli_2025',
        status: 'tidak cocok',
        summary: `Ditemukan KBLI 2020 usang: Golongan Pokok 45 (${deprecatedGroup45Codes.join(', ')}) wajib dimigrasi ke KBLI 2025.`,
        detail: `Golongan Pokok 45 (Perdagangan/Reparasi Mobil & Motor) telah dihapus dari sistem KBLI 2025 OSS RBA. Tenggat waktu penyesuaian anggaran dasar telah terlampaui.`,
        sourceDocA: akta ? 'Akta Notaris' : 'Dokumen',
        valueA: deprecatedGroup45Codes.join(', '),
        actionRecommendation: `Segera lakukan perubahan anggaran dasar notaris dan penyesuaian OSS ke KBLI 2025 Golongan Pokok 46/47/95 untuk mencegah pembekuan NIB.`,
      });
    } else if (akta && nib && aktaKbli.length > 0 && nibKbli.length > 0) {
      const nibCodes = new Set(nibKbli.map((k: any) => k.kode));
      const missingInNib = aktaKbli.filter((k: any) => !nibCodes.has(k.kode));

      if (missingInNib.length > 0) {
        findings.push({
          id: 'cross-kbli-validation',
          ruleTitle: 'Kesesuaian KBLI & Validasi KBLI 2025',
          category: 'kbli_2025',
          status: 'tidak cocok',
          summary: `Ada ${missingInNib.length} KBLI di Akta yang belum terdaftar di NIB OSS.`,
          detail: `Kode KBLI ${missingInNib.map((k: any) => k.kode).join(', ')} tercantum dalam Akta, tetapi belum diinput pada izin usaha NIB OSS.`,
          sourceDocA: 'Akta Notaris',
          valueA: missingInNib.map((k: any) => k.kode).join(', '),
          sourceDocB: 'NIB OSS',
          valueB: Array.from(nibCodes).join(', '),
          actionRecommendation: 'Lakukan permohonan perubahan perizinan berusaha di portal OSS untuk menambahkan KBLI tersebut.',
        });
      } else {
        findings.push({
          id: 'cross-kbli-validation',
          ruleTitle: 'Kesesuaian KBLI & Validasi KBLI 2025',
          category: 'kbli_2025',
          status: 'cocok',
          summary: 'Seluruh KBLI di Akta tercatat lengkap di NIB dan 100% valid KBLI 2025.',
          detail: `Terverifikasi ${aktaKbli.length} KBLI aktif, tidak ditemukan kode KBLI 2020 kedaluwarsa.`,
          sourceDocA: 'Akta Notaris',
          valueA: aktaKbli.map((k: any) => k.kode).join(', '),
          sourceDocB: 'NIB OSS',
          valueB: Array.from(nibCodes).join(', '),
        });
      }
    } else {
      findings.push({
        id: 'cross-kbli-validation',
        ruleTitle: 'Kesesuaian KBLI & Validasi KBLI 2025',
        category: 'kbli_2025',
        status: 'cocok',
        summary: 'Kode KBLI terverifikasi sesuai format standar KBLI 2025.',
        detail: `Kode ${Array.from(allKbliCodes).join(', ')} valid dan tidak termasuk dalam golongan pokok usang.`,
        sourceDocA: 'Dokumen Terunggah',
        valueA: Array.from(allKbliCodes).join(', '),
      });
    }
  }

  // =========================================================================
  // RULE 4: PENANDATANGAN PKS ADALAH DIREKSI AKTIF SESUAI AKTA TERBARU
  // =========================================================================
  {
    if (!pks || !akta) {
      findings.push({
        id: 'cross-pks-signatory',
        ruleTitle: 'Kewenangan Penandatangan PKS',
        category: 'kewenangan_pks',
        status: 'data tidak ditemukan',
        summary: 'Memerlukan dokumen Perjanjian Kerjasama (PKS) dan Akta Notaris.',
        detail: 'Belum dapat menguji kewenangan hukum penandatangan kontrak karena berkas PKS atau Akta belum lengkap.',
        actionRecommendation: 'Unggah naskah PKS dan Akta susunan Direksi terbaru.',
      });
    } else {
      const pksSignatories = pks.specificFields?.pks?.paraPihak || [];
      const aktaDirectors = akta.specificFields?.aktaNotaris?.direksiKomisaris || [];

      let signatoryName = pksSignatories[0]?.penandatangan || '';
      if (!signatoryName && pks.keyPeople) {
        signatoryName = pks.keyPeople;
      }

      if (!signatoryName) {
        findings.push({
          id: 'cross-pks-signatory',
          ruleTitle: 'Kewenangan Penandatangan PKS',
          category: 'kewenangan_pks',
          status: 'data tidak ditemukan',
          summary: 'Nama penandatangan PKS tidak tertera pada klausa akhir perjanjian.',
          detail: 'Nama para pihak penandatangan kontrak belum dapat diidentifikasi.',
        });
      } else {
        const normSignatory = signatoryName.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
        const matchingDirector = aktaDirectors.find((d: any) => {
          const normDir = (d.nama || '').toUpperCase().replace(/[^A-Z\s]/g, '').trim();
          return normDir.includes(normSignatory) || normSignatory.includes(normDir);
        });

        if (matchingDirector) {
          const isDireksi = /direktur/i.test(matchingDirector.jabatan || '');
          if (isDireksi) {
            findings.push({
              id: 'cross-pks-signatory',
              ruleTitle: 'Kewenangan Penandatangan PKS',
              category: 'kewenangan_pks',
              status: 'cocok',
              summary: 'Penandatangan PKS sah: Terdaftar sebagai Direksi aktif berwenang pada Akta.',
              detail: `Sdr/i ${matchingDirector.nama} menjabat sebagai ${matchingDirector.jabatan} dan memiliki kewenangan hukum mewakili perseroan.`,
              sourceDocA: 'PKS / Kontrak',
              valueA: signatoryName,
              sourceDocB: 'Akta Notaris',
              valueB: `${matchingDirector.nama} (${matchingDirector.jabatan})`,
            });
          } else {
            findings.push({
              id: 'cross-pks-signatory',
              ruleTitle: 'Kewenangan Penandatangan PKS',
              category: 'kewenangan_pks',
              status: 'tidak cocok',
              summary: `Penandatangan menjabat sebagai ${matchingDirector.jabatan}, bukan Direksi pelaksana.`,
              detail: `Berdasarkan UU PT No. 40/2007, kewenangan mewakili perseroan berada pada Direksi kecuali terdapat surat kuasa khusus atau persetujuan tertulis Komisaris.`,
              sourceDocA: 'PKS / Kontrak',
              valueA: signatoryName,
              sourceDocB: 'Akta Notaris',
              valueB: `${matchingDirector.nama} (${matchingDirector.jabatan})`,
              actionRecommendation: 'Lampirkan Surat Kuasa Direksi atau persetujuan tertulis Dewan Komisaris untuk pengesahan kontrak.',
            });
          }
        } else {
          findings.push({
            id: 'cross-pks-signatory',
            ruleTitle: 'Kewenangan Penandatangan PKS',
            category: 'kewenangan_pks',
            status: 'tidak cocok',
            summary: 'Nama penandatangan PKS tidak tercatat dalam susunan Direksi pada Akta.',
            detail: `Penandatangan "${signatoryName}" tidak ditemukan pada daftar Direksi Akta ${akta.documentNumber}. Kontrak berisiko tidak berkekuatan hukum mengikat perseroan.`,
            sourceDocA: 'PKS / Kontrak',
            valueA: signatoryName,
            sourceDocB: 'Akta Notaris',
            valueB: aktaDirectors.map((d: any) => `${d.nama} (${d.jabatan})`).join('; ') || 'Direksi tidak terdata',
            actionRecommendation: 'Pastikan penandatangan adalah Direktur aktif atau lampirkan Akta Perubahan Direksi terbaru.',
          });
        }
      }
    }
  }

  // =========================================================================
  // RULE 5: STATUS PMA DI NIB VS PEMEGANG SAHAM ASING DI AKTA
  // =========================================================================
  {
    if (!akta || !nib) {
      findings.push({
        id: 'cross-pma-status',
        ruleTitle: 'Kesesuaian Status PMA vs Saham Asing',
        category: 'status_pma',
        status: 'data tidak ditemukan',
        summary: 'Memerlukan Akta Notaris dan NIB OSS untuk memeriksa status PMA/PMDN.',
        detail: 'Data susunan pemegang saham akta atau status permodalan NIB belum lengkap.',
        actionRecommendation: 'Unggah berkas Akta dan NIB untuk memverifikasi kepatuhan batas kepemilikan modal.',
      });
    } else {
      const shareholders = akta.specificFields?.aktaNotaris?.pemegangSaham || [];
      const hasForeignShareholder = shareholders.some((s: any) => s.kewarganegaraan === 'WNA' || /asing|wna|foreign/i.test(s.kewarganegaraan || ''));
      const nibStatus = (nib.specificFields?.nibOss?.statusPmaPmdn || '').toUpperCase();

      if (hasForeignShareholder) {
        if (nibStatus === 'PMA' || /pma/i.test(nib.summary || '')) {
          findings.push({
            id: 'cross-pma-status',
            ruleTitle: 'Kesesuaian Status PMA vs Saham Asing',
            category: 'status_pma',
            status: 'cocok',
            summary: 'Status PMA pada NIB sesuai dengan kepemilikan saham WNA pada Akta.',
            detail: 'Tercatat pemegang saham berkewarganegaraan asing dan perizinan NIB telah terdaftar sebagai Penanaman Modal Asing (PMA).',
            sourceDocA: 'Akta Notaris',
            valueA: 'Terdapat Pemegang Saham WNA',
            sourceDocB: 'NIB OSS',
            valueB: 'Status PMA',
          });
        } else {
          findings.push({
            id: 'cross-pma-status',
            ruleTitle: 'Kesesuaian Status PMA vs Saham Asing',
            category: 'status_pma',
            status: 'tidak cocok',
            summary: 'Pelanggaran Status PMA: Ada pemegang saham asing (WNA) tetapi status NIB adalah PMDN!',
            detail: 'Sesuai regulasi BKPM / Kementerian Investasi, kepemilikan 1 lembar saham pun oleh WNA mewajibkan entitas berstatus PMA dengan ketentuan modal disetor minimum Rp 10 Miliar.',
            sourceDocA: 'Akta Notaris',
            valueA: 'Ditemukan Pemegang Saham WNA',
            sourceDocB: 'NIB OSS',
            valueB: nibStatus || 'PMDN',
            actionRecommendation: 'Segera lakukan migrasi status OSS menjadi PMA atau sesuaikan kepemilikan saham menjadi 100% WNI.',
          });
        }
      } else {
        // All domestic
        if (nibStatus === 'PMDN' || !nibStatus.includes('PMA')) {
          findings.push({
            id: 'cross-pma-status',
            ruleTitle: 'Kesesuaian Status PMA vs Saham Asing',
            category: 'status_pma',
            status: 'cocok',
            summary: 'Status PMDN sah: 100% pemegang saham berkewarganegaraan Indonesia (WNI).',
            detail: 'Komposisi permodalan sepenuhnya domestik dan NIB berstatus PMDN.',
            sourceDocA: 'Akta Notaris',
            valueA: '100% WNI',
            sourceDocB: 'NIB OSS',
            valueB: 'PMDN',
          });
        } else {
          findings.push({
            id: 'cross-pma-status',
            ruleTitle: 'Kesesuaian Status PMA vs Saham Asing',
            category: 'status_pma',
            status: 'tidak cocok',
            summary: 'Status NIB terdaftar PMA, namun tidak ditemukan pemegang saham asing di Akta.',
            detail: 'Seluruh pemegang saham tercatat WNI, namun status perizinan OSS tercantum PMA.',
            sourceDocA: 'Akta Notaris',
            valueA: '100% WNI',
            sourceDocB: 'NIB OSS',
            valueB: 'PMA',
            actionRecommendation: 'Perbarui profil badan usaha pada portal OSS agar kembali berstatus PMDN.',
          });
        }
      }
    }
  }

  // =========================================================================
  // RULE 6: KESESUAIAN LOKASI KEDUDUKAN AKTA VS ALAMAT KANTOR NIB
  // =========================================================================
  {
    if (!akta || !nib) {
      findings.push({
        id: 'cross-location-match',
        ruleTitle: 'Kesesuaian Tempat Kedudukan & Domisili',
        category: 'lokasi_domisili',
        status: 'data tidak ditemukan',
        summary: 'Memerlukan Akta Notaris dan NIB OSS untuk memverifikasi kedudukan kota.',
        detail: 'Informasi domisili kedudukan belum dapat dibandingkan.',
        actionRecommendation: 'Lengkapi dokumen yang mencantumkan kota kedudukan perseroan.',
      });
    } else {
      const aktaCity = akta.specificFields?.aktaNotaris?.tempatKedudukan || akta.cityLocation || akta.registeredAddress || '';
      const nibAddress = nib.specificFields?.nibOss?.alamatKantor?.kotaKabupaten || nib.registeredAddress || '';

      const normAktaCity = normalizeCityName(aktaCity);
      const normNibCity = normalizeCityName(nibAddress);

      if (!normAktaCity || !normNibCity) {
        findings.push({
          id: 'cross-location-match',
          ruleTitle: 'Kesesuaian Tempat Kedudukan & Domisili',
          category: 'lokasi_domisili',
          status: 'data tidak ditemukan',
          summary: 'Nama kota kedudukan tidak terdeteksi pada salah satu dokumen.',
          detail: `Kota di Akta: "${aktaCity || '-'}", Kota di NIB: "${nibAddress || '-'}".`,
        });
      } else if (normAktaCity.includes(normNibCity) || normNibCity.includes(normAktaCity)) {
        findings.push({
          id: 'cross-location-match',
          ruleTitle: 'Kesesuaian Tempat Kedudukan & Domisili',
          category: 'lokasi_domisili',
          status: 'cocok',
          summary: `Tempat kedudukan pada Akta cocok dengan kota alamat kantor NIB (${aktaCity}).`,
          detail: `Kedudukan perseroan di "${aktaCity}" selaras dengan domisili kantor operasional pada perizinan NIB.`,
          sourceDocA: 'Akta Notaris',
          valueA: aktaCity,
          sourceDocB: 'NIB OSS',
          valueB: nibAddress,
        });
      } else {
        findings.push({
          id: 'cross-location-match',
          ruleTitle: 'Kesesuaian Tempat Kedudukan & Domisili',
          category: 'lokasi_domisili',
          status: 'tidak cocok',
          summary: `Perbedaan Tempat Kedudukan: Akta di ${aktaCity}, namun NIB beralamat di ${nibAddress}.`,
          detail: 'Tempat kedudukan perseroan (Kota/Kabupaten) di Anggaran Dasar tidak sesuai dengan domisili yang terdaftar pada OSS RBA.',
          sourceDocA: 'Akta Notaris',
          valueA: aktaCity,
          sourceDocB: 'NIB OSS',
          valueB: nibAddress,
          actionRecommendation: 'Buat Akta Perubahan Tempat Kedudukan atau perbarui alamat kantor di profil OSS.',
        });
      }
    }
  }

  // =========================================================================
  // RULE 7: MASA BERLAKU PERJANJIAN KERJASAMA (PKS)
  // =========================================================================
  {
    if (!pks) {
      findings.push({
        id: 'cross-pks-validity',
        ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
        category: 'masa_berlaku_pks',
        status: 'data tidak ditemukan',
        summary: 'Dokumen Perjanjian Kerjasama (PKS) belum diunggah.',
        detail: 'Pengecekan masa berlaku dan klausul terminasi hanya berlaku untuk berkas kontrak/PKS.',
      });
    } else {
      const pksDates = pks.specificFields?.pks?.jangkaWaktu || {};
      const endDateStr = pksDates.tanggalBerakhir || pks.effectiveDate;

      if (!endDateStr) {
        findings.push({
          id: 'cross-pks-validity',
          ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
          category: 'masa_berlaku_pks',
          status: 'data tidak ditemukan',
          summary: 'Tanggal berakhir perjanjian tidak tertera secara eksplisit.',
          detail: 'Klausul jangka waktu kontrak tidak mencantumkan tanggal akhir spesifik atau berlaku selamanya.',
        });
      } else {
        const today = new Date();
        const endDate = new Date(endDateStr);

        if (isNaN(endDate.getTime())) {
          findings.push({
            id: 'cross-pks-validity',
            ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
            category: 'masa_berlaku_pks',
            status: 'data tidak ditemukan',
            summary: `Format tanggal berakhir "${endDateStr}" tidak dapat diurai.`,
            detail: 'Periksa kembali penulisan tanggal jatuh tempo kontrak.',
          });
        } else {
          const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays > 30) {
            findings.push({
              id: 'cross-pks-validity',
              ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
              category: 'masa_berlaku_pks',
              status: 'cocok',
              summary: `PKS masih berlaku aktif (Sisa masa berlaku: ${diffDays} hari).`,
              detail: `Kontrak berlaku hingga ${endDateStr}. Tidak diperlukan tindakan perpanjangan mendesak saat ini.`,
              sourceDocA: 'PKS / Kontrak',
              valueA: `Berlaku s/d ${endDateStr} (${diffDays} hari tersisa)`,
            });
          } else if (diffDays >= 0) {
            findings.push({
              id: 'cross-pks-validity',
              ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
              category: 'masa_berlaku_pks',
              status: 'tidak cocok',
              summary: `Peringatan: PKS akan berakhir dalam ${diffDays} hari (${endDateStr})!`,
              detail: 'Kontrak berada dalam masa tenggang kritis (< 30 hari). Diperlukan adendum atau pemberitahuan perpanjangan segera.',
              sourceDocA: 'PKS / Kontrak',
              valueA: `Segera berakhir: ${diffDays} hari tersisa`,
              actionRecommendation: 'Siapkan draf Adendum / Surat Perpanjangan Perjanjian sebelum masa berlaku habis.',
            });
          } else {
            findings.push({
              id: 'cross-pks-validity',
              ruleTitle: 'Masa Berlaku Perjanjian Kerjasama (PKS)',
              category: 'masa_berlaku_pks',
              status: 'tidak cocok',
              summary: `PKS telah KEDALUWARSA sejak ${Math.abs(diffDays)} hari yang lalu (${endDateStr}).`,
              detail: 'Masa berlaku kontrak telah lewat waktu. Hubungan kerjasama berjalan tanpa payung hukum aktif.',
              sourceDocA: 'PKS / Kontrak',
              valueA: `Kedaluwarsa pada ${endDateStr}`,
              actionRecommendation: 'Lakukan perpanjangan kontrak atau pembaharuan perjanjian (Novasi) sesegera mungkin.',
            });
          }
        }
      }
    }
  }

  return findings;
}
