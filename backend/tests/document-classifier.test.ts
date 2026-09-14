import { describe, it, expect } from "@jest/globals";
import { classifyDocuments } from "../src/lib/document-classifier";
import { findMatchingKnowledge, PORTAL_KNOWLEDGE_BASE } from "../src/lib/companion-knowledge";

function doc(over: Partial<{
  id: string; title: string; filename: string; category: string;
}> = {}) {
  return {
    id: over.id ?? "d1",
    title: over.title ?? "Dokumen",
    filename: over.filename ?? "file.pdf",
    category: over.category ?? "Client Agreements",
    size: 100,
    mimeType: "application/pdf",
    path: "",
    status: "Reviewed",
    isStarred: false,
    ownerName: "Legal Team",
    customerId: "c1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("classifyDocuments", () => {
  it("proposes Tax Filings for NPWP / invoice keywords", () => {
    const { proposals, summary } = classifyDocuments([
      doc({ id: "t1", title: "NPWP Perusahaan 2024", filename: "npwp.pdf", category: "Client Agreements" }),
      doc({ id: "t2", title: "Invoice List", filename: "invoice-XYZ.pdf", category: "Client Agreements" }),
    ]);
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.proposedCategory === "Tax Filings")).toBe(true);
    expect(summary.needsAction).toBe(2);
    expect(summary.alreadyOk).toBe(0);
  });

  it("proposes NDA Templates for confidentiality keywords", () => {
    const { proposals } = classifyDocuments([
      doc({ id: "n1", title: "Perjanjian Kerahasiaan", filename: "nda.pdf" }),
    ]);
    expect(proposals[0].proposedCategory).toBe("NDA Templates");
  });

  it("proposes Client Agreements for akta / perjanjian", () => {
    const { proposals } = classifyDocuments([
      doc({ id: "a1", title: "Akta Pendirian PT", filename: "akta.pdf", category: "Lainnya" }),
    ]);
    expect(proposals[0].proposedCategory).toBe("Client Agreements");
  });

  it("proposes Lampiran Email for attachment marker", () => {
    const { proposals } = classifyDocuments([
      doc({ id: "e1", title: "Lampiran Email from Client", filename: "attach.pdf", category: "Lainnya" }),
    ]);
    expect(proposals[0].proposedCategory).toBe("Lampiran Email");
  });

  it("skips documents already in the right folder", () => {
    const { proposals, summary } = classifyDocuments([
      doc({ id: "ok1", title: "Invoice ABC", filename: "invoice.pdf", category: "Tax Filings" }),
    ]);
    expect(proposals).toHaveLength(0);
    expect(summary.alreadyOk).toBe(1);
    expect(summary.needsAction).toBe(0);
  });

  it("reports unclassified when no keyword matches", () => {
    const { proposals, summary } = classifyDocuments([
      doc({ id: "u1", title: "Random notes", filename: "notes.txt", category: "Lainnya" }),
    ]);
    expect(proposals).toHaveLength(0);
    expect(summary.unclassified).toBe(1);
  });

  it("confidence: high for >=2 keyword hits, medium for 1", () => {
    const high = classifyDocuments([
      doc({ id: "h1", title: "Invoice & Tax & PPh", filename: "x.pdf" }),
    ]);
    expect(high.proposals[0].confidence).toBe("high");

    const med = classifyDocuments([
      doc({ id: "m1", title: "Invoice", filename: "x.pdf" }),
    ]);
    expect(med.proposals[0].confidence).toBe("medium");
  });

  it("counts summary correctly", () => {
    const { summary } = classifyDocuments([
      doc({ id: "a", title: "Invoice", filename: "a.pdf" }), // medium -> needsAction
      doc({ id: "b", title: "Invoice tax", filename: "b.pdf", category: "Tax Filings" }), // alreadyOk
      doc({ id: "c", title: "zzz", filename: "c.pdf" }), // unclassified
    ]);
    expect(summary).toEqual({ total: 3, needsAction: 1, alreadyOk: 1, unclassified: 1 });
  });
});

describe("tidy-documents knowledge base", () => {
  it("matches rapikan/klasifikasi queries", () => {
    expect(findMatchingKnowledge("tolong rapikan dokumen saya")?.id).toBe("tidy-documents");
    expect(findMatchingKnowledge("bagaimana cara klasifikasi otomatis berkas?")?.id).toBe("tidy-documents");
    expect(findMatchingKnowledge("dokumen saya berantakan, bisa atur kategori?")?.id).toBe("tidy-documents");
  });

  it("exposes Rapikan Sekarang quick action", () => {
    const entry = PORTAL_KNOWLEDGE_BASE.find((k) => k.id === "tidy-documents");
    expect(entry?.quickActions?.some((qa) => qa.action === "tidy-documents")).toBe(true);
  });
});
