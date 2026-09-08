'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined text-on-surface-variant text-[24px] animate-spin">progress_activity</span>
      </div>
    );
  }
  return <>{children}</>;
}
