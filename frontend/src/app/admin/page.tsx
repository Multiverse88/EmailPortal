'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Loader2,
  Plus,
  Copy,
  Search,
  X,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  HardDrive,
  UserCheck,
  UserX,
  LogOut,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
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

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  const { data, mutate, isLoading } = useSWR<{ data: Mailbox[]; quota: { used: number; limit: number } }>(
    '/mailboxes?limit=100',
    fetcher
  );

  const handleSeedDemo = async () => {
    if (
      !window.confirm(
        'Muat ulang data demo lengkap (8 akun mailbox, 21 email dummy dengan lampiran file asli)?'
      )
    ) {
      return;
    }
    setSeeding(true);
    try {
      const res = await api.post('/mailboxes/seed-demo');
      setToast(res.data.message || 'Data demo berhasil dimuat ulang!');
      await mutate();
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setToast(errMsg(err, 'Gagal memuat data demo'));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSeeding(false);
    }
  };

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

  const copyPassword = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailboxes = data?.data ?? [];
  const quota = data?.quota;

  const activeCount = mailboxes.filter((m) => m.status === 'active').length;
  const inactiveCount = mailboxes.filter((m) => m.status === 'inactive').length;

  const filteredMailboxes = mailboxes.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.mailboxAddress && m.mailboxAddress.toLowerCase().includes(q)) ||
      (m.personalEmail && m.personalEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/90 w-full h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-sm shadow-primary/20">
            <Mail className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                EasyLegal Admin Hub
              </span>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Console
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Hostinger Mailbox Provisioning • clienteasylegal.co.id
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/inbox')}
            className="text-xs font-semibold text-slate-600 hover:text-primary hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-colors hidden sm:flex items-center gap-1.5"
          >
            <span>Buka Webmail</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex flex-col text-right hidden md:block">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {user?.name || 'Administrator'}
              </span>
              <span data-testid="admin-user" className="text-[10px] text-slate-500 font-mono">
                {user?.email}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center ring-2 ring-primary/20">
              {initials(user?.name || 'AD')}
            </div>

            <button
              data-testid="logout"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-0.5"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Top Banner & KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Quota */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Kuota Mailbox Hostinger</span>
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div data-testid="quota" className="text-2xl font-bold text-slate-900 tracking-tight">
                {quota ? `${quota.used} / ${quota.limit}` : '—'}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 mb-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${quota ? Math.max((quota.used / quota.limit) * 100, 4) : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {quota ? `${quota.limit - quota.used} mailbox tersisa` : 'Free Business Email'}
              </span>
            </div>
          </div>

          {/* Card 2: Active */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Mailbox Aktif</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600 tracking-tight">
                {activeCount}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-2">
                Dapat mengirim & menerima email
              </p>
            </div>
          </div>

          {/* Card 3: Inactive */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Ditangguhkan / Nonaktif</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 tracking-tight">
                {inactiveCount}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-2">
                Akses login sementara dinonaktifkan
              </p>
            </div>
          </div>

          {/* Card 4: Domain Status */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Routing Domain</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 truncate font-mono">
                clienteasylegal.co.id
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Titan Mail MX & SPF Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Temporary Password Banner (After Creation) */}
        {created && (
          <div
            data-testid="created-credentials"
            className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-5 shadow-sm animate-in fade-in"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Mailbox Berhasil Dibuat: <span className="font-mono text-emerald-900">{created.mailboxAddress}</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-emerald-800 font-medium">Password Sementara:</span>
                    <code
                      data-testid="temp-password"
                      className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 font-mono text-xs font-bold text-emerald-900 shadow-xs"
                    >
                      {created.temporaryPassword}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyPassword(created.temporaryPassword)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-colors"
                    >
                      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Tersalin!' : 'Salin Password'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-2">
                    Sampaikan password ini ke customer lewat jalur komunikasi aman (WhatsApp / telepon). Kata sandi tidak akan ditampilkan lagi.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreated(null)}
                className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Header & Search Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              data-testid="admin-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, alamat mailbox, atau email pribadi..."
              className="w-full pl-10 pr-9 py-2.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                data-testid="admin-search-clear"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="seed-demo-btn"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all border border-slate-200/80 disabled:opacity-50"
              title="Muat ulang 8 customer demo & 21 email dummy"
            >
              {seeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{seeding ? 'Memuat Demo...' : 'Muat Data Demo'}</span>
            </button>

            <button
              data-testid="new-mailbox"
              onClick={() => {
                setShowForm(true);
                setCreated(null);
              }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-95 shadow-md shadow-primary/20 active:scale-[0.98] transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Mailbox Baru</span>
            </button>
          </div>
        </div>

        {/* Mailbox Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="mailbox-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">Nama & Identitas</th>
                  <th className="px-5 py-3.5">Alamat Mailbox</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Email Pribadi</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Login Terakhir</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span>Memuat data mailbox...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && mailboxes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400" data-testid="admin-empty">
                      Belum ada mailbox customer terdaftar.
                    </td>
                  </tr>
                )}

                {!isLoading && mailboxes.length > 0 && filteredMailboxes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      Tidak ada customer yang cocok dengan kata kunci &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                )}

                {filteredMailboxes.map((m) => {
                  const isActive = m.status === 'active';
                  return (
                    <tr
                      key={m.id}
                      data-testid="mailbox-row"
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {initials(m.name)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">{m.name}</span>
                            <span className="text-[10px] text-slate-400">
                              Dibuat: {format(new Date(m.createdAt), 'd MMM yyyy', { locale: localeId })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Mailbox address */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                          {m.mailboxAddress}
                        </span>
                      </td>

                      {/* Personal email */}
                      <td className="px-5 py-3.5 hidden md:table-cell text-slate-500 font-mono text-[11px]">
                        {m.personalEmail}
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500">
                        {m.lastLoginAt
                          ? format(new Date(m.lastLoginAt), 'd MMM, HH:mm', { locale: localeId })
                          : <span className="text-slate-400 italic">Belum pernah</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {m.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {m.status === 'active' && (
                            <button
                              data-testid="deactivate"
                              onClick={() => act(() => api.post(`/mailboxes/${m.id}/deactivate`), 'Mailbox dinonaktifkan')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200/80"
                            >
                              Nonaktifkan
                            </button>
                          )}
                          {m.status === 'inactive' && (
                            <button
                              data-testid="reactivate"
                              onClick={() => act(() => api.post(`/mailboxes/${m.id}/reactivate`), 'Mailbox diaktifkan')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200/80"
                            >
                              Aktifkan
                            </button>
                          )}
                          {m.status !== 'deleted' && (
                            <button
                              data-testid="delete-mailbox"
                              onClick={() => act(() => api.delete(`/mailboxes/${m.id}`), 'Mailbox dihapus')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200/80"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* New Mailbox Modal */}
      {showForm && (
        <NewMailboxForm
          onClose={() => setShowForm(false)}
          onCreated={(res) => {
            setCreated(res);
            setShowForm(false);
            mutate();
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toast}</span>
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <form
        onSubmit={submit}
        data-testid="mailbox-form"
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-primary to-primary-container text-white select-none">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Buat Mailbox Customer Baru</h2>
          </div>
          <button
            type="button"
            data-testid="form-close"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {error && (
            <div
              data-testid="form-error"
              role="alert"
              className="bg-red-50 text-red-700 border border-red-200/80 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap Customer / Perusahaan
            </label>
            <input
              id="name"
              data-testid="form-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: PT Sinar Jaya / Hendra Setiawan"
              className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div>
            <label htmlFor="personalEmail" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Pribadi (Untuk Menerima Info Login)
            </label>
            <input
              id="personalEmail"
              data-testid="form-personal"
              type="email"
              required
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="hendra@gmail.com"
              className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div>
            <label htmlFor="localPart" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alamat Mailbox yang Diinginkan
            </label>
            <div className="flex items-center">
              <input
                id="localPart"
                data-testid="form-localpart"
                required
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="hendra"
                className="flex-1 px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-l-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="px-3.5 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-xs font-mono font-medium text-slate-600 select-none">
                @{process.env.NEXT_PUBLIC_HOSTINGER_DOMAIN || 'clienteasylegal.co.id'}
              </span>
            </div>
          </div>
        </div>

        <footer className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            data-testid="form-cancel"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            data-testid="form-submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-95 disabled:opacity-60 transition-all shadow-md shadow-primary/20 active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Buat Mailbox</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
