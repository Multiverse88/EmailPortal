"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCompanionStore } from "@/lib/companion/companion-store";
import { POSE_ASSETS } from "@/lib/companion/types";
import { queryCompanion } from "@/lib/companion/ai-engine";
import { Typewriter } from "./typewriter";
import {
  X,
  Minus,
  Settings,
  Send,
  Sparkles,
  RotateCcw,
  Key,
} from "lucide-react";

interface CompanionDialogProps {
  onOpenSupport?: (config?: { category?: string; subject?: string; message?: string; priority?: "normal" | "urgent" }) => void;
}

export function CompanionDialog({ onOpenSupport }: CompanionDialogProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    isOpen,
    pose,
    messages,
    isTyping,
    settings,
    closeChat,
    toggleMinimize,
    addMessage,
    setIsTyping,
    updateSettings,
    clearMessages,
    setPose,
  } = useCompanionStore();

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const [tempModel, setTempModel] = useState(settings.model);
  const [tempBaseUrl, setTempBaseUrl] = useState(settings.baseUrl);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    setTempApiKey(settings.apiKey);
    setTempModel(settings.model);
    setTempBaseUrl(settings.baseUrl);
  }, [settings]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    setInput("");
    const userMsgId = `user-${Date.now()}`;
    addMessage({
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    });

    setIsTyping(true);
    setPose("thinking");

    try {
      const history = messages.slice(-5).map((m) => ({ role: m.role, content: m.content }));
      const response = await queryCompanion(text, history, settings, { currentRoute: pathname });

      addMessage({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
        pose: response.pose,
        quickActions: response.quickActions,
      });
    } catch (err) {
      addMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Maaf, terjadi kendala saat memproses jawaban. Silakan coba sesaat lagi.",
        timestamp: Date.now(),
        pose: "suggestion",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (action: string, url?: string) => {
    if (action === "open-support-modal") {
      if (onOpenSupport) {
        onOpenSupport({
          category: "Retensi & Masa Aktif Akun",
          subject: "Permohonan Informasi / Perpanjangan Masa Retensi Akun",
          message: "Halo Tim Support EasyLegal,\n\nSaya ingin menanyakan perihal masa aktif akun saya serta permohonan perpanjangan retensi dokumen.\n\nTerima kasih.",
          priority: "normal",
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("easylegal:open-support", {
            detail: { category: "Retensi & Masa Aktif Akun", priority: "normal" },
          })
        );
      }
    } else if (action === "ask-retention") {
      handleSend("Berapa lama masa retensi akun dan berkas saya bertahan?");
    } else if (action === "ask-backup") {
      handleSend("Bagaimana cara backup berkas dokumen saya?");
    } else if (action === "ask-support") {
      handleSend("Berapa lama tiket support saya diproses?");
    } else if (url) {
      router.push(url);
    }
  };

  const handleSaveSettings = () => {
    updateSettings({
      apiKey: tempApiKey.trim(),
      model: tempModel.trim() || "gpt-4o-mini",
      baseUrl: tempBaseUrl.trim() || "https://api.9router.com/v1",
    });
    setShowSettings(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border-subtle bg-white shadow-2xl animate-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-[#fbfaf9] px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={POSE_ASSETS[pose] || POSE_ASSETS.head}
              alt="El"
              className="size-10 object-contain rounded-xl bg-primary/5 p-1 border border-primary/10"
            />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">El Companion</h3>
              <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {settings.apiKey ? "9router Model Active" : "Sistem Bantuan EasyLegal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`app-icon-button ${showSettings ? "text-primary bg-primary/10" : ""}`}
            title="Pengaturan Model 9router"
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleMinimize}
            className="app-icon-button"
            title="Perkecil"
          >
            <Minus className="size-4" />
          </button>
          <button type="button" onClick={closeChat} className="app-icon-button" title="Tutup">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Settings Sub-Panel (9router API Key) */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <Key className="size-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pengaturan 9router AI Key
            </h4>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Anda dapat menggunakan API Key 9router pribadi Anda untuk respons percakapan AI yang lebih
            luas. Jika kosong, El tetap menjawab menggunakan basis pengetahuan internal portal.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                9router API Key
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-..."
                className="app-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Model Name</label>
              <input
                type="text"
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
                placeholder="gpt-4o-mini / gemini-2.5-flash / claude-3-5-haiku"
                className="app-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Base URL Endpoint
              </label>
              <input
                type="text"
                value={tempBaseUrl}
                onChange={(e) => setTempBaseUrl(e.target.value)}
                placeholder="https://api.9router.com/v1"
                className="app-field text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setTempApiKey("");
                  setTempModel("gpt-4o-mini");
                  setTempBaseUrl("https://api.9router.com/v1");
                }}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Reset Default
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="app-primary-button text-xs py-1.5 px-4 h-9"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Messages Stream */
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isLatestAssistant = !isUser && index === messages.length - 1;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-border-subtle rounded-bl-none"
                  }`}
                >
                  {isLatestAssistant ? (
                    <Typewriter content={msg.content} speed={14} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {/* Quick action buttons attached to assistant reply */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
                    {msg.quickActions.map((qa, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAction(qa.action, qa.url)}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary shadow-2xs hover:bg-primary/5 hover:border-primary transition"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>El sedang memproses...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Suggested Quick Question Chips */}
      {!showSettings && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-t border-border-subtle/60 bg-white/70">
          <button
            type="button"
            onClick={() => handleSend("Berapa lama masa retensi akun dan berkas saya bertahan?")}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            ℹ️ Retensi 3 Bulan
          </button>
          <button
            type="button"
            onClick={() => handleSend("Bagaimana cara backup berkas dokumen?")}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            📁 Backup Berkas
          </button>
          <button
            type="button"
            onClick={() => handleSend("Berapa lama tiket support saya diproses?")}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
          >
            🎫 SLA 1x24 Jam
          </button>
        </div>
      )}

      {/* Input Footer */}
      {!showSettings && (
        <div className="border-t border-border-subtle bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan untuk El..."
              className="app-field text-xs py-2 px-3 flex-1"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-container disabled:opacity-50"
              title="Kirim pesan"
            >
              <Send className="size-4" />
            </button>
            <button
              type="button"
              onClick={clearMessages}
              className="app-icon-button shrink-0"
              title="Bersihkan riwayat percakapan"
            >
              <RotateCcw className="size-3.5 text-slate-400" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
