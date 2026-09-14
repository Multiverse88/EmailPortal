import type { LegalDocument } from '@prisma/client';

export interface ClassificationProposal {
  id: string;
  title: string;
  filename: string;
  currentCategory: string;
  proposedCategory: string;
  confidence: 'high' | 'medium';
  reason: string;
}

export interface ClassificationSummary {
  total: number;
  needsAction: number;
  alreadyOk: number;
  unclassified: number;
}

const CATEGORY_RULES: Array<{
  category: string;
  patterns: RegExp[];
  reason: string;
}> = [
  {
    category: 'Tax Filings',
    patterns: [
      /tax/i,
      /npwp/i,
      /pajak/i,
      /\bspt\b/i,
      /invoice/i,
      /kwitansi/i,
      /faktur/i,
      /\bppn\b/i,
      /\bpph\b/i,
      /bphtb/i,
      /\bpbb\b/i,
      /withholding/i,
    ],
    reason: 'Kata kunci pajak, NPWP, SPT, kwitansi, atau invoice',
  },
  {
    category: 'NDA Templates',
    patterns: [
      /\bnda\b/i,
      /non-disclosure/i,
      /kerahasiaan|kerahasian/i,
      /confidential/i,
    ],
    reason: 'Kata kunci NDA atau perjanjian kerahasiaan',
  },
  {
    category: 'Lampiran Email',
    patterns: [
      /lampiran email/i,
      /email attachment/i,
      /\battachment\b/i,
    ],
    reason: 'Judul mengarah pada lampiran email',
  },
  {
    category: 'Client Agreements',
    patterns: [
      /\bakta\b/i,
      /anggaran dasar/i,
      /notaris/i,
      /perjanjian/i,
      /kontrak/i,
      /\bmou\b/i,
      /\bpks\b/i,
      /master service/i,
      /\bmsa\b/i,
      /service agreement/i,
      /kemenkumham/i,
      /pengesahan/i,
      /\bnib\b/i,
      /\boss\b/i,
      /izin usaha/i,
      /perizinan/i,
      /license/i,
    ],
    reason: 'Kata kunci akta, perjanjian, kontrak, atau izin usaha',
  },
];

// ponytail: keyword-only, no PDF parsing. Upgrade to parseIndonesianLegalText
// on file buffers when misclassification reports arrive.
export function classifyDocuments(documents: LegalDocument[]): {
  proposals: ClassificationProposal[];
  summary: ClassificationSummary;
} {
  const proposals: ClassificationProposal[] = [];
  let alreadyOk = 0;
  let unclassified = 0;

  for (const doc of documents) {
    const blob = `${doc.title} ${doc.filename}`.trim();
    let best: { category: string; reason: string; hits: number } | null = null;
    for (const rule of CATEGORY_RULES) {
      const hits = rule.patterns.filter((re) => re.test(blob)).length;
      if (hits > 0 && (!best || hits > best.hits)) {
        best = { category: rule.category, reason: rule.reason, hits };
      }
    }

    if (!best) {
      unclassified += 1;
      continue;
    }
    if (best.category === doc.category) {
      alreadyOk += 1;
      continue;
    }
    proposals.push({
      id: doc.id,
      title: doc.title,
      filename: doc.filename,
      currentCategory: doc.category,
      proposedCategory: best.category,
      confidence: best.hits >= 2 ? 'high' : 'medium',
      reason: best.reason,
    });
  }

  return {
    proposals,
    summary: { total: documents.length, needsAction: proposals.length, alreadyOk, unclassified },
  };
}
