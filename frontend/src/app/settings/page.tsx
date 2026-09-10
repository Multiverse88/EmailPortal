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
  Headphones,
  Copy,
  QrCode,
  X,
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

interface AccountRetentionInfo {
  createdAt: string;
  expiresAt: string;
  retentionDays: number;
  remainingDays: number;
  elapsedDays: number;
  percentUsed: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  warningThresholdDays: number;
  policyNotice: string;
  warningNotice?: string;
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

  // 2FA Setup & Disable Modal States
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string; qrCodeUrl: string } | null>(null);
  const [setupOtpCode, setSetupOtpCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [show2FADisableModal, setShow2FADisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

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
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const [avatarOk, setAvatarOk] = useState('');
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [retention, setRetention] = useState<AccountRetentionInfo | null>(null);
  const [ticketConfig, setTicketConfig] = useState<{
    category?: string;
    subject?: string;
    message?: string;
    priority?: 'normal' | 'urgent';
  }>({
    category: 'Penyimpanan & Kuota',
    subject: 'Permohonan Penambahan Kapasitas Penyimpanan (5 GB Penuh)',
    message: 'Halo Tim Support EasyLegal,\n\nKapasitas penyimpanan Mailbox Drive kami saat ini telah mencapai batas maksimal 5 GB. Kami memohon penambahan kuota penyimpanan agar aktivitas penerimaan berkas legal dan pengiriman email dapat terus berjalan lancar.\n\nTerima kasih.',
    priority: 'urgent',
  });
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

  const openRetentionTicketModal = () => {
    setTicketConfig({
      category: 'Masa Aktif & Retensi Akun',
      subject: 'Permohonan Perpanjangan / Kendala Masa Aktif Akun Non-Aktif',
      message: `Halo Tim Support EasyLegal,\n\nAkun saya (${profileData?.mailboxAddress || user?.email || '-'}) akan/telah memasuki masa non-aktif setelah 3 bulan. Saya memohon bantuan perpanjangan waktu atau pemulihan akses data saya.\n\nTerima kasih.`,
      priority: 'urgent',
    });
    setTicketModalOpen(true);
  };

  const openQuotaTicketModal = () => {
    setTicketConfig({
      category: 'Penyimpanan & Kuota',
      subject: 'Permohonan Penambahan Kapasitas Penyimpanan (5 GB Penuh)',
      message: 'Halo Tim Support EasyLegal,\n\nKapasitas penyimpanan Mailbox Drive kami saat ini telah mencapai batas maksimal 5 GB. Kami memohon penambahan kuota penyimpanan agar aktivitas penerimaan berkas legal dan pengiriman email dapat terus berjalan lancar.\n\nTerima kasih.',
      priority: 'urgent',
    });
    setTicketModalOpen(true);
  };

  const formatSimpleDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const formatStorageSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    const k = 1024;
    if (bytes < k * k) {
      return `${(bytes / k).toFixed(1)} KB`;
    }
    if (bytes < k * k * k) {
      return `${(bytes / (k * k)).toFixed(1)} MB`;
    }
    return `${(bytes / (k * k * k)).toFixed(1)} GB`;
  };

  const formatStoragePercent = (percent: number, bytesUsed = 0): string => {
    if (!bytesUsed || bytesUsed <= 0) return '0%';
    if (percent < 0.01) return '< 0.01%';
    if (percent < 0.1) return `${percent.toFixed(2)}%`;
    if (percent % 1 !== 0) return `${percent.toFixed(1)}%`;
    return `${percent}%`;
  };

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
        if (res.data.retention) {
          setRetention(res.data.retention);
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

  // Reusable Upload Logo Perusahaan to IDCloudHost S3
  const uploadAvatarFile = async (file: File) => {
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
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatarFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleAvatarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!avatarDragActive) setAvatarDragActive(true);
  };

  const handleAvatarDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarDragActive(false);
  };

  const handleAvatarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await uploadAvatarFile(file);
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

  useEffect(() => {
    setAvatarImgError(false);
  }, [user?.avatarUrl, profileData?.avatarUrl]);

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      // Prevent browser default action of opening dragged files as file:///
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      // Prevent browser default action of navigating to file:///
      e.preventDefault();
    };
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
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

  // 2FA Toggle & Modals
  const handleToggle2FA = async () => {
    if (twoFactorEnabled) {
      setDisablePassword('');
      setDisableError('');
      setShow2FADisableModal(true);
    } else {
      setShow2FASetupModal(true);
      setSetupData(null);
      setSetupOtpCode('');
      setSetupError('');
      setSetupSuccess(false);
      setSetupLoading(true);
      try {
        const res = await api.post('/security/2fa/setup');
        setSetupData(res.data);
      } catch (err) {
        setSetupError(errMsg(err, 'Gagal memuat konfigurasi 2FA'));
      } finally {
        setSetupLoading(false);
      }
    }
  };

  const handleVerify2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupOtpCode || setupOtpCode.length !== 6) {
      setSetupError('Masukkan 6 digit kode dari aplikasi autentikator Anda');
      return;
    }
    setSetupLoading(true);
    setSetupError('');
    try {
      const res = await api.post('/security/2fa/verify-setup', { code: setupOtpCode });
      if (res.data.success) {
        setSetupSuccess(true);
        setTwoFactorEnabled(true);
        if (user) {
          updateUser({ ...user, twoFactorEnabled: true });
        }
        setTwoFactorFeedback('2FA telah aktif terlindungi');
        setTimeout(() => {
          setShow2FASetupModal(false);
          setSetupSuccess(false);
          setTwoFactorFeedback('');
        }, 1500);
      }
    } catch (err) {
      setSetupError(errMsg(err, 'Kode 2FA salah atau telah kedaluwarsa'));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirm2FADisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) {
      setDisableError('Kata sandi saat ini wajib diisi');
      return;
    }
    setDisableLoading(true);
    setDisableError('');
    try {
      const res = await api.post('/security/2fa/disable', { currentPassword: disablePassword });
      if (res.data.success) {
        setTwoFactorEnabled(false);
        if (user) {
          updateUser({ ...user, twoFactorEnabled: false });
        }
        setShow2FADisableModal(false);
        setTwoFactorFeedback('2FA telah dinonaktifkan');
        setTimeout(() => setTwoFactorFeedback(''), 4000);
      }
    } catch (err) {
      setDisableError(errMsg(err, 'Kata sandi salah'));
    } finally {
      setDisableLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
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

          {/* Reminder / Warning: 1 Bulan Terakhir & Masa Aktif 3 Bulan */}
          {retention && (retention.isExpiringSoon || retention.isExpired) && (
            <div
              data-testid="retention-warning-alert"
              className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs text-slate-800 animate-in fade-in duration-200"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-amber-950">
                        {retention.isExpired
                          ? 'Masa Aktif Akun & Penyimpanan Telah Berakhir'
                          : `Perhatian: Masa Aktif Akun & Penyimpanan Tersisa ${retention.remainingDays} Hari (Kurang dari 1 Bulan)`}
                      </h3>
                      <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                        {retention.isExpired ? 'Status: Non-Aktif' : 'Peringatan 1 Bulan Terakhir'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl">
                      Akun dan seluruh file penyimpanan ini hanya bertahan selama <strong>3 bulan</strong> semenjak akun ini dibuat. {retention.isExpired ? 'Akun dan penyimpanan kini berstatus non-aktif.' : `Dalam kurun waktu 1 bulan ke depan (tersisa ${retention.remainingDays} hari), akun ini akan bersifat non-aktif beserta seluruh file penyimpanannya.`}
                    </p>
                    <p className="text-xs text-amber-900/90 leading-relaxed max-w-3xl font-medium">
                      ⚠️ Harap segera backup berkas penting ke dalam penyimpanan Anda sendiri. Jika terjadi kendala setelah akun non-aktif, silakan membuka tiket support yang akan diproses 1x24 jam.
                    </p>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={openRetentionTicketModal}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Buka Tiket Support (1x24 Jam)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/documents')}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <HardDrive className="w-4 h-4 text-amber-700" />
                    <span>Ke Berkas Dokumen (Backup)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Profile Summary Banner */}
          <section className="app-panel p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

              {/* Status Indicators (Masa Aktif & Storage) */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Masa Aktif Akun Widget */}
                {retention && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl min-w-[210px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        Masa Aktif (3 Bulan)
                      </span>
                      <span className={`font-semibold text-xs ${
                        retention.isExpired ? 'text-red-600' : retention.isExpiringSoon ? 'text-amber-700 font-bold' : 'text-slate-700'
                      }`}>
                        {retention.isExpired ? 'Non-Aktif' : `Sisa ${retention.remainingDays} Hari`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          retention.isExpired
                            ? 'bg-red-600'
                            : retention.isExpiringSoon
                              ? 'bg-amber-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, retention.percentUsed))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>{retention.percentUsed}% berjalan</span>
                      <span className={retention.isExpiringSoon ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                        Hingga {formatSimpleDate(retention.expiresAt)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Storage Indicator */}
                <div className="sm:text-right bg-slate-50 border border-slate-100 p-3 rounded-xl min-w-[210px]">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500 font-medium">Kapasitas Cloud</span>
                    <span className="font-semibold text-slate-700">
                      {formatStorageSize(storageStats.storageUsed)} / {formatStorageSize(storageStats.storageLimit)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        storageStats.isFull ? 'bg-red-600' : storageStats.usagePercent > 80 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{
                        width: `${storageStats.storageUsed > 0 ? Math.min(100, Math.max(2, storageStats.usagePercent)) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>{formatStoragePercent(storageStats.usagePercent, storageStats.storageUsed)} digunakan</span>
                    <span className="text-primary font-medium">Maks 5 GB</span>
                  </div>
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

                {/* 3-Month Retention Information Callout */}
                {retention && (
                  <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3 text-xs">
                    <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">
                          Informasi Masa Aktif Akun (3 Bulan)
                        </span>
                        <span className={`text-[11px] font-medium ${retention.isExpiringSoon ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                          {retention.isExpired ? 'Berstatus Non-Aktif' : `Tersisa ${retention.remainingDays} Hari`}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">
                        Akun dan file penyimpanan bertahan selama 3 bulan sejak pendaftaran ({formatSimpleDate(retention.createdAt)} s/d {formatSimpleDate(retention.expiresAt)}). Harap lakukan backup berkas ke penyimpanan mandiri sebelum masa aktif berakhir. Bantuan tiket support diproses 1x24 jam.
                      </p>
                    </div>
                  </div>
                )}

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
              <section
                onDragOver={handleAvatarDragOver}
                onDragEnter={handleAvatarDragOver}
                onDragLeave={handleAvatarDragLeave}
                onDrop={handleAvatarDrop}
                className={`bg-white rounded-2xl border transition-all p-6 sm:p-7 shadow-xs ${
                  avatarDragActive
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]'
                    : 'border-border-subtle'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div
                      onDragOver={handleAvatarDragOver}
                      onDrop={handleAvatarDrop}
                      className={`relative group size-20 rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all shrink-0 ${
                        avatarDragActive
                          ? 'border-primary bg-primary/10 scale-105'
                          : 'border-slate-300 hover:border-primary bg-slate-50'
                      }`}
                    >
                      {(user?.avatarUrl || profileData?.avatarUrl) && !avatarImgError ? (
                        <img
                          src={user?.avatarUrl || profileData?.avatarUrl || ''}
                          alt="Logo Perusahaan"
                          onError={() => setAvatarImgError(true)}
                          className="size-full object-contain p-1.5"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-primary">
                          {initials(displayName)}
                        </span>
                      )}
                      {avatarDragActive && (
                        <div className="absolute inset-0 bg-primary/90 text-white flex flex-col items-center justify-center text-[10px] font-bold gap-1 animate-fade-in">
                          <Upload className="size-5 animate-bounce" />
                          <span>Drop Logo</span>
                        </div>
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
                        Tampil di header utama dan identitas perusahaan Anda. Drag & drop file atau klik tombol unggah.
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
                        {formatStorageSize(storageStats.storageUsed)} / {formatStorageSize(storageStats.storageLimit)}
                        {' '}({formatStoragePercent(storageStats.usagePercent, storageStats.storageUsed)})
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
                        style={{
                          width: `${storageStats.storageUsed > 0 ? Math.min(100, Math.max(2, storageStats.usagePercent)) : 0}%`,
                        }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[11px] text-slate-500">
                      <p>
                        Batas kuota standar: <strong>5 GB per akun</strong>. Seluruh berkas tersimpan di ruang folder terisolasi.
                      </p>
                      <button
                        type="button"
                        onClick={openQuotaTicketModal}
                        className="self-start sm:self-auto font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <span>Minta Tambah Kuota via Tiket Support &rarr;</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Masa Aktif Akun & Kebijakan Retensi 3 Bulan Card */}
              {retention && (
                <section className="bg-white rounded-2xl border border-border-subtle p-6 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Masa Aktif Akun &amp; Retensi Penyimpanan (3 Bulan)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Ketentuan masa berlaku akun email portal dan berkas penyimpanan cloud Anda.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {retention.isExpired ? (
                        <span className="text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full">
                          Akun Non-Aktif
                        </span>
                      ) : retention.isExpiringSoon ? (
                        <span className="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Tersisa {retention.remainingDays} Hari (1 Bulan Terakhir)
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Aktif (Tersisa {retention.remainingDays} Hari)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <dt className="text-slate-400 font-medium mb-1">Tanggal Pendaftaran Akun</dt>
                        <dd className="text-slate-800 font-semibold text-sm">
                          {formatSimpleDate(retention.createdAt)}
                        </dd>
                        <span className="text-[10px] text-slate-400">Awal masa aktif</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <dt className="text-slate-400 font-medium mb-1">Batas Akhir Masa Aktif (3 Bulan)</dt>
                        <dd className={`font-semibold text-sm ${retention.isExpiringSoon ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
                          {formatSimpleDate(retention.expiresAt)}
                        </dd>
                        <span className="text-[10px] text-slate-400">Total retensi 90 hari</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <dt className="text-slate-400 font-medium mb-1">Sisa Waktu Aktif</dt>
                        <dd className={`text-sm font-bold ${retention.isExpired ? 'text-red-600' : retention.isExpiringSoon ? 'text-amber-600' : 'text-primary'}`}>
                          {retention.isExpired ? '0 Hari (Non-Aktif)' : `${retention.remainingDays} Hari Lagi`}
                        </dd>
                        <span className="text-[10px] text-slate-400">{retention.elapsedDays} hari telah berjalan ({retention.percentUsed}%)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-blue-950">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Informasi &amp; Kebijakan Retensi Penyimpanan</span>
                      </div>
                      <p className="leading-relaxed">
                        Akun ini beserta seluruh data file penyimpanan hanya bertahan selama <strong>3 bulan (90 hari)</strong> sejak akun dibuat. Ketika memasuki 1 bulan terakhir, sistem akan memberikan pengingat agar Anda segera mengunduh dan mem-backup berkas penting ke penyimpanan Anda sendiri.
                      </p>
                      <p className="leading-relaxed">
                        Setelah masa aktif 3 bulan berakhir, akun dan penyimpanan akan bersifat non-aktif. Jika terjadi kendala setelah akun dinonaktifkan atau Anda membutuhkan perpanjangan, silakan membuka <strong>tiket support</strong> dan tim bantuan kami akan memprosesnya dalam <strong>1x24 jam kerja</strong>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => router.push('/documents')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                      >
                        <HardDrive className="w-4 h-4" />
                        <span>Buka Menu Dokumen untuk Backup Data</span>
                      </button>

                      <button
                        type="button"
                        onClick={openRetentionTicketModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
                      >
                        <Headphones className="w-4 h-4" />
                        <span>Buka Tiket Support Perpanjangan (1x24 Jam)</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
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
        initialCategory={ticketConfig.category}
        initialSubject={ticketConfig.subject}
        initialMessage={ticketConfig.message}
        initialPriority={ticketConfig.priority}
      />

      {/* 2FA Setup Modal */}
      {show2FASetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Aktivasi Autentikasi 2-Faktor (2FA)</h3>
                  <p className="text-[11px] text-slate-500">Google Authenticator / Authy / 1Password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShow2FASetupModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            {setupSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">2FA Berhasil Diaktifkan!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Akun Anda kini terlindungi dengan kode autentikasi 2 langkah setiap kali login.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerify2FASetup} className="p-6 space-y-5">
                {setupError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{setupError}</span>
                  </div>
                )}

                {setupLoading && !setupData ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    <p className="text-xs text-slate-500">Menyiapkan kode QR keamanan...</p>
                  </div>
                ) : setupData ? (
                  <>
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        <strong>Langkah 1:</strong> Pindai kode QR berikut menggunakan aplikasi autentikator di ponsel Anda:
                      </p>
                      <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={setupData.qrCodeUrl}
                          alt="Kode QR 2FA"
                          className="w-44 h-44 rounded-lg bg-white p-1 border border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] text-slate-500">
                        Atau masukkan kunci rahasia ini secara manual:
                      </p>
                      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-800 justify-between">
                        <span className="truncate select-all">{setupData.secret}</span>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-sans font-semibold text-primary hover:underline"
                        >
                          {copiedSecret ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                          <span>{copiedSecret ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label htmlFor="setupOtp" className="block text-xs font-semibold text-slate-700">
                        <strong>Langkah 2:</strong> Masukkan 6 digit kode dari aplikasi untuk konfirmasi:
                      </label>
                      <input
                        id="setupOtp"
                        data-testid="input-setup-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        value={setupOtpCode}
                        onChange={(e) => setSetupOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full text-center tracking-[0.3em] font-mono text-xl font-bold rounded-xl border border-border-subtle bg-white py-2.5 px-3 text-slate-900 shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShow2FASetupModal(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        data-testid="submit-verify-setup"
                        disabled={setupLoading || setupOtpCode.length !== 6}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition shadow-sm"
                      >
                        {setupLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Verifikasi &amp; Aktifkan</span>
                      </button>
                    </div>
                  </>
                ) : null}
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {show2FADisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Nonaktifkan Autentikasi 2-Faktor?</h3>
                  <p className="text-[11px] text-slate-500">Konfirmasi keamanan akun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShow2FADisableModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirm2FADisable} className="p-6 space-y-4">
              {disableError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{disableError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Menonaktifkan 2FA akan menghapus verifikasi OTP saat login. Akun Anda hanya akan dilindungi oleh kata sandi tunggal.
              </p>

              <div>
                <label htmlFor="disablePassword" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Masukkan kata sandi akun untuk konfirmasi:
                </label>
                <input
                  id="disablePassword"
                  data-testid="input-disable-2fa-password"
                  type="password"
                  required
                  autoFocus
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-border-subtle bg-white py-2.5 px-3 text-sm text-slate-900 shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShow2FADisableModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  data-testid="submit-confirm-disable-2fa"
                  disabled={disableLoading || !disablePassword}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition shadow-sm"
                >
                  {disableLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi Nonaktifkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
