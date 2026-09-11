import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual, randomInt } from 'node:crypto';

// PRD requires reversible storage: IMAP/SMTP need the plaintext mailbox password.
const candidateKeys = (): Buffer[] => {
  const keys: string[] = [];
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.trim().length > 0) {
    keys.push(process.env.ENCRYPTION_KEY.trim());
  }
  // Dokploy compose secret key fallback
  keys.push('easy-legal-portal-secret-key-2026');
  // Local development fallback
  keys.push('dev-encryption-key');

  const unique = Array.from(new Set(keys));
  return unique.map((k) => createHash('sha256').update(k).digest());
};

const key = () => candidateKeys()[0];

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Payload must be a non-empty string');
  }

  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64'));
  const keys = candidateKeys();
  let lastError: Error | null = null;

  for (const k of keys) {
    try {
      const d = createDecipheriv('aes-256-gcm', k, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(data), d.final()]).toString('utf8');
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError || new Error('Decryption failed with all candidate keys');
}

export function verifyPassword(input: string, stored: string): boolean {
  if (!input || !stored) return false;

  let plain: string;
  try {
    plain = decrypt(stored);
  } catch {
    // If decryption fails, check if stored password was stored in plaintext
    if (stored === input || stored === input.trim()) {
      return true;
    }
    return false;
  }

  const check = (candidate: string, target: string) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(target);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  // 1. Direct match
  if (check(input, plain)) return true;

  // 2. Trimmed match (handling copied trailing/leading whitespace or newlines from email)
  if (check(input.trim(), plain) || check(input.trim(), plain.trim()) || check(input, plain.trim())) {
    return true;
  }

  // 3. HTML entities unescaped (in case user copied &amp; instead of & or similar)
  const unescaped = input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (check(unescaped, plain) || check(unescaped.trim(), plain)) {
    return true;
  }

  return false;
}

// FR-10: Hostinger complexity rules (min 8 chars, uppercase, lowercase, numbers, symbols).
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return 'Password minimal 8 karakter';
  if (!/[A-Z]/.test(pw)) return 'Password harus memuat huruf kapital';
  if (!/[a-z]/.test(pw)) return 'Password harus memuat huruf kecil';
  if (!/[0-9]/.test(pw)) return 'Password harus memuat angka';
  if (!/[!@#$%^&*()_+~=\-[\]{}|;:,.<>?]/.test(pw)) return 'Password harus memuat simbol (@$!%*#?& dll)';
  return null;
}

export function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  // Use HTML-safe symbols (!@#$%*_+~=) to prevent email entity encoding corruption
  const symbols = '!@#$%*_+~=';
  const all = upper + lower + numbers + symbols;

  const pwd = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ];

  for (let i = 4; i < 16; i++) {
    pwd.push(all[randomInt(all.length)]);
  }

  for (let i = pwd.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = pwd[i];
    pwd[i] = pwd[j];
    pwd[j] = tmp;
  }

  return pwd.join('');
}

