'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  Mail,
  Shield,
  KeyRound,
  Check,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Laptop,
  Smartphone,
  Monitor,
  SlidersHorizontal,
  User as UserIcon,
  Bell,
  MapPin,
  Clock,
  Building,
  HardDrive,
  Info,
  ShieldAlert,
  FileSignature,
  Globe,
  RefreshCw,
  Upload,
  Trash2,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { useCustomerAuth } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { SuiteHeader } from '@/components/suite-header';
import { SupportTicketModal } from '@/components/support-ticket-modal';

type SettingsTab = 'general' | 'profile' | 'security' | 'notifications';

interface LoginSessionItem {
  id: string;
  customerId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  ipAddress: string;
  location: string;
  isCurrent: boolean;
  lastActiveAt: string;
  createdAt: string;
}

interface UserProfile {
  id?: string;
  name?: string;
  mailboxAddress?: string;
  personalEmail?: string;
  status?: string;
  twoFactorEnabled?: boolean;
  avatarUrl?: string | null;
  storageQuota?: number;
  createdAt?: string;
  lastLoginAt?: string;
}

export default function SettingsPage() {
  return (
    <AuthGuard type="customer">
      <Suspense fallback={<SettingsLoadingFallback />}>
        <SettingsContent />
      </Suspense>
    </AuthGuard>
  );
}

function SettingsLoadingFallback() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm font-medium text-slate-500">Memuat Pengaturan...</span>
      </div>
    </div>
  );
}

