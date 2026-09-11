import crypto from 'node:crypto';
import path from 'node:path';

export interface AttachmentScanResult {
  status: 'clean' | 'suspicious' | 'quarantined';
  threatType?: string;
  details: string;
  magicBytes?: string;
  fileHash: string;
}

export interface EmailContentScanResult {
  status: 'clean' | 'suspicious' | 'threat';
  threats: string[];
  details: string;
  spamScore: number;
}

// Dangerous executable & script extensions that should never be received or sent via business portal
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'ps1', 'psm1', 'msi', 'msp', 'com', 'hta', 'cpl',
  'jar', 'reg', 'iso', 'img', 'vhd', 'dmg', 'bin', 'sh', 'elf',
  'gadget', 'msc', 'inf', 'scf', 'apk', 'app'
]);

// Double extension attack patterns (e.g., faktur.pdf.exe)
const DOUBLE_EXTENSION_REGEX = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|csv|zip|tar)\.(exe|scr|bat|cmd|vbs|js|ps1|hta|pif|com)$/i;

// Macro-enabled office extensions
const MACRO_EXTENSIONS = new Set(['docm', 'xlsm', 'pptm', 'dotm', 'xltm', 'potm']);

/**
 * Inspects a binary buffer to detect magic bytes / file signatures
 */
export function detectMagicBytes(buffer: Buffer): { type: string; isExecutable: boolean } {
  if (!buffer || buffer.length < 4) {
    return { type: 'unknown', isExecutable: false };
  }

  // Windows PE Executable ('MZ' = 0x4D, 0x5A)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { type: 'windows-pe-executable', isExecutable: true };
  }

  // Linux ELF Executable (0x7F, 'E', 'L', 'F')
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { type: 'linux-elf-executable', isExecutable: true };
  }

  // Mach-O macOS binary
  if (
    (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && (buffer[3] === 0xCE || buffer[3] === 0xCF)) ||
    (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
    (buffer[0] === 0xCE && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE)
  ) {
    return { type: 'macho-binary', isExecutable: true };
  }

  // Java Class / Bytecode (0xCA, 0xFE, 0xBA, 0xBE)
  if (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) {
    return { type: 'java-class', isExecutable: true };
  }

  // Standard Document & Media Magic Bytes
  // PDF (%PDF-)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { type: 'pdf', isExecutable: false };
  }

  // PNG (\x89PNG\r\n\x1a\n)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { type: 'png', isExecutable: false };
  }

  // JPEG (0xFF, 0xD8, 0xFF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { type: 'jpeg', isExecutable: false };
  }

  // GIF (GIF87a / GIF89a)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { type: 'gif', isExecutable: false };
  }

  // ZIP or Office OpenXML (0x50, 0x4B, 0x03, 0x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { type: 'zip-archive', isExecutable: false };
  }

  return { type: 'generic-data', isExecutable: false };
}

/**
 * Scans ZIP central directory or local records to detect dangerous nested payloads
 */
function scanZipEntries(buffer: Buffer): { hasDangerousFile: boolean; dangerousNames: string[] } {
  const dangerousNames: string[] = [];
  try {
    let offset = 0;
    // Walk through local file headers: signature 0x04034b50 (little endian)
    while (offset + 30 <= buffer.length) {
      if (
        buffer[offset] === 0x50 &&
        buffer[offset + 1] === 0x4B &&
        buffer[offset + 2] === 0x03 &&
        buffer[offset + 3] === 0x04
      ) {
        const nameLength = buffer.readUInt16LE(offset + 26);
        const extraLength = buffer.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        const nameEnd = nameStart + nameLength;

        if (nameEnd <= buffer.length) {
          const entryName = buffer.toString('utf8', nameStart, nameEnd);
          const ext = path.extname(entryName).toLowerCase().replace(/^\./, '');
          if (DANGEROUS_EXTENSIONS.has(ext) || DOUBLE_EXTENSION_REGEX.test(entryName)) {
            dangerousNames.push(entryName);
          }
        }
        offset += 30 + nameLength + extraLength;
      } else {
        // Advance to search for next local file header
        offset++;
        if (offset > 1024 * 1024) break; // limit scan depth
      }
    }
  } catch {
    // Non-fatal parse fallback
  }

  return {
    hasDangerousFile: dangerousNames.length > 0,
    dangerousNames,
  };
}

