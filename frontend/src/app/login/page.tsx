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
  const { setAuth, hydrate, token, user, ready } = useAuthStore();

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => {
    if (ready && token && user) router.replace(user.type === 'admin' ? '/admin' : '/inbox');
  }, [ready, token, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/auth/login/${tab}`, { email, password });
      setAuth(res.data.token, res.data.user);
      router.push(tab === 'admin' ? '/admin' : '/inbox');
    } catch (err) {
      setError(errMsg(err, 'Login gagal'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden px-4 py-8 selection:bg-primary/20 selection:text-primary">
      {/* Subtle brand ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[320px] bg-gradient-to-b from-primary/10 via-primary-container/5 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-7 sm:p-8 flex flex-col items-center">
          
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-md shadow-primary/20 mb-3.5 ring-4 ring-primary/10 transition-transform hover:scale-105">
              <Mail className="w-7 h-7 text-white" strokeWidth={2.2} />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Email Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5 justify-center">
              <span>EasyLegal Mail</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-primary font-semibold">clienteasylegal.co.id</span>
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl w-full mb-5 border border-slate-200/60">
            {(['customer', 'admin'] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`tab-${t}`}
                onClick={() => { setTab(t); setError(''); }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  tab === t
                    ? 'bg-white text-primary shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900'
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
              className="w-full mb-4 bg-red-50 text-red-700 border border-red-200/80 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-primary to-primary-container text-white font-medium text-sm py-2.5 px-4 rounded-xl hover:opacity-95 shadow-md shadow-primary/20 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 group"
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
          <div className="w-full mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Akun Uji Coba Demo</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">1-Klik Isi</span>
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
                className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-red-50/50 hover:border-red-200/60 border border-slate-200/80 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-primary">Customer (Budi):</span>
                    <span className="text-xs text-slate-700">budi@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-500">PT Maju Bersama • 12 Email • Pass: Customer123!</span>
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
                className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-red-50/50 hover:border-red-200/60 border border-slate-200/80 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-primary">Akun Trial:</span>
                    <span className="text-xs text-slate-700">trial@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Masa Percobaan 14 Hari • 5 Email Trial • Pass: Customer123!</span>
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
                className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-red-50/50 hover:border-red-200/60 border border-slate-200/80 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-primary">Admin (Utama):</span>
                    <span className="text-xs text-slate-700">admin@clienteasylegal.co.id</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Superadmin • Kelola 8 Mailbox • Pass: Admin123!</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Security footnote */}
          <div className="mt-5 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Enkripsi TLS & AES-256 GCM • Hostinger Titan Mail</span>
          </div>

        </div>
      </div>
    </main>
  );
}
