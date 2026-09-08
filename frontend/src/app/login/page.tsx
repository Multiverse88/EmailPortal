'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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
    <main className="min-h-screen flex items-center justify-center bg-background p-md">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-surface-container-highest p-xl flex flex-col items-center">
        <div className="mb-lg">
          <div className="w-16 h-16 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              mail
            </span>
          </div>
          <h1 className="text-page-title font-page-title text-on-surface text-center mt-2">
            MailPortal
          </h1>
          <p className="text-label-secondary text-on-surface-variant text-center text-sm">
            Masuk ke mailbox Anda
          </p>
        </div>

        <div className="flex p-1 bg-surface-container rounded-lg w-full mb-lg">
          {(['customer', 'admin'] as const).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`tab-${t}`}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-sm px-md rounded-md text-label-button font-label-button transition-all ${
                tab === t
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t === 'customer' ? 'Customer' : 'Admin'}
            </button>
          ))}
        </div>

        {error && (
          <div data-testid="login-error" role="alert" className="w-full mb-md bg-error-container text-on-error-container px-md py-sm rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-md">
          <div>
            <label htmlFor="email" className="sr-only text-body-text text-on-surface-variant">
              Email
            </label>
            <input
              id="email"
              data-testid="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Alamat email"
              className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only text-body-text text-on-surface-variant">
              Password
            </label>
            <input
              id="password"
              data-testid="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-md py-sm bg-surface rounded-xl border border-outline-variant text-body-text text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            />
          </div>
          <button
            type="submit"
            data-testid="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container font-label-button text-label-button py-sm px-lg rounded-full hover:bg-primary-container/90 shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
