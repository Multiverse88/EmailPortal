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
  Send,
  Sparkles,
  RotateCcw,
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
    backendStatus,
    closeChat,
    toggleMinimize,
    addMessage,
    setIsTyping,
    clearMessages,
    setPose,
    refreshStatus,
  } = useCompanionStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
    }
  }, [isOpen, refreshStatus]);

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
      const response = await queryCompanion(text, history, { currentRoute: pathname });

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

  const handleAction = (
    action: string,
    url?: string,
    extra?: {
      category?: string;
      priority?: "normal" | "urgent";
      subject?: string;
      message?: string;
    }
  ) => {
    if (action === "open-support-modal") {
      const category = extra?.category || "Retensi & Masa Aktif Akun";
      const priority = extra?.priority || "normal";
      const subject = extra?.subject || "Permohonan Bantuan Layanan EasyLegal";
      const message =
        extra?.message ||
        "Halo Tim Support EasyLegal,\n\nSaya membutuhkan bantuan terkait akun dan layanan portal saya.\n\nTerima kasih.";

      if (onOpenSupport) {
        onOpenSupport({
          category,
          subject,
          message,
          priority,
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("easylegal:open-support", {
            detail: { category, subject, message, priority },
          })
        );
      }
    } else if (action === "ask-retention") {
      handleSend("Berapa lama masa retensi akun dan berkas saya bertahan?");
    } else if (action === "ask-backup") {
      handleSend("Bagaimana cara backup berkas dokumen saya?");
    } else if (action === "ask-support") {
      handleSend("Berapa lama tiket support saya diproses?");
    } else if (action === "navigate-documents" || url === "/documents") {
      router.push("/documents");
    } else if (action === "navigate-settings" || url === "/settings") {
      router.push("/settings");
    } else if (action === "navigate-inbox" || url === "/inbox") {
      router.push("/inbox");
    } else if (url) {
      router.push(url);
    }
  };

  const isAIOnline = backendStatus.configured;

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
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${
                isAIOnline ? "bg-emerald-500" : "bg-primary"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">El Companion</h3>
              <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {isAIOnline ? `El AI Aktif (${backendStatus.model})` : "El Asisten Portal EasyLegal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
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

      {/* Messages Stream */}
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
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? "bg-primary text-white rounded-br-none shadow-sm"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : isLatestAssistant && isTyping ? (
                  <div className="flex items-center gap-1.5 py-1 text-slate-400">
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                  </div>
                ) : isLatestAssistant ? (
                  <Typewriter content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Quick Action Chips attached to message */}
              {msg.quickActions && msg.quickActions.length > 0 && !isTyping && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                  {msg.quickActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        handleAction(action.action, action.url, {
                          category: action.category,
                          priority: action.priority,
                          subject: action.subject,
                          message: action.message,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-white transition active:scale-95"
                    >
                      <Sparkles className="size-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              <span className="mt-1 px-1 text-[10px] text-slate-400">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic">
            <span className="size-2 rounded-full bg-primary/60 animate-ping" />
            El sedang mengetik jawaban...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 bg-white border-t border-slate-100 no-scrollbar">
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
          onClick={() => handleSend("Bagaimana jika ukuran lampiran email melebihi 10 MB?")}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
        >
          📎 Lampiran &gt; 10MB
        </button>
        <button
          type="button"
          onClick={() => handleSend("Mengapa gambar di dalam email saya tidak muncul?")}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
        >
          🖼️ Gambar Terblokir
        </button>
        <button
          type="button"
          onClick={() => handleSend("Bagaimana cara mengamankan akun dan menghentikan sesi mencurigakan?")}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
        >
          🔒 Sesi &amp; 2FA
        </button>
        <button
          type="button"
          onClick={() => handleSend("Bagaimana cara memulihkan dokumen yang berumur lebih dari 90 hari?")}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
        >
          💾 Berkas &gt; 90 Hari
        </button>
        <button
          type="button"
          onClick={() => handleSend("Berapa lama tiket support saya diproses?")}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:border-primary hover:text-primary transition"
        >
          🎫 SLA 1x24 Jam
        </button>
      </div>

      {/* Input Footer */}
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
    </div>
  );
}
