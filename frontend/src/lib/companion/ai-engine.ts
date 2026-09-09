import api from "../api";
import { CompanionBackendStatus, CompanionPose, CompanionQuickAction, KnowledgeItem } from "./types";
import { PORTAL_KNOWLEDGE_BASE } from "./knowledge-base";

export function findMatchingKnowledge(query: string): KnowledgeItem | null {
  const normalized = query.toLowerCase();

  let bestMatch: KnowledgeItem | null = null;
  let highestScore = 0;

  for (const item of PORTAL_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return highestScore >= 3 ? bestMatch : null;
}

export function getContextualTip(
  pathname: string,
  context?: { remainingDays?: number; isExpiringSoon?: boolean }
): { text: string; pose: CompanionPose } {
  if (pathname.includes("/settings")) {
    if (context?.isExpiringSoon && typeof context?.remainingDays === "number") {
      return {
        text: `Masa aktif akun Anda tersisa ${context.remainingDays} hari lagi. Jangan lupa unduh berkas penting Anda ya!`,
        pose: "tips",
      };
    }
    return {
      text: "Di menu Pengaturan, Anda dapat mengecek masa retensi akun, kuota S3, dan profil keamanan Anda.",
      pose: "suggestion",
    };
  }

  if (pathname.includes("/documents")) {
    return {
      text: "Perlu mencari dokumen atau melakukan backup? Klik tombol unduh pada berkas yang ingin disimpan.",
      pose: "document",
    };
  }

  if (pathname.includes("/support")) {
    return {
      text: "Ada kendala atau butuh perpanjangan masa aktif? Buat tiket di sini, tim kami siap memproses 1x24 jam!",
      pose: "enthusiastic",
    };
  }

  return {
    text: "Halo! Saya El, asisten pendamping EasyLegal Anda. Ada yang bisa saya bantu hari ini?",
    pose: "greeting",
  };
}

export async function fetchCompanionStatus(): Promise<CompanionBackendStatus> {
  try {
    const res = await api.get("/companion/status");
    if (res.data) {
      return res.data;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to fetch companion status from backend:", err);
    }
  }

  return {
    configured: false,
    model: "gpt-4o-mini",
    provider: "local",
    status: "local",
    active: true,
  };
}

export async function queryCompanion(
  query: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  portalContext?: { currentRoute: string; remainingDays?: number }
): Promise<{
  text: string;
  pose: CompanionPose;
  quickActions?: CompanionQuickAction[];
  source?: "9router" | "local";
}> {
  try {
    const res = await api.post("/companion/chat", {
      query,
      history,
      currentRoute: portalContext?.currentRoute,
    });
    if (res.data?.text) {
      return res.data;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Backend /companion/chat failed or offline, falling back to local:", err);
    }
  }

  // Fallback to local intelligent knowledge match
  const localMatch = findMatchingKnowledge(query);
  if (localMatch) {
    return {
      text: localMatch.content,
      pose: localMatch.pose,
      quickActions: localMatch.quickActions,
      source: "local",
    };
  }

  // Polite general fallback
  return {
    text: "Halo! Saya El. Saya dapat membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup berkas**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**. Ada yang ingin Anda tanyakan?",
    pose: "greeting",
    quickActions: [
      { label: "ℹ️ Kebijakan 3 Bulan", action: "ask-retention" },
      { label: "📁 Cara Backup Berkas", action: "ask-backup" },
      { label: "🎫 Info Tiket Support", action: "ask-support" },
    ],
    source: "local",
  };
}
