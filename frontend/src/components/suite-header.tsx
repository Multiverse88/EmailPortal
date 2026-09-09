'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, Scale } from 'lucide-react';
import { AppLauncher, AppId } from '@/components/app-launcher';

interface SuiteHeaderProps {
  currentApp?: AppId;
  product: string;
  description?: string;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  search?: ReactNode;
  actions?: ReactNode;
  onMenu?: () => void;
  onLogout?: () => void;
  admin?: boolean;
}

const initials = (name?: string | null) => {
  if (!name) return 'EL';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export function SuiteHeader({
  currentApp,
  product,
  description,
  userName,
  userEmail,
  avatarUrl,
  search,
  actions,
  onMenu,
  onLogout,
  admin = false,
}: SuiteHeaderProps) {
  const router = useRouter();

  return (
    <header className="suite-header">
      <div className="flex min-w-0 items-center gap-3">
        {onMenu && (
          <button
            type="button"
            aria-label="Menu"
            data-testid="menu-toggle"
            className="app-icon-button md:hidden"
            onClick={onMenu}
          >
            <Menu className="size-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push(admin ? '/admin' : '/inbox')}
          className="group flex min-w-0 items-center gap-3 rounded-xl text-left"
          aria-label={admin ? 'EasyLegal Admin' : 'EasyLegal Hub'}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs transition-transform group-active:scale-95">
            <Scale className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-bold tracking-[-0.02em] text-slate-950">
              <span>EasyLegal</span>{' '}
              <span className="font-medium text-slate-500">{admin ? 'Admin' : product}</span>
            </span>
            <span className="block truncate text-[10px] font-medium text-slate-500">
              {description}
            </span>
          </span>
        </button>
      </div>

      {search && <div className="hidden min-w-0 flex-1 px-4 md:block">{search}</div>}

      {!search && (
        <div className="hidden min-w-0 flex-1 px-6 md:block">
          <p className="truncate text-center text-xs font-medium text-slate-500">{description}</p>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {actions}
        {!admin && <AppLauncher currentApp={currentApp} />}

        <button
          type="button"
          data-testid={admin ? 'admin-profile' : 'nav-settings'}
          onClick={() => {
            if (!admin) router.push('/settings');
          }}
          className="ml-1 flex items-center gap-2 rounded-xl border border-transparent p-1 transition-colors hover:border-border-subtle hover:bg-white"
          title="Pengaturan akun"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName || 'Logo'}
              className="size-8 rounded-lg object-contain bg-white border border-slate-200 shadow-2xs"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              {initials(userName || userEmail)}
            </span>
          )}
          <span className="hidden max-w-[150px] text-left lg:block">
            <span className="block truncate text-[11px] font-semibold text-slate-800">
              {userName || (admin ? 'Administrator' : 'Customer')}
            </span>
            <span className="block truncate text-[10px] text-slate-500">{userEmail || ''}</span>
          </span>
        </button>

        {onLogout && (
          <button
            type="button"
            data-testid="logout"
            onClick={onLogout}
            className="app-icon-button hover:!bg-red-50 hover:!text-red-700"
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}
