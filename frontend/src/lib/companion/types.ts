export type CompanionPose =
  | "greeting"
  | "thinking"
  | "document"
  | "tips"
  | "suggestion"
  | "happy"
  | "enthusiastic"
  | "peeking"
  | "waving"
  | "head";

export interface CompanionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  pose?: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}

export interface CompanionBackendStatus {
  configured: boolean;
  model: string;
  provider: "9router" | "local";
  status: "online" | "local";
  active: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  pose: CompanionPose;
  quickActions?: Array<{ label: string; action: string; url?: string }>;
}

export const POSE_ASSETS: Record<CompanionPose, string> = {
  greeting: "/companion/el/el-menyapa.png",
  thinking: "/companion/el/el-memikirkan.png",
  document: "/companion/el/el-konfirmasi-dokumen.png",
  tips: "/companion/el/el-tips-dengan-lampu.png",
  suggestion: "/companion/el/el-memberikan-saran.png",
  happy: "/companion/el/el-senang.png",
  enthusiastic: "/companion/el/el-semangat.png",
  peeking: "/companion/el/el-muncul-dari-tepi.png",
  waving: "/companion/el/el-hero-melambai.png",
  head: "/companion/el/el-avatar-kepala.png",
};
