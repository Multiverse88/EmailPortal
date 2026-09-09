"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCompanionStore } from "@/lib/companion/companion-store";
import { getContextualTip } from "@/lib/companion/ai-engine";
import { CompanionAvatar } from "./companion-avatar";
import { CompanionDialog } from "./companion-dialog";
import { SupportTicketModal } from "@/components/support-ticket-modal";

export function ElCompanion() {
  const pathname = usePathname();
  const { setPose, showBubble, backendStatus } = useCompanionStore();

  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportModalConfig, setSupportModalConfig] = useState<{
    category?: string;
    subject?: string;
    message?: string;
    priority?: "normal" | "urgent";
  }>({});

  // Do not show companion on login or auth callback routes
  const isExcludedRoute = !pathname || pathname === "/login" || pathname.startsWith("/auth");

  // Listen to custom easylegal:open-support events
  useEffect(() => {
    const handleOpenSupport = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSupportModalConfig(customEvent.detail || {});
      setSupportModalOpen(true);
    };

    window.addEventListener("easylegal:open-support", handleOpenSupport);
    return () => {
      window.removeEventListener("easylegal:open-support", handleOpenSupport);
    };
  }, []);

  // React contextually to route navigation and show proactive tips
  useEffect(() => {
    if (isExcludedRoute) return;

    const tip = getContextualTip(pathname);
    setPose(tip.pose);

    // Provide occasional proactive speech bubble when switching to sensitive pages like /settings or /documents
    if (pathname.includes("/settings") || pathname.includes("/documents")) {
      showBubble(tip.text, tip.pose, 7000);
    }
  }, [pathname, isExcludedRoute, setPose, showBubble]);

  if (isExcludedRoute || (backendStatus && !backendStatus.active)) {
    return null;
  }

  return (
    <>
      <CompanionAvatar />
      <CompanionDialog
        onOpenSupport={(cfg) => {
          if (cfg) setSupportModalConfig(cfg);
          setSupportModalOpen(true);
        }}
      />
      <SupportTicketModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        initialCategory={supportModalConfig.category || "Retensi & Masa Aktif Akun"}
        initialSubject={supportModalConfig.subject || "Permohonan Informasi / Perpanjangan Masa Retensi Akun"}
        initialMessage={supportModalConfig.message || "Halo Tim Support EasyLegal,\n\nSaya ingin menanyakan perihal masa aktif akun saya serta permohonan perpanjangan retensi dokumen.\n\nTerima kasih."}
        initialPriority={supportModalConfig.priority || "normal"}
      />
    </>
  );
}
