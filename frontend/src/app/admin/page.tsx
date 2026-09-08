'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Loader2, Plus, Copy } from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';

interface Mailbox {
  id: string;
  name: string;
  personalEmail: string;
  mailboxAddress: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  messageCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-surface-container text-on-surface border border-surface-variant',
  inactive: 'bg-surface-variant text-on-surface-variant border border-outline-variant',
  deleted: 'bg-surface-container-high text-on-surface-variant border border-surface-variant',
};

export default function AdminPage() {
  return (
    <AuthGuard type="admin">
      <Admin_ />
    </AuthGuard>
  );
}

function Admin_() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ mailboxAddress: string; temporaryPassword: string } | null>(null);
  const [toast, setToast] = useState('');

  const { data, mutate, isLoading } = useSWR<{ data: Mailbox[]; quota: { used: number; limit: number } }>(
    '/mailboxes?limit=100', fetcher
  );

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      setToast(message);
      mutate();
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setToast(errMsg(e));
      setTimeout(() => setToast(''), 3000);
    }
  };

  const mailboxes = data?.data ?? [];
  const quota = data?.quota;

  return (
    <div className="min-h-screen bg-surface-container-lowest flex flex-col">
      {/* Top Nav */}
      <header className="bg-surface border-b border-surface-variant w-full h-16 flex items-center px-md sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-xl flex-1">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
            <span className="text-page-title font-page-title text-on-surface font-bold hidden sm:block">MailPortal</span>
          </div>
          <div className="flex-1 max-w-[720px] hidden md:flex">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline">search</span>
              </div>
              <input className="block w-full pl-xl pr-md py-sm rounded-full bg-surface-container-high border-none text-body-text text-on-surface focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors placeholder:text-on-surface-variant" placeholder="Search users..." type="text" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-sm ml-auto">
          <span data-testid="admin-user" className="text-label-secondary text-on-surface-variant hidden lg:block">{user?.email}</span>
          <button data-testid="logout" onClick={() => { logout(); router.replace('/login'); }} className="p-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" title="Logout">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-sidebar-width flex-shrink-0 bg-background border-r border-surface-variant flex-col h-full">
          <div className="px-md mb-md">
            <button onClick={() => router.push('/inbox')} className="bg-primary-container text-on-primary-container font-label-button text-label-button py-sm px-lg rounded-full shadow-sm hover:shadow-md transition-shadow flex items-center gap-sm w-auto">
              <span className="material-symbols-outlined fill text-[16px]">edit</span>
              Compose
            </button>
          </div>
          <ul className="flex flex-col gap-xs flex-grow px-sm">
            {[
              { label: 'Inbox', icon: 'inbox' },
              { label: 'Starred', icon: 'star' },
              { label: 'Sent', icon: 'send' },
              { label: 'Drafts', icon: 'draft' },
            ].map((item) => (
              <li key={item.label}>
                <button onClick={() => router.push('/inbox')} className="flex items-center gap-md px-lg py-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-r-full transition-all duration-200 active:scale-95 w-full">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-label-button text-label-button">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto px-sm pb-md">
            <button className="flex items-center gap-md px-lg py-sm bg-secondary-container text-on-secondary-container rounded-r-full font-bold transition-all duration-200 active:scale-95 w-full">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span className="font-label-button text-label-button">Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-lg md:px-xl">
          <div className="flex items-center justify-between gap-md flex-wrap mb-lg">
            <div>
              <h1 className="text-page-title font-page-title text-on-surface">Admin Dashboard</h1>
              <p className="text-label-secondary text-on-surface-variant mt-1">Kelola mailbox customer</p>
            </div>
            <div className="flex items-center gap-md">
              <div data-testid="quota" className="flex items-center gap-sm px-md py-sm bg-surface rounded-xl border border-surface-variant">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">mail</span>
                <span className="text-label-button text-on-surface font-medium">
                  {quota ? `${quota.used} / ${quota.limit}` : '—'}
                </span>
              </div>
              <button
                data-testid="new-mailbox"
                onClick={() => { setShowForm(true); setCreated(null); }}
                className="flex items-center gap-sm bg-primary-container text-on-primary-container px-4 py-sm rounded-full text-label-button font-label-button hover:bg-primary-container/90 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Mailbox Baru
              </button>
            </div>
          </div>

          {created && (
            <div data-testid="created-credentials" className="bg-surface rounded-xl border border-surface-variant p-lg mb-lg">
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-primary mt-1">check_circle</span>
                <div className="flex-1">
                  <p className="font-medium text-on-surface mb-1">Mailbox dibuat: {created.mailboxAddress}</p>
                  <p className="text-on-surface-variant text-sm">
                    Password sementara:{' '}
                    <code data-testid="temp-password" className="bg-surface-container-high px-2 py-0.5 rounded border border-surface-variant text-sm">{created.temporaryPassword}</code>
                  </p>
                  <p className="text-label-secondary text-on-surface-variant mt-2 flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Sampaikan lewat kanal aman (WA/telepon). Password ini tidak ditampilkan lagi.
                  </p>
                </div>
                <button onClick={() => setCreated(null)} className="p-1 rounded hover:bg-surface-variant transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
                </button>
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-body-text" data-testid="mailbox-table">
                <thead>
                  <tr className="border-b border-surface-variant">
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant">Nama</th>
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant">Mailbox</th>
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant hidden md:table-cell">Email Pribadi</th>
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant hidden sm:table-cell">Pesan</th>
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant">Status</th>
                    <th className="px-lg py-md text-left font-medium text-on-surface-variant">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={6} className="px-lg py-8 text-center text-on-surface-variant">Memuat...</td></tr>
                  )}
                  {!isLoading && mailboxes.length === 0 && (
                    <tr><td colSpan={6} className="px-lg py-8 text-center text-on-surface-variant" data-testid="admin-empty">Belum ada mailbox</td></tr>
                  )}
                  {mailboxes.map((m) => (
                    <tr key={m.id} data-testid="mailbox-row" className="border-b border-surface-variant hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-lg py-md text-on-surface font-medium">{m.name}</td>
                      <td className="px-lg py-md text-on-surface">{m.mailboxAddress}</td>
                      <td className="px-lg py-md text-on-surface-variant hidden md:table-cell">{m.personalEmail}</td>
                      <td className="px-lg py-md text-on-surface-variant hidden sm:table-cell">{m.messageCount}</td>
                      <td className="px-lg py-md">
                        <span className={`px-2 py-0.5 rounded-md text-label-secondary font-medium ${STATUS_STYLE[m.status] ?? ''}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-lg py-md">
                        <div className="flex items-center gap-sm row-hover-actions">
                          {m.status === 'active' && (
                            <button
                              data-testid="deactivate"
                              onClick={() => act(() => api.post(`/mailboxes/${m.id}/deactivate`), 'Mailbox dinonaktifkan')}
                              className="text-primary hover:text-primary/80 text-sm transition-colors"
                            >
                              Nonaktifkan
                            </button>
                          )}
                          {m.status === 'inactive' && (
                            <button
                              data-testid="reactivate"
                              onClick={() => act(() => api.post(`/mailboxes/${m.id}/reactivate`), 'Mailbox diaktifkan')}
                              className="text-primary hover:text-primary/80 text-sm transition-colors"
                            >
                              Aktifkan
                            </button>
                          )}
                          {m.status !== 'deleted' && (
                            <button
                              data-testid="delete-mailbox"
                              onClick={() => act(() => api.delete(`/mailboxes/${m.id}`), 'Mailbox dihapus')}
                              className="text-error hover:text-error/80 text-sm transition-colors"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* New Mailbox Modal */}
      {showForm && (
        <NewMailboxForm
          onClose={() => setShowForm(false)}
          onCreated={(res) => { setCreated(res); setShowForm(false); mutate(); }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-on-surface text-surface-container-lowest text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function NewMailboxForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: { mailboxAddress: string; temporaryPassword: string }) => void;
}) {
  const [name, setName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/auth/register', { name, personalEmail, localPart });
      onCreated(res.data);
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat mailbox'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} data-testid="mailbox-form" className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-variant">
        <header className="flex items-center justify-between px-lg py-md border-b border-surface-variant">
          <h2 className="font-medium text-on-surface text-label-button">Buat Mailbox Baru</h2>
          <button type="button" data-testid="form-close" onClick={onClose} className="p-1 rounded hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </header>
        <div className="p-lg space-y-md">
          {error && (
            <div data-testid="form-error" role="alert" className="bg-error-container text-on-error-container px-md py-sm rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-xs">Nama customer</label>
            <input
              id="name"
              data-testid="form-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="personalEmail" className="block text-sm font-medium text-on-surface-variant mb-xs">Email pribadi (untuk notifikasi)</label>
            <input
              id="personalEmail"
              data-testid="form-personal"
              type="email"
              required
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="localPart" className="block text-sm font-medium text-on-surface-variant mb-xs">Local part</label>
            <div className="flex items-center">
              <input
                id="localPart"
                data-testid="form-localpart"
                required
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                className="flex-1 px-md py-sm bg-surface rounded-l-xl border border-outline-variant text-body-text text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
              <span className="px-md py-sm bg-surface-container border border-l-0 border-outline-variant rounded-r-xl text-sm text-on-surface-variant">
                @easylegal.co.id
              </span>
            </div>
          </div>
        </div>
        <footer className="px-lg py-md border-t border-surface-variant flex justify-end gap-sm">
          <button type="button" onClick={onClose} className="px-4 py-sm text-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-lg transition-colors">
            Batal
          </button>
          <button type="submit" data-testid="form-submit" disabled={saving}
            className="flex items-center gap-2 bg-primary-container text-on-primary-container px-5 py-sm rounded-full text-sm font-medium hover:bg-primary-container/90 disabled:opacity-60 transition-colors shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Buat
          </button>
        </footer>
      </form>
    </div>
  );
}
