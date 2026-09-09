"use client";

import { useState } from "react";
import { useCompanionStore } from "@/lib/companion/companion-store";
import { POSE_ASSETS } from "@/lib/companion/types";
import { use3DTilt } from "./use-3d-tilt";
import { X, Sparkles } from "lucide-react";

export function CompanionAvatar() {
  const { isOpen, isMinimized, pose, bubble, toggleChat, setMinimized, hideBubble } =
    useCompanionStore();
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const { ref, style, shadowStyle, handlePointerEnter, handlePointerLeave } = use3DTilt({
    maxTilt: 16,
    perspective: 500,
  });

  if (isOpen) return null;

  // Minimized peek mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-0 z-40 flex items-center">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group relative flex items-center rounded-l-2xl border-y border-l border-primary/20 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur transition-transform hover:-translate-x-1"
          title="Tampilkan El"
        >
          <img
            src={POSE_ASSETS.peeking}
            alt="El Peeking"
            className="size-10 object-contain drop-shadow-sm transition-transform group-hover:scale-110"
          />
          <span className="ml-1 text-xs font-bold text-primary">El</span>
        </button>
      </div>
    );
  }

  const assetSrc = POSE_ASSETS[pose] || POSE_ASSETS.greeting;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end select-none">
      {/* Spontaneous thought / tip speech bubble */}
      {bubble ? (
        <div className="relative mb-2 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl border border-primary/20 bg-white/95 p-3 text-xs leading-relaxed text-slate-800 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="flex items-center gap-1 font-bold text-primary text-[11px]">
                <Sparkles className="size-3.5" />
                Tips dari El
              </span>
              <button
                type="button"
                onClick={hideBubble}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Tutup tips"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="line-clamp-4">{bubble.text}</p>
            <button
              type="button"
              onClick={toggleChat}
              className="mt-2 text-[11px] font-semibold text-primary underline underline-offset-2 hover:text-primary-container"
            >
              Tanya lebih lanjut &rarr;
            </button>
          </div>
          {/* Speech bubble tail pointer */}
          <div className="absolute right-8 -bottom-1.5 size-3 rotate-45 border-b border-r border-primary/20 bg-white" />
        </div>
      ) : (
        /* Friendly Invitation Callout Bubble above robot icon */
        !calloutDismissed && (
          <div className="relative mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              onClick={toggleChat}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleChat();
                }
              }}
              className="group/callout flex items-center gap-2 rounded-2xl border border-primary/25 bg-white/95 px-3.5 py-2 text-xs shadow-xl backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-2xl cursor-pointer"
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <div className="flex items-center gap-1 text-xs">
                <span className="font-medium text-slate-700">Ada kendala?</span>
                <span className="font-bold text-primary group-hover/callout:underline underline-offset-2">
                  Silakan kabari saya!
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCalloutDismissed(true);
                }}
                className="ml-1 -mr-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Tutup pesan ajakan"
                title="Tutup pesan"
              >
                <X className="size-3" />
              </button>
            </div>
            {/* Speech bubble tail pointer */}
            <div className="absolute right-8 -bottom-1.5 size-3 rotate-45 border-b border-r border-primary/25 bg-white pointer-events-none" />
          </div>
        )
      )}

      {/* 3D Parallax Floating Avatar */}
      <div
        ref={ref}
        style={style}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className="group relative cursor-pointer"
        onClick={toggleChat}
      >
        <div style={shadowStyle} className="animate-el-breathe">
          <img
            src={assetSrc}
            alt="El Companion"
            className="h-28 w-auto object-contain transition-all duration-300 group-hover:scale-105"
            draggable={false}
          />
        </div>

        {/* Hover Hint Badge (only if callout dismissed) */}
        {calloutDismissed && (
          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/85 px-2.5 py-0.5 text-[10px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            Klik untuk ngobrol ✨
          </div>
        )}
      </div>
    </div>
  );
}
