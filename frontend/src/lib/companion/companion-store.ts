import { create } from "zustand";
import {
  CompanionBackendStatus,
  CompanionMessage,
  CompanionPose,
} from "./types";
import { fetchCompanionStatus } from "./ai-engine";

interface CompanionBubble {
  text: string;
  pose: CompanionPose;
}

const DEFAULT_BACKEND_STATUS: CompanionBackendStatus = {
  configured: false,
  model: "gpt-4o-mini",
  provider: "local",
  status: "local",
  active: true,
};

interface CompanionState {
  isOpen: boolean;
  isMinimized: boolean;
  pose: CompanionPose;
  bubble: CompanionBubble | null;
  messages: CompanionMessage[];
  isTyping: boolean;
  backendStatus: CompanionBackendStatus;

  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  toggleMinimize: () => void;
  setMinimized: (val: boolean) => void;
  setPose: (pose: CompanionPose) => void;
  showBubble: (text: string, pose?: CompanionPose, durationMs?: number) => void;
  hideBubble: () => void;
  addMessage: (message: CompanionMessage) => void;
  setIsTyping: (val: boolean) => void;
  setBackendStatus: (status: CompanionBackendStatus) => void;
  refreshStatus: () => Promise<void>;
  clearMessages: () => void;
  resetForTesting: () => void;
}

const INITIAL_MESSAGE: CompanionMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Halo! Saya **El**, AI Companion Anda di EasyLegal. Saya siap membantu Anda memahami retensi akun 3 bulan, backup file, kuota storage, dan tiket support 1x24 jam. Ada yang bisa saya bantu?",
  timestamp: Date.now(),
  pose: "greeting",
  quickActions: [
    { label: "ℹ️ Kebijakan 3 Bulan", action: "ask-retention" },
    { label: "📁 Cara Backup Dokumen", action: "ask-backup" },
    { label: "🎫 Buat Tiket Support", action: "open-support-modal" },
  ],
};

export const useCompanionStore = create<CompanionState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  pose: "greeting",
  bubble: null,
  messages: [INITIAL_MESSAGE],
  isTyping: false,
  backendStatus: DEFAULT_BACKEND_STATUS,

  openChat: () => set({ isOpen: true, isMinimized: false }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen, isMinimized: false })),
  toggleMinimize: () => set((s) => ({ isMinimized: !s.isMinimized })),
  setMinimized: (val: boolean) => set({ isMinimized: val }),
  setPose: (pose: CompanionPose) => set({ pose }),

  showBubble: (text: string, pose: CompanionPose = "tips", durationMs = 8000) => {
    set({ bubble: { text, pose }, pose });
    if (durationMs > 0 && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (get().bubble?.text === text) {
          set({ bubble: null });
        }
      }, durationMs);
    }
  },

  hideBubble: () => set({ bubble: null }),

  addMessage: (message: CompanionMessage) =>
    set((s) => ({
      messages: [...s.messages, message],
      pose: message.pose || s.pose,
    })),

  setIsTyping: (val: boolean) => set({ isTyping: val }),

  setBackendStatus: (status: CompanionBackendStatus) => set({ backendStatus: status }),

  refreshStatus: async () => {
    try {
      const status = await fetchCompanionStatus();
      set({ backendStatus: status });
    } catch {
      // Keep default
    }
  },

  clearMessages: () => set({ messages: [INITIAL_MESSAGE] }),

  resetForTesting: () =>
    set({
      isOpen: false,
      isMinimized: false,
      pose: "greeting",
      bubble: null,
      messages: [INITIAL_MESSAGE],
      isTyping: false,
      backendStatus: DEFAULT_BACKEND_STATUS,
    }),
}));
