'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const [tab, setTab] = useState<'customer' | 'admin'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { adminToken, adminUser, customerToken, customerUser, setAuth, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/auth/login/${tab}`, { email, password });
      setAuth(res.data.token, res.data.user, tab);
      router.push(tab === 'admin' ? '/admin' : '/inbox');
    } catch (err) {
      setError(errMsg(err, 'Login gagal'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background selection:bg-primary/15 selection:text-primary lg:grid lg:grid-cols-[minmax(360px,0.82fr)_minmax(560px,1.18fr)]">
      <section className="relative hidden overflow-hidden bg-primary px-10 py-12 text-white lg:flex lg:min-h-[100dvh] lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.32),transparent_28%),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:auto,56px_56px,56px_56px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            <Mail className="size-5" strokeWidth={2} />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">EasyLegal Mail</p>
            <p className="text-xs text-white/65">clienteasylegal.co.id</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
            Portal komunikasi legal
          </p>
          <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            Email bisnis yang rapi dan terlindungi.
          </h2>
          <p className="mt-5 max-w-[48ch] text-sm leading-6 text-white/68">
            Kelola korespondensi, dokumen, dan dukungan pelanggan dalam satu ruang kerja EasyLegal.
          </p>

          <div className="mt-10 grid gap-3 text-sm text-white/82">
            {[
              'Domain bisnis terverifikasi',
              'Dokumen tersimpan dalam satu akun',
              'Kontrol keamanan dan sesi aktif',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 shrink-0 text-[#ffb4aa]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/55">
          <ShieldCheck className="size-4" />
          <span>Koneksi TLS dan enkripsi AES-256 GCM</span>
        </div>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[470px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Mail className="size-5" strokeWidth={2} />
            </div>
            <div>
              <p className="font-bold tracking-tight text-slate-950">EasyLegal Mail</p>
              <p className="text-xs text-slate-500">clienteasylegal.co.id</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">Email Portal</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Masuk untuk membuka mailbox dan layanan EasyLegal Hub.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="mb-6 grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-[#ebe8e6] p-1">
            {(['customer', 'admin'] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`tab-${t}`}
                onClick={() => { setTab(t); setError(''); }}
                className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  tab === t
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:bg-white/55 hover:text-slate-950'
                }`}
              >
                {t === 'customer' ? 'Customer Mail' : 'Administrator'}
              </button>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <div
              data-testid="login-error"
              role="alert"
            className="mb-5 flex w-full items-start gap-2 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700 animate-in fade-in duration-200"
          >
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Session Indicator */}
          {tab === 'customer' && customerToken && customerUser && (
            <div
              data-testid="active-customer-session"
              className="mb-5 flex flex-col gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950 truncate">Sesi Customer Aktif</p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      {customerUser.name} &bull; {customerUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="goto-customer-dashboard"
                  onClick={() => router.push('/inbox')}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Buka Mail &rarr;
                </button>
              </div>
              <p className="border-t border-emerald-200/70 pt-2 text-[11px] text-emerald-800/80">
                Atau masuk dengan akun customer lain:
              </p>
            </div>
          )}

          {tab === 'admin' && adminToken && adminUser && (
            <div
              data-testid="active-admin-session"
              className="mb-5 flex flex-col gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950 truncate">Sesi Administrator Aktif</p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      {adminUser.name} &bull; {adminUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="goto-admin-dashboard"
                  onClick={() => router.push('/admin')}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Buka Admin &rarr;
                </button>
              </div>
              <p className="border-t border-emerald-200/70 pt-2 text-[11px] text-emerald-800/80">
                Atau masuk dengan akun administrator lain:
              </p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-slate-700">
                Alamat Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  data-testid="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tab === 'customer' ? 'nama@clienteasylegal.co.id' : 'admin@clienteasylegal.co.id'}
                  className="w-full rounded-xl border border-border-subtle bg-white py-3 pl-10 pr-3.5 text-sm text-slate-950 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold text-slate-700">
                Kata sandi
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  data-testid="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-border-subtle bg-white py-3 pl-10 pr-3.5 text-sm text-slate-950 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="submit"
              disabled={loading}
              className="group mt-2 flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Mailbox</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-7 flex w-full flex-col gap-2 border-t border-border-subtle pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Akun demo</span>
              <span className="text-[11px] text-slate-400">Isi otomatis</span>
            </div>
            
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                data-testid="fill-demo-customer"
                onClick={() => {
                  setTab('customer');
                  setEmail('budi@clienteasylegal.co.id');
                  setPassword('Customer123!');
                  setError('');
                }}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-white p-2.5 text-left transition-colors hover:border-primary/15 hover:bg-primary/[0.035]"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">Customer Budi</span>
                    <span className="text-xs text-slate-500">budi@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-400">PT Maju Bersama, 12 email, sandi Customer123!</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
              </button>

              <button
                type="button"
                data-testid="fill-demo-trial"
                onClick={() => {
                  setTab('customer');
                  setEmail('trial@clienteasylegal.co.id');
                  setPassword('Customer123!');
                  setError('');
                }}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-white p-2.5 text-left transition-colors hover:border-primary/15 hover:bg-primary/[0.035]"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">Akun trial</span>
                    <span className="text-xs text-slate-500">trial@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Percobaan 14 hari, 5 email, sandi Customer123!</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
              </button>

              <button
                type="button"
                data-testid="fill-demo-admin"
                onClick={() => {
                  setTab('admin');
                  setEmail('admin@clienteasylegal.co.id');
                  setPassword('Admin123!');
                  setError('');
                }}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-white p-2.5 text-left transition-colors hover:border-primary/15 hover:bg-primary/[0.035]"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">Super Admin</span>
                    <span className="text-xs text-slate-500">admin@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Synology sync, security radar, sandi Admin123!</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
              </button>

              <button
                type="button"
                data-testid="fill-demo-officer"
                onClick={() => {
                  setTab('admin');
                  setEmail('officer@clienteasylegal.co.id');
                  setPassword('Officer123!');
                  setError('');
                }}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-white p-2.5 text-left transition-colors hover:border-primary/15 hover:bg-primary/[0.035]"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">Officer (Staf Legal)</span>
                    <span className="text-xs text-slate-500">officer@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Buat mailbox, email staf, sandi Officer123!</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Security footnote */}
          <div className="mt-6 flex w-full items-center justify-center gap-1.5 text-[11px] text-slate-500 lg:hidden">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" />
            <span>Koneksi terenkripsi untuk setiap sesi</span>
          </div>
        </div>
      </section>
    </main>
  );
}
