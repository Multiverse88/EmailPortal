import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual, randomInt } from 'node:crypto';

// PRD requires reversible storage: IMAP/SMTP need the plaintext mailbox password.
const key = () =>
  createHash('sha256').update(process.env.ENCRYPTION_KEY || 'dev-encryption-key').digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

export function verifyPassword(input: string, stored: string): boolean {
  let plain: string;
  try {
    plain = decrypt(stored);
  } catch {
    return false;
  }
  const a = Buffer.from(input);
  const b = Buffer.from(plain);
  return a.length === b.length && timingSafeEqual(a, b);
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
  const symbols = '!@#$%^&*()_+~=';
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

