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
  const { token, user, ready, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => {
    if (!ready) return;
    if (!token || !user) router.replace('/login');
    else if (user.type !== type) router.replace(user.type === 'admin' ? '/admin' : '/inbox');
  }, [ready, token, user, type, router]);

  if (!ready || !token || user?.type !== type) {
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