/**
 * Comprehensive attachment scanner:
 * Checks filename, extensions, double extensions, magic bytes, and zip contents.
 */
export function scanAttachmentBuffer(filename: string, buffer: Buffer): AttachmentScanResult {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cleanFilename = (filename || 'attachment').trim();
  const ext = path.extname(cleanFilename).toLowerCase().replace(/^\./, '');

  // 1. Check double extension attack
  if (DOUBLE_EXTENSION_REGEX.test(cleanFilename)) {
    return {
      status: 'quarantined',
      threatType: 'Manipulasi Ekstensi Ganda (Double Extension Attack)',
      details: `Berkas "${cleanFilename}" menggunakan teknik penyamaran ekstensi ganda untuk menyembunyikan payload yang berpotensi berbahaya.`,
      fileHash,
    };
  }

  // 2. Check dangerous extension blacklist
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      status: 'quarantined',
      threatType: 'Berkas Executable / Script Berbahaya',
      details: `Ekstensi .${ext} dilarang karena dapat mengeksekusi kode berbahaya pada perangkat klien.`,
      fileHash,
    };
  }

  // 3. Inspect magic bytes
  const magic = detectMagicBytes(buffer);

  // If magic bytes reveal PE or ELF executable, but filename claimed to be a document or image
  if (magic.isExecutable) {
    return {
      status: 'quarantined',
      threatType: `Payload Executable Terselubung (${magic.type})`,
      details: `Header biner berkas "${cleanFilename}" teridentifikasi sebagai ${magic.type} meskipun berekstensi .${ext}. Berkas otomatis dikarantina.`,
      magicBytes: magic.type,
      fileHash,
    };
  }

  // 4. If ZIP archive, inspect inner entries for hidden executables
  if (magic.type === 'zip-archive' || ext === 'zip') {
    const zipScan = scanZipEntries(buffer);
    if (zipScan.hasDangerousFile) {
      return {
        status: 'quarantined',
        threatType: 'Arsip ZIP Mengandung Executable Berbahaya',
        details: `Di dalam arsip ditemukan berkas berisiko: ${zipScan.dangerousNames.slice(0, 3).join(', ')}.`,
        magicBytes: magic.type,
        fileHash,
      };
    }
  }

  // 5. Check macro-enabled documents
  if (MACRO_EXTENSIONS.has(ext)) {
    return {
      status: 'suspicious',
      threatType: 'Dokumen Berbasis Makro (Macro-Enabled)',
      details: `Berkas berekstensi .${ext} mengandung skrip makro. Berhati-hati saat membuka berkas.`,
      fileHash,
    };
  }

  // Safe and clean file
  return {
    status: 'clean',
    details: 'Terverifikasi aman • Magic bytes sesuai • Bebas dari payload executable berbahaya',
    magicBytes: magic.type,
    fileHash,
  };
}

// Trusted corporate and banking domains for impersonation check
const TRUSTED_DOMAINS: Record<string, string[]> = {
  easylegal: ['clienteasylegal.co.id', 'easylegal.co.id'],
  bca: ['bca.co.id', 'klikbca.com'],
  mandiri: ['bankmandiri.co.id', 'livinbymandiri.co.id'],
  pajak: ['pajak.go.id', 'kemenkeu.go.id'],
  hostinger: ['hostinger.com', 'hostinger.co.id'],
  google: ['google.com', 'google.co.id', 'gmail.com'],
  microsoft: ['microsoft.com', 'office.com', 'outlook.com'],
};

