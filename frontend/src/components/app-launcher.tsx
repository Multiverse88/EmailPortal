'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Mail, FileText, Ticket, Settings, Grip } from 'lucide-react';

export type AppId = 'mail' | 'documents' | 'support' | 'settings';

export interface AppLauncherProps {
  currentApp?: AppId;
}

interface AppItem {
  id: AppId;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

const APPS: AppItem[] = [
  {
    id: 'mail',
    title: 'EasyLegal Mail',
    subtitle: 'Email & Pesan',
    href: '/inbox',
    icon: Mail,
    iconBg: 'bg-primary/10 border border-primary/15',
    iconColor: 'text-primary',
  },
  {
    id: 'documents',
    title: 'Legal Documents',
    subtitle: 'Berkas & Preview Dokumen',
    href: '/documents',
    icon: FileText,
    iconBg: 'bg-primary/10 border border-primary/15',
    iconColor: 'text-primary',
  },
  {
    id: 'support',
    title: 'Support Desk',
    subtitle: 'Tiket Bantuan & FAQ',
    href: '/support',
    icon: Ticket,
    iconBg: 'bg-primary/10 border border-primary/15',
    iconColor: 'text-primary',
  },
  {
    id: 'settings',
    title: 'Settings & Security',
    subtitle: 'Pengaturan Akun & 2FA',
    href: '/settings',
    icon: Settings,
    iconBg: 'bg-primary/10 border border-primary/15',
    iconColor: 'text-primary',
  },
];

export function AppLauncher({ currentApp }: AppLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* 9-Dots Google-Style Launcher Button */}
      <button
        type="button"
        data-testid="app-launcher-btn"
        aria-label="Aplikasi EasyLegal"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`app-icon-button group ${
          isOpen
            ? 'bg-slate-100 text-[#680003] ring-2 ring-[#680003]/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Aplikasi EasyLegal"
      >
        <Grip className="size-5 transition-transform group-hover:scale-105" />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes popoverIn {
              from { opacity: 0; transform: scale(0.96) translateY(-4px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .animate-popover {
              animation: popoverIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}} />
          <div
            data-testid="app-launcher-popover"
            role="menu"
            aria-label="Menu Aplikasi"
            className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-3 z-50 animate-popover origin-top-right focus:outline-none"
          >
            {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 tracking-tight">EasyLegal Suite</span>
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                Hub
              </span>
            </div>
            <span className="text-[11px] text-slate-400">4 Aplikasi</span>
          </div>

          {/* App Items */}
          <div className="flex flex-col gap-1.5">
            {APPS.map((app) => {
              const isCurrent = currentApp === app.id;
              const Icon = app.icon;
              return (
                <Link
                  key={app.id}
                  href={app.href}
                  data-testid={`app-launcher-item-${app.id}`}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-[#680003]/10 border border-[#680003]/20 shadow-xs'
                      : 'hover:bg-slate-50 border border-transparent hover:border-slate-200/60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${app.iconBg} ${app.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-semibold leading-snug ${
                          isCurrent
                            ? 'text-[#680003] font-bold'
                            : 'text-slate-900 group-hover:text-[#680003] transition-colors'
                        }`}
                      >
                        {app.title}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#680003] text-white shrink-0">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate leading-snug">
                      {app.subtitle}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <p className="mt-2 border-t border-slate-100 px-1 pt-2 text-[11px] text-slate-400">
            Portal klien terintegrasi
          </p>
        </div>
      </>
      )}
    </div>
  );
}

export default AppLauncher;
