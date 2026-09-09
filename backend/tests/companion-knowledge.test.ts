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

  it('should return null for unmatched random query', () => {
    const match = findMatchingKnowledge('siapa presiden pertama indonesia?');
    expect(match).toBeNull();
  });
});
