import {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateTotpUri,
} from '../src/lib/totp';

describe('TOTP Engine (RFC 6238 compliant)', () => {
  it('generates valid base32 secrets of 32 characters', () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBe(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates a 6-digit numeric string code', () => {
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(typeof code).toBe('string');
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('verifies a freshly generated code successfully', () => {
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(verifyTotp(code, secret)).toBe(true);
  });

  it('verifies code within clock drift window (offset +/- 1 step)', () => {
    const secret = generateTotpSecret();
    const pastCode = generateTotp(secret, -1);
    const futureCode = generateTotp(secret, 1);
    expect(verifyTotp(pastCode, secret, 1)).toBe(true);
    expect(verifyTotp(futureCode, secret, 1)).toBe(true);
  });

  it('rejects invalid or expired code outside window', () => {
    const secret = generateTotpSecret();
    const oldCode = generateTotp(secret, -5);
    expect(verifyTotp(oldCode, secret, 1)).toBe(false);
    expect(verifyTotp('000000', secret, 1)).toBe(false);
    expect(verifyTotp('abc', secret, 1)).toBe(false);
  });

  it('generates valid otpauth URI for QR codes', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const uri = generateTotpUri('budi@clienteasylegal.co.id', secret, 'EasyLegal');
    expect(uri).toContain('otpauth://totp/EasyLegal:budi%40clienteasylegal.co.id');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=EasyLegal');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
