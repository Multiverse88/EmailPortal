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
