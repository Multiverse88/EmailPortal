import { findMatchingKnowledge, PORTAL_KNOWLEDGE_BASE } from '../src/lib/companion-knowledge';

describe('Backend Companion Knowledge Base', () => {
  it('should contain all required portal topics', () => {
    expect(PORTAL_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(4);
    const ids = PORTAL_KNOWLEDGE_BASE.map(k => k.id);
    expect(ids).toContain('retention-3months');
    expect(ids).toContain('backup-files');
    expect(ids).toContain('storage-quota-synology');
    expect(ids).toContain('support-tickets');
  });

  it('should match retention query accurately', () => {
    const match = findMatchingKnowledge('berapa lama masa retensi akun?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('retention-3months');
    expect(match?.pose).toBe('tips');
  });

  it('should match backup query accurately', () => {
    const match = findMatchingKnowledge('bagaimana cara backup berkas dokumen saya?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('backup-files');
    expect(match?.pose).toBe('document');
  });

  it('should match attachment limit queries', () => {
    const match = findMatchingKnowledge('kenapa lampiran file terlalu besar gagal dikirim?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('email-attachment-limit');
    expect(match?.content).toContain('10 MB');
  });

  it('should match blocked email images queries', () => {
    const match = findMatchingKnowledge('gambar email saya tidak muncul');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('email-images-blocked');
    expect(match?.content).toContain('Tampilkan Gambar Asli');
  });

  it('should match 2FA loss queries and direct to urgent support', () => {
    const match = findMatchingKnowledge('hp saya hilang tidak bisa 2fa');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('2fa-device-lost');
    expect(match?.quickActions?.[0]?.priority).toBe('urgent');
  });

  it('should match cold storage restoration queries', () => {
    const match = findMatchingKnowledge('bagaimana cara pulihkan dokumen lama lebih dari 90 hari di synology?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('cold-storage-restore');
    expect(match?.content).toContain('Synology NAS');
  });

  it('should match complex backend and server error queries and direct to support ticket', () => {
    const match = findMatchingKnowledge('saya menemukan error 500 dan kendala server backend bermasalah');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('complex-backend-issues');
    expect(match?.pose).toBe('thinking');
    expect(match?.content).toContain('tiket bantuan');
    expect(match?.quickActions?.[0]?.action).toBe('open-support-modal');
    expect(match?.quickActions?.[0]?.category).toBe('Kendala Teknis & Backend');
    expect(match?.quickActions?.[0]?.priority).toBe('urgent');
  });

  it('should match portal profile and features queries', () => {
    const match = findMatchingKnowledge('website ini tentang apa dan apa saja fitur portal?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('about-easylegal-portal');
    expect(match?.content).toContain('EasyLegal Customer Portal');
    expect(match?.content).toContain('/inbox');
    expect(match?.content).toContain('/documents');
  });

  it('should match backend architecture queries', () => {
    const match = findMatchingKnowledge('bagaimana arsitektur backend dan teknologi sistem ini?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('backend-tech-architecture');
    expect(match?.content).toContain('Node.js');
    expect(match?.content).toContain('Express');
    expect(match?.content).toContain('Prisma ORM');
  });

  it('should match hybrid storage location queries', () => {
    const match = findMatchingKnowledge('di mana berkas dokumen saya disimpan secara cloud?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('storage-cloud-synology');
    expect(match?.content).toContain('Cloud S3 IDCloudHost');
    expect(match?.content).toContain('Synology NAS Kantor');
  });

  it('should match data security and encryption queries', () => {
    const match = findMatchingKnowledge('apakah keamanan data saya terjamin dan ada enkripsi password?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('security-data-encryption');
    expect(match?.content).toContain('AES-256-GCM');
    expect(match?.content).toContain('2FA TOTP');
  });

  it('should match theme and dark mode queries', () => {
    const match = findMatchingKnowledge('apakah website ini ada dark mode tema gelap?');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('portal-theme-appearance');
    expect(match?.content).toContain('Mode Gelap');
  });

  it('should return null for unmatched random query', () => {
    const match = findMatchingKnowledge('siapa presiden pertama indonesia?');
    expect(match).toBeNull();
  });
});