function SettingsContent() {
  const { user, updateUser, logout } = useCustomerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State
  const initialTabParam = searchParams.get('tab');
  const getValidTab = (tab: string | null): SettingsTab => {
    if (tab === 'general') return 'general';
    if (tab === 'profile') return 'profile';
    if (tab === 'notifications') return 'notifications';
    if (tab === 'security') return 'security';
    // Default to security if requested or general otherwise
    return 'security';
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => getValidTab(initialTabParam));

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'security' || tabParam === 'general' || tabParam === 'profile' || tabParam === 'notifications') {
      setActiveTab(tabParam as SettingsTab);
    }
  }, [searchParams]);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  // General tab states
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [timezone, setTimezone] = useState<string>('Asia/Jakarta');
  const [signature, setSignature] = useState<string>('');
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalOk, setGeneralOk] = useState('');
  const [generalErr, setGeneralErr] = useState('');

  // Notifications tab states
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySound, setNotifySound] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifOk, setNotifOk] = useState('');
  const [notifErr, setNotifErr] = useState('');

  // Security tab states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [toggling2FA, setToggling2FA] = useState(false);
  const [twoFactorFeedback, setTwoFactorFeedback] = useState<string>('');

  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');

  // Sessions list
  const [sessions, setSessions] = useState<LoginSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [terminatingOthers, setTerminatingOthers] = useState(false);
  const [terminateMsg, setTerminateMsg] = useState('');

  // Profile data & Logo state
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const [avatarOk, setAvatarOk] = useState('');
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    storageUsed: number;
    storageLimit: number;
    isFull: boolean;
    usagePercent: number;
  }>({
    storageUsed: 0,
    storageLimit: 5368709120, // 5 GB
    isFull: false,
    usagePercent: 0,
  });

  // Fetch settings & sessions
  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
        if (res.data.user) {
          setProfileData(res.data.user);
          setTwoFactorEnabled(!!res.data.user.twoFactorEnabled);
          if (res.data.user.avatarUrl) {
            updateUser({ avatarUrl: res.data.user.avatarUrl });
          }
        }
        if (res.data.storageStats) {
          setStorageStats(res.data.storageStats);
        }
        if (res.data.preferences) {
          const p = res.data.preferences;
          if (p.language) setLanguage(p.language === 'en' ? 'en' : 'id');
          if (p.timezone) setTimezone(p.timezone);
          if (p.signature !== undefined) setSignature(p.signature);
          if (p.notifyEmail !== undefined) setNotifyEmail(!!p.notifyEmail);
          if (p.notifySound !== undefined) setNotifySound(!!p.notifySound);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Upload Logo Perusahaan to IDCloudHost S3
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarErr('File harus berupa gambar (PNG, JPG, WebP, SVG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarErr('Ukuran file logo maksimal 5 MB');
      return;
    }
    setAvatarUploading(true);
    setAvatarErr('');
    setAvatarOk('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/settings/avatar', fd);
      setAvatarOk('Logo perusahaan berhasil diperbarui dan tersimpan di IDCloudHost S3');
      updateUser({ avatarUrl: res.data.avatarUrl });
      await fetchSettings();
      setTimeout(() => setAvatarOk(''), 4000);
    } catch (err) {
      setAvatarErr(errMsg(err, 'Gagal mengunggah logo perusahaan'));
    } finally {
      setAvatarUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Delete Logo Perusahaan from IDCloudHost S3
  const handleAvatarDelete = async () => {
    if (!window.confirm('Hapus logo perusahaan dan kembali menggunakan inisial bawaan?')) return;
    setAvatarUploading(true);
    setAvatarErr('');
    setAvatarOk('');
    try {
      await api.delete('/settings/avatar');
      setAvatarOk('Logo perusahaan berhasil dihapus');
      updateUser({ avatarUrl: null });
      await fetchSettings();
      setTimeout(() => setAvatarOk(''), 4000);
    } catch (err) {
      setAvatarErr(errMsg(err, 'Gagal menghapus logo'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/security/sessions');
      if (res.data?.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSessions();
  }, []);

  // Save General Preferences
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralErr('');
    setGeneralOk('');
    setGeneralSaving(true);
    try {
      await api.put('/settings/preferences', {
        preferences: {
          language,
          timezone,
          signature,
        },
      });
      setGeneralOk('Preferensi umum berhasil disimpan');
      setTimeout(() => setGeneralOk(''), 4000);
    } catch (err) {
      setGeneralErr(errMsg(err, 'Gagal menyimpan preferensi umum'));
    } finally {
      setGeneralSaving(false);
    }
  };

  // Save Notification Preferences
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifErr('');
    setNotifOk('');
    setNotifSaving(true);
    try {
      await api.put('/settings/preferences', {
        preferences: {
          notifyEmail,
          notifySound,
        },
      });
      setNotifOk('Preferensi notifikasi berhasil disimpan');
      setTimeout(() => setNotifOk(''), 4000);
    } catch (err) {
      setNotifErr(errMsg(err, 'Gagal menyimpan preferensi notifikasi'));
    } finally {
      setNotifSaving(false);
    }
  };

  // 2FA Toggle
  const handleToggle2FA = async () => {
    setToggling2FA(true);
    setTwoFactorFeedback('');
    try {
      const nextState = !twoFactorEnabled;
      const res = await api.post('/security/2fa/toggle', { enabled: nextState });
      const active = !!res.data.twoFactorEnabled;
      setTwoFactorEnabled(active);
      setTwoFactorFeedback(active ? '2FA telah aktif terlindungi' : '2FA telah dinonaktifkan');
      setTimeout(() => setTwoFactorFeedback(''), 4000);
    } catch (err) {
      setTwoFactorFeedback(errMsg(err, 'Gagal mengubah status 2FA'));
    } finally {
      setToggling2FA(false);
    }
  };

  // Terminate Other Sessions
  const handleTerminateOthers = async () => {
    if (!window.confirm('Hentikan semua sesi login di perangkat lain? Anda akan tetap masuk di perangkat ini.')) {
      return;
    }
    setTerminatingOthers(true);
    setTerminateMsg('');
    try {
      const res = await api.post('/security/sessions/terminate-others');
      const count = res.data?.terminatedCount;
      const successMsg =
        typeof count === 'number' && count > 0
          ? `${count} sesi perangkat lain berhasil dihentikan`
          : 'Sesi perangkat lain berhasil dihentikan';
      setTerminateMsg(successMsg);
      await fetchSessions();
      setTimeout(() => setTerminateMsg(''), 5000);
    } catch (err) {
      setTerminateMsg(errMsg(err, 'Gagal menghentikan sesi perangkat lain'));
    } finally {
      setTerminatingOthers(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwOk('');

    if (newPassword !== confirm) {
      return setPwError('Konfirmasi password tidak cocok');
    }
    if (newPassword.length < 8) {
      return setPwError('Password baru minimal 8 karakter');
    }

    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwOk('Password berhasil diubah');
      setCurrent('');
      setNew('');
      setConfirm('');
    } catch (err) {
      setPwError(errMsg(err, 'Gagal mengubah password'));
    } finally {
      setPwSaving(false);
    }
  };

  const initials = (name: string | null | undefined) => {
    if (!name) return 'EL';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getDeviceIcon = (deviceType: string) => {
    const t = (deviceType || '').toLowerCase();
    if (t === 'mobile' || t === 'smartphone' || t.includes('phone')) return Smartphone;
    if (t === 'desktop' || t === 'pc' || t.includes('desktop')) return Monitor;
    return Laptop;
  };

  const formatSessionTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Password Requirements Checklist
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);

  const displayEmail = profileData?.mailboxAddress || user?.email || '-';
  const displayName = profileData?.name || user?.name || 'Customer';

  return (
    <main className="app-shell antialiased">
      <SuiteHeader
        currentApp="settings"
        product="Pengaturan Akun & Keamanan"
        description="Profil, preferensi, dan keamanan akun"
        userName={displayName}
        userEmail={displayEmail}
        avatarUrl={user?.avatarUrl || profileData?.avatarUrl}
        onLogout={() => {
          logout();
          router.replace('/login');
        }}
        actions={
          <button
            data-testid="back-inbox"
            onClick={() => router.push('/inbox')}
            className="app-secondary-button hidden !min-h-9 !px-3 !text-xs sm:inline-flex"
          >
            <ArrowLeft className="size-4" />
            <span>Mail</span>
          </button>
        }
      />

      {/* Main Container */}
      <div className="page-canvas flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">

          <div className="pt-1 sm:pt-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.035em] text-slate-950">
              {activeTab === 'security' ? 'Keamanan dan aktivitas login' : 'Pengaturan akun'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {activeTab === 'security'
                ? 'Tinjau sesi aktif dan kelola perlindungan akun Anda.'
                : 'Kelola profil, preferensi mailbox, dan notifikasi EasyLegal.'}
            </p>
          </div>

          {/* Account Profile Summary Banner */}
          <section className="app-panel p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-xs shrink-0">
                  {user?.avatarUrl || profileData?.avatarUrl ? (
                    <img
                      src={user?.avatarUrl || profileData?.avatarUrl || ''}
                      alt="Logo Perusahaan"
                      className="size-full object-contain p-1"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary text-white font-bold text-lg flex items-center justify-center">
                      {initials(displayName)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                      {displayName}
                    </h2>
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" />
                      Mailbox Aktif
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <span data-testid="account-email" className="font-mono text-primary font-semibold">
                      {displayEmail}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-500">Hostinger Mailbox</span>
                  </div>
                </div>
              </div>

              {/* Quick Storage Indicator */}
              <div className="sm:text-right bg-slate-50 border border-slate-100 p-3 rounded-xl min-w-[220px]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">Kapasitas Cloud</span>
                  <span className="font-semibold text-slate-700">
                    {(storageStats.storageUsed / (1024 * 1024 * 1024)).toFixed(2)} GB / {(storageStats.storageLimit / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      storageStats.isFull ? 'bg-red-600' : storageStats.usagePercent > 80 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, storageStats.usagePercent))}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{storageStats.usagePercent}% digunakan</span>
                  <span className="text-primary font-medium">Maks 5 GB</span>
                </div>
              </div>
            </div>
          </section>

          {/* Navigation Tabs Bar */}
          <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-2xl border border-border-subtle bg-[#ebe8e6]/95 p-1.5 shadow-xs backdrop-blur">
            <button
              data-testid="tab-general"
              onClick={() => switchTab('general')}
              className={`py-2.5 px-2 text-[11px] sm:text-sm font-semibold whitespace-nowrap rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all flex-1 ${
                activeTab === 'general'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Umum</span>
            </button>

            <button
              data-testid="tab-profile"
              onClick={() => switchTab('profile')}
              className={`py-2.5 px-2 text-[11px] sm:text-sm font-semibold whitespace-nowrap rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all flex-1 ${
                activeTab === 'profile'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Profil</span>
            </button>

            <button
              data-testid="tab-security"
              onClick={() => switchTab('security')}
              className={`py-2.5 px-2 text-[11px] sm:text-sm font-semibold whitespace-nowrap rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all flex-1 ${
                activeTab === 'security'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Keamanan</span>
            </button>

            <button
              data-testid="tab-notifications"
              onClick={() => switchTab('notifications')}
              className={`py-2.5 px-2 text-[11px] sm:text-sm font-semibold whitespace-nowrap rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all flex-1 ${
                activeTab === 'notifications'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifikasi</span>
            </button>
          </div>

          {/* TAB 1: GENERAL PREFERENCES */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-xs">
                <div className="mb-6">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    Preferensi Akun &amp; Antarmuka
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Atur konfigurasi bahasa, zona waktu lokal, dan tanda tangan resmi pada email keluar.
                  </p>
                </div>

                {generalOk && (
                  <div
                    data-testid="general-success"
                    role="status"
                    className="mb-5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{generalOk}</span>
                  </div>
                )}

                {generalErr && (
                  <div
                    data-testid="general-error"
                    role="alert"
                    className="mb-5 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{generalErr}</span>
                  </div>
                )}

                <form onSubmit={handleSaveGeneral} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Bahasa Dropdown */}
                    <div>
                      <label htmlFor="language-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        <Globe className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                        Bahasa Antarmuka
                      </label>
                      <select
                        id="language-select"
                        data-testid="select-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
                        className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                      >
                        <option value="id">Bahasa Indonesia (ID)</option>
                        <option value="en">English (US)</option>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">Bahasa default tampilan menu &amp; bantuan</p>
                    </div>

                    {/* Zona Waktu Dropdown */}
                    <div>
                      <label htmlFor="timezone-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                        Zona Waktu
                      </label>
                      <select
                        id="timezone-select"
                        data-testid="select-timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                      >
                        <option value="Asia/Jakarta">WIB (Jakarta, Surabaya, Medan - UTC+7)</option>
                        <option value="Asia/Makassar">WITA (Makassar, Denpasar, Balikpapan - UTC+8)</option>
                        <option value="Asia/Jayapura">WIT (Jayapura, Ambon - UTC+9)</option>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">Digunakan untuk penanda waktu terima pesan</p>
                    </div>
                  </div>

                  {/* Rich Email Signature Editor & Live Preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="email-signature" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <FileSignature className="w-4 h-4 text-primary" />
                        Tanda Tangan Email Resmi (Signature)
                      </label>
                      <span className="text-[11px] text-slate-400">Otomatis disisipkan di email baru</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Editor Textarea */}
                      <div>
                        <textarea
                          id="email-signature"
                          data-testid="input-signature"
                          rows={6}
                          value={signature}
                          onChange={(e) => setSignature(e.target.value)}
                          placeholder="Hormat kami,&#10;Nama Anda / Posisi&#10;PT Solusi Hukum Indonesia&#10;www.easylegal.co.id"
                          className="w-full px-3.5 py-3 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono leading-relaxed"
                        />
                      </div>

                      {/* Live Preview Card */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            Live Preview Tanda Tangan
                          </span>
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed shadow-xs">
                            <div className="whitespace-pre-line text-xs font-sans text-slate-700">
                              {signature || (
                                <span className="text-slate-400 italic">
                                  Belum ada tanda tangan yang dikonfigurasi...
                                </span>
                              )}
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2">
                              <span className="text-[9px] font-bold text-primary tracking-wide">EASYLEGAL CLIENT MAIL</span>
                              <span className="text-[9px] text-slate-400">• Confirmed Safe Sender</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          Pratinjau ini akan tampil tepat di bawah isi pesan email yang Anda kirim.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      data-testid="save-general-prefs"
                      disabled={generalSaving}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-container text-white px-6 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
                    >
                      {generalSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Simpan Preferensi</span>
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* TAB 2: PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Feedback Banners for Avatar */}
              {avatarOk && (
                <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>{avatarOk}</span>
                </div>
              )}
              {avatarErr && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
                  <AlertCircle className="size-4 text-red-600 shrink-0" />
                  <span>{avatarErr}</span>
                </div>
              )}

              {/* Company Logo / Avatar Card */}
              <section className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="relative group size-20 rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary overflow-hidden flex items-center justify-center bg-slate-50 transition-colors shrink-0">
                      {user?.avatarUrl || profileData?.avatarUrl ? (
                        <img
                          src={user?.avatarUrl || profileData?.avatarUrl || ''}
                          alt="Logo Perusahaan"
                          className="size-full object-contain p-1.5"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-primary">
                          {initials(displayName)}
                        </span>
                      )}
                      {avatarUploading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex items-center justify-center">
                          <Loader2 className="size-6 text-primary animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Logo Perusahaan / Avatar</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tampil di header utama dan identitas perusahaan Anda.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="size-3 text-emerald-600" /> IDCloudHost S3 (Terisolasi per Akun)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
                    <label className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer shadow-xs active:scale-98">
                      <Upload className="size-4" />
                      <span>{user?.avatarUrl || profileData?.avatarUrl ? 'Ganti Logo' : 'Unggah Logo Perusahaan'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={avatarUploading}
                      />
                    </label>

                    {(user?.avatarUrl || profileData?.avatarUrl) && (
                      <button
                        type="button"
                        onClick={handleAvatarDelete}
                        disabled={avatarUploading}
                        className="px-3.5 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                        title="Hapus Logo Perusahaan"
                      >
                        <Trash2 className="size-4" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Rincian Identitas Pelanggan
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Nama Lengkap Pemilik</dt>
                      <dd className="text-slate-900 font-semibold text-sm">{displayName}</dd>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Alamat Email Mailbox Aktif</dt>
                      <dd className="text-primary font-semibold text-sm font-mono truncate">
                        {displayEmail}
                      </dd>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Email Pemulihan / Pribadi</dt>
                      <dd className="text-slate-700 font-medium text-sm font-mono">
                        {profileData?.personalEmail || '-'}
                      </dd>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Organisasi / Perusahaan</dt>
                      <dd className="text-slate-900 font-semibold text-sm flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        PT Solusi Hukum Indonesia
                      </dd>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Paket Layanan Mailbox</dt>
                      <dd className="text-slate-800 font-semibold text-sm">
                        EasyLegal Standard Suite (5 GB Maksimal)
                      </dd>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <dt className="text-slate-400 font-medium mb-1">Status Keamanan 2FA</dt>
                      <dd className="text-sm">
                        {twoFactorEnabled ? (
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aktif Terlindungi
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Non-aktif</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {/* IDCloudHost S3 Storage usage breakdown */}
                  <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-slate-800">
                          Penyimpanan IDCloudHost S3 Mailbox Drive
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {(storageStats.storageUsed / (1024 * 1024 * 1024)).toFixed(2)} GB / {(storageStats.storageLimit / (1024 * 1024 * 1024)).toFixed(1)} GB
                        {' '}({storageStats.usagePercent}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mb-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          storageStats.isFull
                            ? 'bg-red-600'
                            : storageStats.usagePercent > 80
                              ? 'bg-amber-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, storageStats.usagePercent))}%` }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[11px] text-slate-500">
                      <p>
                        Batas kuota standar: <strong>5 GB per akun</strong>. Seluruh berkas tersimpan di ruang folder terisolasi.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTicketModalOpen(true)}
                        className="self-start sm:self-auto font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <span>Minta Tambah Kuota via Tiket Support &rarr;</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: SECURITY & LOGIN ACTIVITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              
              {/* Security Health & 2FA Card */}
              <section className="bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-panel">
                <div className="p-4 sm:p-5 border-b border-border-subtle bg-[#f2f0ef] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-slate-900">Perlindungan akun</h3>
                  </div>
                  <span className="text-[11px] text-slate-500">Status dan akses</span>
                </div>

                <div className="p-6 sm:p-7 space-y-6">
                  {/* Feedback Banner */}
                  {twoFactorFeedback && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{twoFactorFeedback}</span>
                    </div>
                  )}

                  {/* 2FA Card */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">Autentikasi dua faktor (2FA)</h4>
                        {twoFactorEnabled ? (
                          <span
                            data-testid="badge-2fa-on"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-semibold"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <span
                            data-testid="badge-2fa-off"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                        Tambahkan lapisan perlindungan ekstra pada akun Anda dengan mewajibkan verifikasi kode OTP setiap kali masuk dari perangkat baru.
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      data-testid="toggle-2fa"
                      onClick={handleToggle2FA}
                      disabled={toggling2FA}
                      aria-label="Aktifkan autentikasi dua faktor"
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        twoFactorEnabled ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Emergency Sign-out Card */}
                  <div className="bg-red-50/60 border border-red-200/90 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                        <h4>Keluar dari semua sesi lain</h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-lg leading-relaxed">
                        Jika Anda mendeteksi aktivitas mencurigakan atau meninggalkan akun di perangkat publik, segera putuskan sesi login di seluruh perangkat lain kecuali perangkat ini.
                      </p>
                      {terminateMsg && (
                        <p data-testid="terminate-msg" className="text-xs font-semibold text-red-700 mt-2 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          {terminateMsg}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      data-testid="terminate-sessions-btn"
                      onClick={handleTerminateOthers}
                      disabled={terminatingOthers}
                      className="whitespace-nowrap px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0 disabled:opacity-60"
                    >
                      {terminatingOthers ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      <span>Akhiri sesi lain</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Change Password Card */}
              <section className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-panel">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Ubah Kata Sandi</h3>
                </div>
                
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Pastikan kata sandi baru Anda unik dan memenuhi standar keamanan akun perbankan / legal.
                </p>

                {pwError && (
                  <div
                    data-testid="pw-error"
                    role="alert"
                    className="mb-5 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{pwError}</span>
                  </div>
                )}

                {pwOk && (
                  <div
                    data-testid="pw-success"
                    role="status"
                    className="mb-5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{pwOk}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label htmlFor="current" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password Saat Ini
                    </label>
                    <div className="relative">
                      <input
                        id="current"
                        data-testid="pw-current"
                        type={showCurrentPw ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrent(e.target.value)}
                        placeholder="Masukkan password saat ini"
                        className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* New Password */}
                    <div>
                      <label htmlFor="new" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Password Baru
                      </label>
                      <div className="relative">
                        <input
                          id="new"
                          data-testid="pw-new"
                          type={showNewPw ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNew(e.target.value)}
                          placeholder="Minimal 8 karakter"
                          className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="confirm" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Konfirmasi Password Baru
                      </label>
                      <div className="relative">
                        <input
                          id="confirm"
                          data-testid="pw-confirm"
                          type={showConfirmPw ? 'text' : 'password'}
                          required
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          placeholder="Ulangi password baru"
                          className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/70 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold mb-2">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Standar Keamanan Kata Sandi</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
                      <li className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : ''}`}>
                        {hasMinLength ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />
                        )}
                        <span>Min. 8 karakter</span>
                      </li>
                      <li className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-700 font-medium' : ''}`}>
                        {hasUpper ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />
                        )}
                        <span>Huruf besar (A-Z)</span>
                      </li>
                      <li className={`flex items-center gap-1.5 ${hasNumberOrSpecial ? 'text-emerald-700 font-medium' : ''}`}>
                        {hasNumberOrSpecial ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />
                        )}
                        <span>Angka atau simbol</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      data-testid="pw-submit"
                      disabled={pwSaving}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-container text-white px-6 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
                    >
                      {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Simpan kata sandi</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Recent Login Activity Card */}
              <section className="bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-panel">
                <div className="p-4 sm:p-5 border-b border-border-subtle bg-[#f2f0ef] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="w-5 h-5 text-slate-700" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Aktivitas login terbaru</h3>
                      <p className="text-[11px] text-slate-500">Daftar sesi dan perangkat yang terhubung ke akun Anda</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchSessions}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
                    title="Segarkan daftar sesi"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin text-primary' : ''}`} />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {loadingSessions && sessions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>Memuat riwayat sesi login...</span>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Tidak ada riwayat sesi login tercatat.
                    </div>
                  ) : (
                    sessions.map((session) => {
                      const DeviceIconComp = getDeviceIcon(session.deviceType);
                      return (
                        <div
                          key={session.id}
                          className={`p-4 sm:p-5 flex items-start gap-4 transition-colors hover:bg-slate-50/70 relative ${
                            session.isCurrent ? 'border-l-4 border-l-primary bg-primary/[0.02]' : ''
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <DeviceIconComp className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {session.deviceName}
                              </span>
                              {session.isCurrent && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-[#FFDAD6] text-[#680003] border border-[#ffb4aa] rounded text-[10px] font-bold uppercase tracking-wider">
                                  Sesi ini
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-mono">
                                ({session.browser})
                              </span>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {session.location} ({session.ipAddress})
                              </span>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {session.isCurrent ? (
                                  <span className="text-emerald-700 font-semibold">Aktif sekarang</span>
                                ) : (
                                  formatSessionTime(session.lastActiveAt)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-xs">
                <div className="mb-6">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Pengaturan Notifikasi &amp; Peringatan
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan cara EasyLegal memberi tahu Anda tentang pesan penting dan aktivitas akun.
                  </p>
                </div>

                {notifOk && (
                  <div
                    data-testid="notif-success"
                    role="status"
                    className="mb-5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{notifOk}</span>
                  </div>
                )}

                {notifErr && (
                  <div
                    data-testid="notif-error"
                    role="alert"
                    className="mb-5 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{notifErr}</span>
                  </div>
                )}

                <form onSubmit={handleSaveNotifications} className="space-y-6">
                  {/* Desktop Push Alert Toggle */}
                  <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Notifikasi Desktop Browser</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Tampilkan banner pop-up browser secara real-time saat email baru masuk ke kotak masuk Anda.
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid="toggle-notify-email"
                      onClick={() => setNotifyEmail(!notifyEmail)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifyEmail ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifyEmail ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Audio Chime Alert Toggle */}
                  <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Peringatan Suara (Audio Chime)</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Mainkan nada notifikasi yang halus dan elegan ketika email atau dokumen legal baru diterima.
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid="toggle-notify-sound"
                      onClick={() => setNotifySound(!notifySound)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifySound ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifySound ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      data-testid="save-notification-prefs"
                      disabled={notifSaving}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-container text-white px-6 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
                    >
                      {notifSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Simpan Preferensi Notifikasi</span>
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

        </div>
      </div>

      {/* Quick Support Ticket Modal */}
      <SupportTicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
      />
    </main>
  );
}
