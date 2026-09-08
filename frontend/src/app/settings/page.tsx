'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';

export default function SettingsPage() {
  return (
    <AuthGuard type="customer">
      <Settings_ />
    </AuthGuard>
  );
}

function Settings_() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setOk('');
    if (newPassword !== confirm) return setError('Konfirmasi password tidak cocok');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setOk('Password berhasil diubah');
      setCurrent(''); setNew(''); setConfirm('');
    } catch (err) {
      setError(errMsg(err, 'Gagal mengubah password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <nav className="bg-surface border-b border-surface-variant h-16 flex items-center px-md sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-xl flex-1">
          <button data-testid="back-inbox" onClick={() => router.push('/inbox')} className="p-sm rounded-full hover:bg-surface-variant/50 transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
            <span className="text-page-title font-page-title text-on-surface hidden sm:block">MailPortal</span>
          </div>
          <div className="flex-1 max-w-[720px] mx-xl hidden md:flex items-center bg-surface-container-high rounded-full px-md py-sm gap-sm">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input className="w-full bg-transparent border-none focus:ring-0 text-body-text text-on-surface placeholder:text-on-surface-variant" placeholder="Search in mail" type="text" />
          </div>
        </div>
        <div className="flex items-center gap-sm ml-auto">
          <button data-testid="nav-settings" onClick={() => router.push('/settings')} className="p-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors hidden sm:flex">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="ml-sm h-8 w-8 rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">account_circle</span>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-sidebar-width flex-shrink-0 bg-background border-r border-surface-variant flex-col h-[calc(100vh-64px)] sticky top-16">
          <div className="px-md mb-md">
            <button data-testid="compose-open" className="flex items-center gap-sm bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container px-lg py-md rounded-xl transition-all shadow-sm w-full">
              <span className="material-symbols-outlined fill text-[20px]">edit</span>
              <span className="font-label-button text-label-button">Compose</span>
            </button>
          </div>
          <nav className="flex-1 px-sm">
            <ul className="flex flex-col gap-[2px]">
              {[
                { label: 'Inbox', icon: 'inbox', route: '/inbox' },
                { label: 'Sent', icon: 'send', route: '/inbox' },
                { label: 'Drafts', icon: 'draft', route: '/inbox' },
                { label: 'Trash', icon: 'delete', route: '/inbox' },
              ].map((item) => (
                <li key={item.label}>
                  <button onClick={() => router.push(item.route)} className="w-full flex items-center gap-md px-lg py-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-r-full transition-all duration-200 active:scale-95">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="font-label-button text-label-button flex-1 text-left">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto px-sm pb-md">
            <a className="flex items-center gap-md px-lg py-sm bg-primary-container text-on-primary-container rounded-r-full font-bold transition-all duration-200 active:scale-95" href="/settings">
              <span className="material-symbols-outlined text-[20px] fill">settings</span>
              <span className="font-label-button text-label-button">Settings</span>
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-lg md:px-xl">
          <h1 className="text-page-title font-page-title text-on-surface mb-lg">Pengaturan</h1>

          <section className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg mb-lg">
            <h2 className="font-medium text-on-surface mb-md text-body-text-lg">Akun</h2>
            <dl className="text-body-text space-y-md">
              <div className="flex justify-between items-center">
                <dt className="text-on-surface-variant">Nama</dt>
                <dd className="text-on-surface font-medium">{user?.name}</dd>
              </div>
              <div className="flex justify-between items-center border-t border-surface-variant pt-md">
                <dt className="text-on-surface-variant">Alamat email</dt>
                <dd data-testid="account-email" className="text-on-surface font-medium">{user?.email}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg">
            <h2 className="font-medium text-on-surface mb-sm text-body-text-lg">Ubah Password</h2>
            <p className="text-label-secondary text-on-surface-variant mb-lg">
              Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.
            </p>

            {error && (
              <div data-testid="pw-error" role="alert" className="mb-md bg-error-container text-on-error-container px-md py-sm rounded-lg text-sm">
                {error}
              </div>
            )}
            {ok && (
              <div data-testid="pw-success" role="status" className="mb-md bg-surface-container-low text-on-surface px-md py-sm rounded-lg text-sm border border-surface-variant">
                {ok}
              </div>
            )}

            <form onSubmit={submit} className="space-y-md">
              <div>
                <label htmlFor="current" className="block text-sm font-medium text-on-surface-variant mb-xs">Password saat ini</label>
                <input
                  id="current"
                  data-testid="pw-current"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label htmlFor="new" className="block text-sm font-medium text-on-surface-variant mb-xs">Password baru</label>
                <input
                  id="new"
                  data-testid="pw-new"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNew(e.target.value)}
                  className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-on-surface-variant mb-xs">Konfirmasi password baru</label>
                <input
                  id="confirm"
                  data-testid="pw-confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                />
              </div>
              <button
                type="submit"
                data-testid="pw-submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary-container text-on-primary-container px-6 py-sm rounded-full text-sm font-medium hover:bg-primary-container/90 disabled:opacity-60 transition-colors shadow-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
