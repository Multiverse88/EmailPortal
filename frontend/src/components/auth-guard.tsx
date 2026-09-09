'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export function AuthGuard({
  type,
  children,
}: {
  type: 'customer' | 'admin';
  children: React.ReactNode;
}) {
  const { adminToken, adminUser, customerToken, customerUser, ready, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;

    if (type === 'admin') {
      if (!adminToken || !adminUser) {
        // If only customer session is active, redirect to inbox
        if (customerToken && customerUser) {
          router.replace('/inbox');
        } else {
          router.replace('/login');
        }
      }
    } else {
      // type === 'customer'
      if (!customerToken || !customerUser) {
        router.replace('/login');
      }
    }
  }, [ready, type, adminToken, adminUser, customerToken, customerUser, router]);

  const isAuthorized =
    ready &&
    ((type === 'admin' && !!adminToken && adminUser?.type === 'admin') ||
      (type === 'customer' && !!customerToken && customerUser?.type === 'customer'));

  if (!isAuthorized) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-slate-500" role="status" aria-label="Memuat sesi">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Memuat sesi...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
