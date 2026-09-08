'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Mail, Shield, KeyRound, Check, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (newPassword !== confirm) return setError('Konfirmasi password tidak cocok');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setOk('Password berhasil diubah');
      setCurrent('');
      setNew('');
      setConfirm('');
    } catch (err) {
      setError(errMsg(err, 'Gagal mengubah password'));
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/90 h-16 flex items-center px-4 sm:px-6 sticky top-0 z-30 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-inbox"
            onClick={() => router.push('/inbox')}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Kembali ke Kotak Masuk"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kotak Masuk</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-900">Pengaturan Akun</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            data-testid="nav-settings"
            onClick={() => router.push('/settings')}
            className="p-2 text-primary bg-primary/10 rounded-xl text-xs font-semibold hidden sm:flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4" />
            <span>Keamanan</span>
          </button>

          <button
            data-testid="logout"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-medium flex items-center gap-1"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Header Title */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Profil & Keamanan Akun
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Kelola informasi identitas mailbox dan setelan keamanan kata sandi Anda.
            </p>
          </div>

          {/* Account Profile Card */}
          <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white font-bold text-lg flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                {initials(user?.name || user?.email)}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{user?.name || 'Customer'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Mailbox Aktif
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500 font-mono">Hostinger Titan Mail</span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <dt className="text-slate-400 font-medium mb-1">Nama Lengkap</dt>
                <dd className="text-slate-900 font-semibold text-sm">{user?.name || '-'}</dd>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <dt className="text-slate-400 font-medium mb-1">Alamat Email Mailbox</dt>
                <dd data-testid="account-email" className="text-primary font-semibold text-sm font-mono truncate">
                  {user?.email || '-'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Change Password Card */}
          <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Ubah Kata Sandi</h2>
            </div>
            
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Pastikan kata sandi baru memenuhi standar keamanan: minimal 8 karakter, kombinasi huruf besar, huruf kecil, dan angka.
            </p>

            {error && (
              <div
                data-testid="pw-error"
                role="alert"
                className="mb-5 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {ok && (
              <div
                data-testid="pw-success"
                role="status"
                className="mb-5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{ok}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="current" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password Saat Ini
                </label>
                <input
                  id="current"
                  data-testid="pw-current"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password Baru
                  </label>
                  <input
                    id="new"
                    data-testid="pw-new"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNew(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    id="confirm"
                    data-testid="pw-confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  data-testid="pw-submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:opacity-95 disabled:opacity-60 transition-all shadow-md shadow-primary/20 active:scale-[0.98]"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan Perubahan Password</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