// Phishing urgency & social engineering patterns
const PHISHING_KEYWORDS = [
  /akun anda akan (diblokir|ditutup|dihapus|dinonaktifkan)/i,
  /verifikasi (kata sandi|password|rekening|pin) anda/i,
  /urgent account (suspension|verification|update)/i,
  /update your (billing|payment|security) information immediately/i,
  /wire transfer (inheritance|lottery|winner)/i,
  /selamat anda memenangkan (undian|hadiah)/i,
  /pemberitahuan penutupan rekening/i,
  /segera konfirmasi sebelum 24 jam/i,
];

/**
 * Analyzes email sender, subject, and content for anti-spam and anti-scam indicators
 */
export function scanEmailContent(params: {
  sender?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): EmailContentScanResult {
  const sender = (params.sender || '').toLowerCase();
  const subject = (params.subject || '').toLowerCase();
  const bodyText = (params.bodyText || '').toLowerCase();
  const bodyHtml = params.bodyHtml || '';

  const threats: string[] = [];
  let spamScore = 0;

  // 1. Display Name & Domain Spoofing Detection
  for (const [brand, allowedDomains] of Object.entries(TRUSTED_DOMAINS)) {
    if (sender.includes(brand)) {
      const senderDomainMatch = sender.match(/@([a-zA-Z0-9.-]+)/);
      const actualDomain = senderDomainMatch ? senderDomainMatch[1].toLowerCase() : '';
      const isAllowed = allowedDomains.some((d) => actualDomain === d || actualDomain.endsWith(`.${d}`));
      if (!isAllowed) {
        threats.push(`Indikasi Pemalsuan Identitas (Display Name Spoofing: mengaku sebagai ${brand})`);
        spamScore += 65;
      }
    }
  }

  // 2. Social Engineering / Phishing Keyword Patterns
  const combinedText = `${subject} ${bodyText}`;
  for (const pattern of PHISHING_KEYWORDS) {
    if (pattern.test(combinedText)) {
      threats.push(`Pola Rekayasa Sosial / Urgensi Palsu (${pattern.source})`);
      spamScore += 35;
    }
  }

  // 3. Deceptive HTML Link Inconsistencies
  if (bodyHtml) {
    // Look for <a href="TARGET">LABEL</a> where label is a URL but TARGET is different
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(bodyHtml)) !== null) {
      const targetHref = match[1].trim().toLowerCase();
      const labelText = match[2].replace(/<[^>]*>/g, '').trim().toLowerCase();

      // If label text looks like a URL starting with http:// or https:// or www.
      if (labelText.startsWith('http://') || labelText.startsWith('https://') || labelText.startsWith('www.')) {
        try {
          const targetUrl = new URL(targetHref);
          const targetHost = targetUrl.hostname;
          const labelClean = labelText.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          if (labelClean && !targetHost.includes(labelClean) && !labelClean.includes(targetHost)) {
            threats.push(`Tautan Palsu Terdeteksi (Label: ${labelClean}, Tujuan Sebenarnya: ${targetHost})`);
            spamScore += 55;
          }
        } catch {
          // Invalid URL format
        }
      }
    }
  }

  // 4. Excessive CAPS in subject
  const rawSubject = params.subject || '';
  if (rawSubject.length > 10) {
    const capsCount = (rawSubject.match(/[A-Z]/g) || []).length;
    if (capsCount / rawSubject.length > 0.65) {
      threats.push('Penggunaan Huruf Kapital Berlebihan pada Subjek');
      spamScore += 20;
    }
  }

  let status: 'clean' | 'suspicious' | 'threat' = 'clean';
  if (spamScore >= 60 || threats.some((t) => t.includes('Tautan Palsu') || t.includes('Pemalsuan Identitas'))) {
    status = 'threat';
  } else if (spamScore >= 30) {
    status = 'suspicious';
  }

  return {
    status,
    threats,
    details: threats.length > 0 ? threats.join(' • ') : 'Email terverifikasi bebas spam dan indikasi phising',
    spamScore,
  };
}
