import { findMatchingKnowledge, getContextualTip, queryCompanion, fetchCompanionStatus } from "../ai-engine";

describe("AI Companion Engine & Knowledge Base", () => {
  it("matches 3-month retention queries accurately", () => {
    const match = findMatchingKnowledge("berapa lama akun saya bertahan?");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("retention-3-months");
    expect(match?.pose).toBe("tips");
    expect(match?.content).toContain("3 bulan");
  });

  it("matches document backup questions", () => {
    const match = findMatchingKnowledge("bagaimana cara backup file dan dokumen?");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("backup-documents");
    expect(match?.pose).toBe("document");
    expect(match?.quickActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "navigate-documents" })])
    );
  });

  it("matches support ticket turnaround questions", () => {
    const match = findMatchingKnowledge("berapa lama respon tiket bantuan?");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("support-sla");
    expect(match?.content).toContain("1x24 jam");
  });

  it("matches attachment limit queries", () => {
    const match = findMatchingKnowledge("kenapa lampiran email terlalu besar?");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("email-attachment-limit");
    expect(match?.content).toContain("10 MB");
  });

  it("matches 2FA loss queries with urgent support action", () => {
    const match = findMatchingKnowledge("hp saya hilang tidak bisa 2fa");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("2fa-device-lost");
    expect(match?.quickActions?.[0]?.priority).toBe("urgent");
  });

  it("matches complex backend issues and directs to support ticket", () => {
    const match = findMatchingKnowledge("saya mengalami error 500 dan kendala server backend");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("complex-backend-issues");
    expect(match?.pose).toBe("thinking");
    expect(match?.content).toContain("tiket bantuan");
    expect(match?.quickActions?.[0]?.action).toBe("open-support-modal");
    expect(match?.quickActions?.[0]?.category).toBe("Kendala Teknis & Backend");
    expect(match?.quickActions?.[0]?.priority).toBe("urgent");
  });

  it("returns proactive contextual tips based on route and remaining days", () => {
    const settingsWarning = getContextualTip("/settings", { remainingDays: 14, isExpiringSoon: true });
    expect(settingsWarning.pose).toBe("tips");
    expect(settingsWarning.text).toContain("14 hari");

    const documentsTip = getContextualTip("/documents");
    expect(documentsTip.pose).toBe("document");
    expect(documentsTip.text).toContain("dokumen");
  });

  it("falls back gracefully to local knowledge when backend is offline or unconfigured", async () => {
    const response = await queryCompanion("halo el, bisa bantu apa?");
    expect(response.text).toBeDefined();
    expect(response.pose).toBe("greeting");
    expect(response.source).toBe("local");
  });

  it("fetches companion status with fallback defaults", async () => {
    const status = await fetchCompanionStatus();
    expect(status).toHaveProperty("configured");
    expect(status).toHaveProperty("model");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("active", true);
  });
});
