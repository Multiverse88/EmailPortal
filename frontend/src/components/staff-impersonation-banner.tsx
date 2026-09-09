'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ImpersonationMeta {
  email: string;
  role: string;
}

export function StaffImpersonationBanner({
  customerName,
  customerEmail,
}: {
  customerName?: string;
  customerEmail?: string;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('staff_impersonation');
      if (raw) {
        setMeta(JSON.parse(raw));
      }
    } catch {
      setMeta(null);
    }
  }, []);

  if (!meta) return null;

  const handleExit = () => {
    localStorage.removeItem('staff_impersonation');
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-between shadow-xs sticky top-0 z-50 border-b border-amber-600/30">
      <div className="flex items-center gap-2 truncate">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
          <ShieldAlert className="size-3" />
        </span>
        <span className="truncate">
          <strong className="font-bold">Mode Akses Staf Legal ({meta.role}):</strong> Anda sedang mengelola mailbox{' '}
          <span className="font-mono underline underline-offset-2">{customerEmail || 'klien'}</span>
          {customerName ? ` (${customerName})` : ''} oleh{' '}
          <span className="font-semibold">{meta.email}</span>.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-900 font-bold text-[11px] rounded-lg shadow-2xs hover:bg-amber-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3" />
          <span>Kembali ke Admin Console</span>
        </button>
      </div>
    </div>
  );
}
