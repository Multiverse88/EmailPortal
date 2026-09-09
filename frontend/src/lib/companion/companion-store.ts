import { create } from "zustand";
import {
  CompanionMessage,
  CompanionPose,
  CompanionSettings,
  DEFAULT_COMPANION_SETTINGS,
} from "./types";

interface CompanionBubble {
  text: string;
  pose: CompanionPose;
}

interface CompanionState {
  isOpen: boolean;
  isMinimized: boolean;
  pose: CompanionPose;
  bubble: CompanionBubble | null;
  messages: CompanionMessage[];
  isTyping: boolean;
  settings: CompanionSettings;

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
  updateSettings: (patch: Partial<CompanionSettings>) => void;
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

function loadSettingsFromStorage(): CompanionSettings {
  if (typeof window === "undefined") return DEFAULT_COMPANION_SETTINGS;
  try {
    const raw = localStorage.getItem("el_companion_settings");
    if (raw) return { ...DEFAULT_COMPANION_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COMPANION_SETTINGS;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  pose: "greeting",
  bubble: null,
  messages: [INITIAL_MESSAGE],
  isTyping: false,
  settings: loadSettingsFromStorage(),

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

  updateSettings: (patch: Partial<CompanionSettings>) => {
    set((s) => {
      const next = { ...s.settings, ...patch };
      if (typeof window !== "undefined") {
        localStorage.setItem("el_companion_settings", JSON.stringify(next));
      }
      return { settings: next };
    });
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
      settings: DEFAULT_COMPANION_SETTINGS,
    }),
}));
