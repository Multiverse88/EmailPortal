import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const bits: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    for (let b = 4; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0');
    result += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return result;
}

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes).substring(0, 32);
}

export function generateTotp(secret: string, offsetSteps = 0): string {
  const key = base32Decode(secret);
  const timeStep = 30;
  const counter = Math.floor(Date.now() / 1000 / timeStep) + offsetSteps;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    return false;
  }
  const cleanToken = token.trim();
  const tokenBuf = Buffer.from(cleanToken);

  for (let i = -window; i <= window; i++) {
    const expected = generateTotp(secret, i);
    const expBuf = Buffer.from(expected);
    if (tokenBuf.length === expBuf.length && timingSafeEqual(tokenBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function generateTotpUri(mailboxAddress: string, secret: string, issuer = 'EasyLegal'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(mailboxAddress)}`;
  const encIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
