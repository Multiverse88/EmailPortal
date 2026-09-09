'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

function ImpersonateBridgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    try {
      const token = searchParams.get('token');
      const userRaw = searchParams.get('user');
      const officerRaw = searchParams.get('officer');

      if (!token || !userRaw) {
        setStatus('error');
        setErrorMessage('Parameter token atau pengguna tidak valid');
        return;
      }

      const user = JSON.parse(decodeURIComponent(userRaw));
      if (officerRaw) {
        const officer = JSON.parse(decodeURIComponent(officerRaw));
        localStorage.setItem('staff_impersonation', JSON.stringify(officer));
      }

      setAuth(token, user, 'customer');
      router.replace('/inbox');
    } catch (err: any) {
      console.error('Impersonation bridge error:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Gagal memproses sesi impersonasi');
    }
  }, [router, searchParams, setAuth]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full p-6 bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Gagal Membuka Sesi Customer</h2>
          <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Tutup Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-semibold">Membuka sesi customer dengan otorisasi staf...</span>
      </div>
    </div>
  );
}

export default function ImpersonateBridgePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-semibold">Memuat otorisasi staf...</span>
          </div>
        </div>
      }
    >
      <ImpersonateBridgeContent />
    </Suspense>
  );
}
