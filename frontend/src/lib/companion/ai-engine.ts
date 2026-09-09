import { CompanionPose, CompanionSettings, KnowledgeItem } from "./types";
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

export async function queryCompanion(
  query: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  settings: CompanionSettings,
  portalContext?: { currentRoute: string; remainingDays?: number }
): Promise<{
  text: string;
  pose: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}> {
  const localMatch = findMatchingKnowledge(query);

  // If user has provided a 9router API key, call the OpenAI-compatible completion API
  if (settings.apiKey && settings.apiKey.trim().length > 0) {
    try {
      const endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const systemPrompt = `Anda adalah "El", AI Companion ramah dan profesional untuk platform EasyLegal.
Karakter Anda ramah, solutif, sopan, dan menggunakan bahasa Indonesia yang hangat.
Konteks portal saat ini:
- Rute halaman: ${portalContext?.currentRoute || "/inbox"}
- Kebijakan retensi akun: Akun & file hanya bertahan 3 bulan (90 hari) sejak dibuat.
- Pengingat 1 bulan terakhir: Diwajibkan backup berkas mandiri sebelum nonaktif.
- Layanan Tiket Support: SLA tanggapan 1x24 jam kerja.
${localMatch ? `Informasi relevan dari sistem: ${localMatch.content}` : ""}
Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf).`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: settings.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...history.slice(-6),
            { role: "user", content: query },
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.choices?.[0]?.message?.content;
        if (replyText) {
          return {
            text: replyText,
            pose: localMatch?.pose || "happy",
            quickActions: localMatch?.quickActions,
          };
        }
      }
    } catch (err) {
      console.warn("9router API call failed, falling back to local engine:", err);
    }
  }

  // Fallback to local intelligent knowledge match
  if (localMatch) {
    return {
      text: localMatch.content,
      pose: localMatch.pose,
      quickActions: localMatch.quickActions,
    };
  }

  // Polite general fallback with guidance
  return {
    text: `Halo! Saya El. Saya dapat membantu Anda seputar **kebijakan retensi 3 bulan**, **cara backup dokumen**, **kuota penyimpanan**, atau **tiket support (SLA 1x24 jam)**.

Untuk pertanyaan kompleks lainnya, Anda juga bisa memasukkan API Key 9router Anda melalui ikon gerigi pengaturan di atas jendela ini!`,
    pose: "greeting",
    quickActions: [
      { label: "ℹ️ Kebijakan 3 Bulan", action: "ask-retention" },
      { label: "📁 Cara Backup Berkas", action: "ask-backup" },
      { label: "🎫 Info Tiket Support", action: "ask-support" },
    ],
  };
}
