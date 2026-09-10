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
  AlertTriangle,
  Users,
  HardDrive,
  UserCheck,
  UserX,
  RefreshCw,
  ExternalLink,
  Sparkles,
  FolderArchive,
  Play,
  Laptop,
  Smartphone,
  Globe,
  Radio,
  Clock,
  ShieldAlert,
  Send,
  FileText,
  LifeBuoy,
  Zap,
} from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';
import { useAdminAuth, useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { SuiteHeader } from '@/components/suite-header';

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

interface StorageOverview {
  totalStorageUsedBytes: number;
  totalStorageQuotaBytes: number;
  totalAccounts: number;
  synology: {
    isAvailable: boolean;
    targetPath: string;
    totalSyncedFiles: number;
    pendingFiles: number;
    lastSyncAt: string | null;
  };
  accounts: {
    id: string;
    name: string;
    mailboxAddress: string;
    personalEmail: string;
    status: string;
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
    warningExceeded80: boolean;
  }[];
}

interface SecurityRadarAccount {
  id: string;
  name: string;
  mailboxAddress: string;
  personalEmail: string;
  status: string;
  lastLoginAt: string | null;
  activeSessionsCount: number;
  uniqueIps: string[];
  isMultiIpAlert: boolean;
  sessions: {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    ipAddress: string;
    location: string;
    isCurrent: boolean;
    lastActiveAt: string;
  }[];
}

interface SecurityRadarData {
  summary: {
    totalAccounts: number;
    totalActiveSessions: number;
    multiIpAlertCount: number;
  };
  accounts: SecurityRadarAccount[];
}

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function AdminPage() {
  return (
    <AuthGuard type="admin">
      <Admin_ />
    </AuthGuard>
  );
}

function Admin_() {
  const { user, logout } = useAdminAuth();
  const { customerToken } = useAuthStore();
  const router = useRouter();

  // Role detection
  const normalizedRole = (user?.role || 'admin').toLowerCase().replace('_', '');
  const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'admin';
  const isOfficer = normalizedRole === 'officer';

  const [activeTab, setActiveTab] = useState<'mailboxes' | 'storage' | 'radar' | 'officer'>('mailboxes');

  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ mailboxAddress: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Storage tab state
  const [syncingSynology, setSyncingSynology] = useState(false);
  const [initingSynology, setInitingSynology] = useState(false);
  const [storageSearch, setStorageSearch] = useState('');

  // Security Radar state
  const [radarSearch, setRadarSearch] = useState('');
  const [radarActiveOnly, setRadarActiveOnly] = useState(false);
  const [refreshingRadar, setRefreshingRadar] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
  const [terminatingAccountId, setTerminatingAccountId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Mailboxes data
  const { data, mutate, isLoading } = useSWR<{ data: Mailbox[]; quota: { used: number; limit: number } }>(
    '/mailboxes?limit=100',
    fetcher
  );

  // Storage Overview data (Super Admin only)
  const { data: storageData, mutate: mutateStorage, isLoading: isStorageLoading } = useSWR<StorageOverview>(
    isSuperAdmin ? '/storage/overview' : null,
    fetcher
  );

  // Synology Laptop Runner Status (Super Admin only, 5s polling)
  const { data: runnerStatus, mutate: mutateRunner } = useSWR<{
    isOnline: boolean;
    lastSeenSecondsAgo: number | null;
    hostname: string | null;
    targetDir: string | null;
    activeJob: any;
  }>(isSuperAdmin ? '/storage/sync-agent/status' : null, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  // Security Radar data (Super Admin only, 5s live polling)
  const { data: radarData, mutate: mutateRadar, isLoading: isRadarLoading } = useSWR<SecurityRadarData>(
    isSuperAdmin ? '/security/admin/radar' : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
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
      if (isSuperAdmin) {
        mutateStorage();
        mutateRadar();
      }
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setToast(errMsg(err, 'Gagal memuat data demo'));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSeeding(false);
    }
  };

  const handleSyncSynology = async () => {
    setSyncingSynology(true);
    try {
      if (!runnerStatus?.isOnline) {
        setToast('⚠️ Laptop runner sedang offline. Nyalakan laptop Fedora Anda untuk menjalankan sinkronisasi.');
        setTimeout(() => setToast(''), 5000);
        setSyncingSynology(false);
        return;
      }

      setToast('🚀 Mengirim perintah sinkronisasi ke laptop Anda...');
      const queueRes = await api.post('/storage/sync-queue', { dryRun: false });
      const jobId = queueRes.data.jobId;

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const checkRes = await api.get(`/storage/sync-queue/status/${jobId}`);
          const job = checkRes.data;
          if (job.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setSyncingSynology(false);
            const { syncedCount, skippedCount, totalBytesCopied } = job.result || {};
            const sizeMb = ((totalBytesCopied || 0) / (1024 * 1024)).toFixed(2);
            setToast(`✅ Berhasil! ${syncedCount ?? 0} berkas baru disalin ke Synology laptop Anda, ${skippedCount ?? 0} dilewati (${sizeMb} MB)`);
            mutateStorage();
            mutateRunner();
            setTimeout(() => setToast(''), 6000);
          } else if (job.status === 'FAILED') {
            clearInterval(pollInterval);
            setSyncingSynology(false);
            setToast(`❌ Sinkronisasi gagal: ${job.error || 'Terjadi kesalahan di runner laptop'}`);
            setTimeout(() => setToast(''), 5000);
          } else if (attempts > 30) {
            clearInterval(pollInterval);
            setSyncingSynology(false);
            setToast('⚠️ Waktu tunggu sinkronisasi habis. Periksa log runner di laptop.');
            setTimeout(() => setToast(''), 5000);
          }
        } catch {
          // ignore transient poll error
        }
      }, 1500);
    } catch (err: any) {
      setSyncingSynology(false);
      setToast(errMsg(err, 'Gagal memicu sinkronisasi ke laptop'));
      setTimeout(() => setToast(''), 5000);
    }
  };

  const handleInitSynologyFolder = async () => {
    setInitingSynology(true);
    try {
      await api.post('/storage/init-synology-folder');
      setToast('Folder Synology Drive berhasil diinisialisasi!');
      mutateStorage();
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setToast(errMsg(err, 'Gagal inisialisasi folder Synology'));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setInitingSynology(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    setTerminatingSessionId(sessionId);
    try {
      await api.post(`/security/admin/sessions/${sessionId}/terminate`);
      setToast('Sesi perangkat berhasil diputuskan');
      mutateRadar();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast(errMsg(err, 'Gagal memutuskan sesi'));
      setTimeout(() => setToast(''), 3000);
    } finally {
      setTerminatingSessionId(null);
    }
  };

  const handleTerminateAllAccountSessions = async (customerId: string, accountName: string) => {
    if (!window.confirm(`Putuskan semua sesi aktif untuk akun "${accountName}"? Pengguna harus login ulang di semua perangkat.`)) {
      return;
    }
    setTerminatingAccountId(customerId);
    try {
      const res = await api.post(`/security/admin/accounts/${customerId}/terminate-all`);
      setToast(`Berhasil memutuskan ${res.data.terminatedCount} sesi akun ${accountName}`);
      mutateRadar();
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setToast(errMsg(err, 'Gagal memutuskan seluruh sesi akun'));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setTerminatingAccountId(null);
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

  const handleImpersonate = async (customerId: string) => {
    try {
      setImpersonatingId(customerId);
      const res = await api.post(`/auth/impersonate/${customerId}`);
      const { token, user, impersonatedBy } = res.data;

      localStorage.setItem('customer_token', token);
      localStorage.setItem('customer_user', JSON.stringify(user));
      if (impersonatedBy) {
        localStorage.setItem('staff_impersonation', JSON.stringify(impersonatedBy));
      }

      const bridgeUrl = `/auth/impersonate?token=${encodeURIComponent(token)}&user=${encodeURIComponent(
        JSON.stringify(user)
      )}&officer=${encodeURIComponent(JSON.stringify(impersonatedBy))}`;

      window.open(bridgeUrl, '_blank');
      setToast(`Webmail ${user.email} berhasil dibuka di tab baru`);
      setTimeout(() => setToast(''), 3500);
    } catch (err: any) {
      setToast(errMsg(err, 'Gagal membuka akun customer'));
      setTimeout(() => setToast(''), 4000);
    } finally {
      setImpersonatingId(null);
    }
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

  const filteredStorageAccounts = (storageData?.accounts || []).filter((acc) => {
    if (!storageSearch.trim()) return true;
    const q = storageSearch.toLowerCase();
    return (
      (acc.name && acc.name.toLowerCase().includes(q)) ||
      (acc.mailboxAddress && acc.mailboxAddress.toLowerCase().includes(q)) ||
      (acc.personalEmail && acc.personalEmail.toLowerCase().includes(q))
    );
  });

  const filteredRadarAccounts = (radarData?.accounts || []).filter((acc) => {
    if (radarActiveOnly && acc.activeSessionsCount === 0) return false;
    if (!radarSearch.trim()) return true;
    const q = radarSearch.toLowerCase();
    return (
      (acc.name && acc.name.toLowerCase().includes(q)) ||
      (acc.mailboxAddress && acc.mailboxAddress.toLowerCase().includes(q)) ||
      acc.uniqueIps.some((ip) => ip.includes(q))
    );
  });

  return (
    <div className="app-shell selection:bg-primary/20 selection:text-primary">
      <SuiteHeader
        admin
        product={isOfficer ? 'Officer Console' : 'Super Admin Console'}
        description={isOfficer ? 'Provisioning akun & layanan legal klien' : 'Provisioning, Cold Storage Synology & Security Radar'}
        userName={user?.name}
        userEmail={user?.email}
        onLogout={() => {
          logout();
          router.replace('/login');
        }}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                isOfficer
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              Role: {user?.role || (isOfficer ? 'officer' : 'superadmin')}
            </span>
            <button
              onClick={() => router.push(customerToken ? '/inbox' : '/login')}
              className="app-secondary-button hidden !min-h-9 !px-3 !text-xs sm:inline-flex"
            >
              <span>Buka Mail</span>
              <ExternalLink className="size-3.5" />
            </button>
          </div>
        }
      />

      {/* Main Container */}
      <main className="page-canvas w-full flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          
          {/* Header Title & Role Badge */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="page-title">
                {isOfficer ? 'Portal Operasional Staf Legal' : 'EasyLegal Super Admin Console'}
              </h1>
              <p className="page-description">
                {isOfficer
                  ? 'Pusat pembuatan akun email klien resmi, verifikasi identitas, dan layanan asistensi legal.'
                  : 'Kelola mailbox, kontrol sinkronisasi cold-storage Synology, inspeksi kapasitas storage global, dan pantau Security Radar.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                Domain: clienteasylegal.co.id
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('mailboxes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'mailboxes'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-primary" />
              <span>Akun Mailbox</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                {mailboxes.length}
              </span>
            </button>

            {/* Super Admin Tabs */}
            {isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('storage')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'storage'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <span>Synology & Storage Inspector</span>
                  {storageData && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold">
                      {formatBytes(storageData.totalStorageUsedBytes)}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('radar')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'radar'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Radio className="w-4 h-4 text-amber-600" />
                  <span>Security Radar</span>
                  {radarData?.summary.multiIpAlertCount ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-bold animate-pulse">
                      {radarData.summary.multiIpAlertCount} Alert
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                      {radarData?.summary.totalActiveSessions ?? 0} Sesi
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Officer Workflow Tab */}
            {isOfficer && (
              <button
                type="button"
                onClick={() => setActiveTab('officer')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'officer'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <LifeBuoy className="w-4 h-4 text-primary" />
                <span>Pintasan Operasional Staf</span>
              </button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: MAILBOX MANAGEMENT                                                */}
          {/* ========================================================================= */}
          {activeTab === 'mailboxes' && (
            <div className="space-y-6">
              {/* Top Banner & KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Quota */}
                <div className="app-panel flex flex-col justify-between p-5 sm:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">Kuota Mailbox Hostinger</span>
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <HardDrive className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div data-testid="quota" className="text-2xl font-bold text-slate-900 tracking-tight">
                      {quota ? `${quota.used} / ${quota.limit}` : '-'}
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
                <div className="app-panel flex flex-col justify-between p-5">
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
                <div className="app-panel flex flex-col justify-between p-5">
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
              </div>

              {/* Temporary Password Banner (After Creation) */}
              {created && (
                <div
                  data-testid="created-credentials"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-xs animate-in fade-in"
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
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Mailbox Baru</span>
                  </button>
                </div>
              </div>

              {/* Mailbox Data Table */}
              <div className="app-panel overflow-hidden">
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

                            {/* Mailbox address + 1-Click Login Button */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                  {m.mailboxAddress}
                                </span>
                                {isActive && (
                                  <button
                                    type="button"
                                    data-testid={`impersonate-${m.id}`}
                                    title={`Login 1-klik ke mailbox ${m.mailboxAddress}`}
                                    onClick={() => handleImpersonate(m.id)}
                                    disabled={impersonatingId === m.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shrink-0 shadow-2xs disabled:opacity-50 cursor-pointer"
                                  >
                                    {impersonatingId === m.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                    )}
                                    <span>Buka Akun</span>
                                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-75" />
                                  </button>
                                )}
                              </div>
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SYNOLOGY COLD STORAGE & MASTER STORAGE INSPECTOR (SUPER ADMIN)     */}
          {/* ========================================================================= */}
          {activeTab === 'storage' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Synology Cold Storage Controller Card */}
              <div className="app-panel p-6 border-emerald-200/60 bg-gradient-to-br from-white via-white to-emerald-50/30">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                        <FolderArchive className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>Synology Drive Cold Storage</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              runnerStatus?.isOnline
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${runnerStatus?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {runnerStatus?.isOnline
                              ? `Laptop Online (${runnerStatus.hostname || 'fedora'})`
                              : 'Laptop Offline'}
                          </span>
                        </h2>
                        <p className="text-xs text-slate-500">
                          Penyimpanan arsip dingin khusus dieksekusi di laptop Fedora Super Admin ke Synology Drive Client untuk diunggah ke NAS kantor.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">Jalur Target Laptop</span>
                        <span className="text-xs font-mono font-medium text-slate-800 truncate block mt-0.5" title={runnerStatus?.targetDir || storageData?.synology.targetPath}>
                          {runnerStatus?.targetDir || storageData?.synology.targetPath || '/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">Status Runner Laptop</span>
                        <span className="text-xs font-medium text-emerald-700 block mt-0.5 flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5" />
                          <span>{runnerStatus?.isOnline ? 'Daemon Terhubung' : 'Belum Menyala'}</span>
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">Berkas Tersinkron</span>
                        <span className="text-xs font-bold text-slate-800 block mt-0.5">
                          {storageData?.synology.totalSyncedFiles ?? 0} berkas ({storageData?.synology.pendingFiles ?? 0} pending)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Manual On-Demand Trigger Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncSynology}
                      disabled={syncingSynology || !runnerStatus?.isOnline}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
                      title={!runnerStatus?.isOnline ? 'Nyalakan runner di laptop Fedora Anda untuk mengaktifkan tombol ini' : undefined}
                    >
                      {syncingSynology ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Laptop className="w-4 h-4" />
                      )}
                      <span>
                        {syncingSynology
                          ? 'Menyinkronkan ke Laptop...'
                          : runnerStatus?.isOnline
                          ? 'Sinkronkan ke Synology Sekarang'
                          : 'Laptop Runner Sedang Offline'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInitSynologyFolder}
                      disabled={initingSynology}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50"
                    >
                      {initingSynology ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Inisialisasi Direktori</span>
                    </button>
                  </div>
                </div>

                {/* Helpful Note for Staff */}
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pencarian Cepat Berkas &gt;3 Bulan:</strong> Setelah 3 bulan, dokumen klien tersimpan rapi di Synology Drive di dalam folder beralamat email klien (contoh: <code className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-emerald-300">accounts/ptsinarjaya@clienteasylegal.co.id/documents/</code>). Staf cukup mengetik alamat email klien di pencarian Synology untuk menemukan seluruh berkas dalam hitungan detik.
                  </div>
                </div>
              </div>

              {/* Master Storage Inspector Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Master Storage Inspector</h3>
                    <p className="text-xs text-slate-500">
                      Pemantauan total kuota penyimpanan S3 Cloud dan rincian pemakaian per akun customer.
                    </p>
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      value={storageSearch}
                      onChange={(e) => setStorageSearch(e.target.value)}
                      placeholder="Filter akun..."
                      className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Global Storage Metrics Bar */}
                {storageData && (
                  <div className="app-panel p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block">Total Penyimpanan Digunakan</span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block">
                        {formatBytes(storageData.totalStorageUsedBytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block">Total Kapasitas Terdaftar</span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block">
                        {formatBytes(storageData.totalStorageQuotaBytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block">Akun Mendekati Batas (&gt;80%)</span>
                      <span className="text-xl font-bold text-amber-600 mt-1 block">
                        {storageData.accounts.filter((a) => a.warningExceeded80).length} Akun
                      </span>
                    </div>
                  </div>
                )}

                {/* Per-Account Storage Table */}
                <div className="app-panel overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                          <th className="px-5 py-3">Klien & Email Mailbox</th>
                          <th className="px-5 py-3">Terpakai</th>
                          <th className="px-5 py-3">Kapasitas Maksimal</th>
                          <th className="px-5 py-3">Persentase</th>
                          <th className="px-5 py-3 text-right">Status Kuota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {isStorageLoading && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                              <RefreshCw className="w-4 h-4 animate-spin inline mr-2 text-primary" />
                              Memuat data storage inspector...
                            </td>
                          </tr>
                        )}
                        {!isStorageLoading && filteredStorageAccounts.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                              Tidak ada akun ditemukan.
                            </td>
                          </tr>
                        )}
                        {filteredStorageAccounts.map((acc) => (
                          <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-semibold text-slate-900 block text-xs">{acc.name}</span>
                              <span className="font-mono text-slate-500 text-[11px]">{acc.mailboxAddress}</span>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-900">
                              {formatBytes(acc.usedBytes)}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {formatBytes(acc.quotaBytes)} (5 GB Default)
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="w-32">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                  <span>{acc.percentUsed}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${acc.warningExceeded80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.max(acc.percentUsed, 4)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {acc.warningExceeded80 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Kapasitas &gt;80%
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Normal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SECURITY RADAR & SESSION MONITORING (SUPER ADMIN)                  */}
          {/* ========================================================================= */}
          {activeTab === 'radar' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Multi-IP Anomaly Alert Banner */}
              {radarData && radarData.summary.multiIpAlertCount > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-amber-900">
                      Peringatan Keamanan: Terdeteksi Akses Multi-IP Simultan ({radarData.summary.multiIpAlertCount} Akun)
                    </h3>
                    <p className="text-xs text-amber-800 mt-1">
                      Akun yang ditandai dengan badge merah sedang diakses dari beberapa alamat IP publik berbeda secara bersamaan. Pastikan apakah ini staf resmi customer atau potensi akses tanpa izin. Anda dapat memutuskan sesi yang mencurigakan di bawah ini.
                    </p>
                  </div>
                </div>
              )}

              {/* Radar KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="app-panel p-5">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Akun Terpantau</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {radarData?.summary.totalAccounts ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Semua akun customer aktif</p>
                </div>

                <div className="app-panel p-5">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Sesi Login Aktif</span>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {radarData?.summary.totalActiveSessions ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Sesi token yang aktif saat ini</p>
                </div>

                <div className="app-panel p-5">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Anomali Multi-IP</span>
                  <div className={`text-2xl font-bold mt-1 ${radarData?.summary.multiIpAlertCount ? 'text-red-600' : 'text-slate-900'}`}>
                    {radarData?.summary.multiIpAlertCount ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {radarData?.summary.multiIpAlertCount ? 'Memerlukan verifikasi' : 'Seluruh akun dalam kondisi aman'}
                  </p>
                </div>
              </div>

              {/* Search & Account Sessions List */}
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Radar Sesi Perangkat & IP Pengakses</h3>
                    <p className="text-xs text-slate-500">
                      Daftar seluruh perangkat, alamat IP publik, dan lokasi yang sedang membuka akun email customer.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Live status badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live 5s</span>
                    </div>

                    {/* Manual Refresh */}
                    <button
                      type="button"
                      onClick={async () => {
                        setRefreshingRadar(true);
                        await mutateRadar();
                        setTimeout(() => setRefreshingRadar(false), 400);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-xs"
                      title="Segarkan data radar sekarang"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingRadar ? 'animate-spin text-primary' : ''}`} />
                      <span>Segarkan</span>
                    </button>

                    {/* Filter Active Only Toggle */}
                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setRadarActiveOnly(false)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          !radarActiveOnly ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Semua ({radarData?.accounts.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRadarActiveOnly(true)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          radarActiveOnly ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Sesi Aktif ({radarData?.accounts.filter((a) => a.activeSessionsCount > 0).length ?? 0})
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative min-w-[180px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        value={radarSearch}
                        onChange={(e) => setRadarSearch(e.target.value)}
                        placeholder="Cari akun atau IP..."
                        className="w-full pl-9 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {isRadarLoading && (
                  <div className="app-panel p-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-primary" />
                    Memindai sesi dan radar keamanan...
                  </div>
                )}

                {!isRadarLoading && filteredRadarAccounts.length === 0 && (
                  <div className="app-panel p-10 text-center text-slate-400">
                    Tidak ada akun ditemukan dalam radar.
                  </div>
                )}

                <div className="space-y-4">
                  {filteredRadarAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`app-panel p-5 transition-all ${
                        account.isMultiIpAlert
                          ? 'border-red-300 bg-red-50/20 shadow-sm'
                          : 'hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {initials(account.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900">{account.name}</h4>
                              {account.isMultiIpAlert && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Multi-IP ({account.uniqueIps.length} Lokasi IP)
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-slate-500 text-[11px]">{account.mailboxAddress}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">
                            {account.sessions.length} sesi aktif ({account.uniqueIps.length} IP unik)
                          </span>
                          {account.sessions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleTerminateAllAccountSessions(account.id, account.name)}
                              disabled={terminatingAccountId === account.id}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl border border-red-200/80 transition-all disabled:opacity-50"
                            >
                              {terminatingAccountId === account.id ? 'Memutuskan...' : 'Putuskan Semua Sesi'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sessions Sub-List */}
                      <div className="mt-3 space-y-2">
                        {account.sessions.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-2">
                            Tidak ada sesi aktif saat ini.
                          </div>
                        ) : (
                          account.sessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200/60 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                  {session.deviceType === 'mobile' ? (
                                    <Smartphone className="w-4 h-4" />
                                  ) : (
                                    <Laptop className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800">{session.deviceName}</span>
                                    {session.isCurrent && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Sesi Terkini
                                      </span>
                                    )}
                                    {(session.ipAddress === '127.0.0.1' || session.location?.includes('Lokal')) && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                                        Localhost (Laptop Ini)
                                      </span>
                                    )}
                                    {new Date().getTime() - new Date(session.lastActiveAt).getTime() < 10 * 60 * 1000 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Baru Saja Aktif
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                      IP: {session.ipAddress}
                                    </span>
                                    <span>{session.location}</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {format(new Date(session.lastActiveAt), 'd MMM, HH:mm', { locale: localeId })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleTerminateSession(session.id)}
                                disabled={terminatingSessionId === session.id}
                                className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200/60 self-end sm:self-center disabled:opacity-50"
                              >
                                {terminatingSessionId === session.id ? 'Memutuskan...' : 'Putuskan Sesi'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: OFFICER SHORTCUTS & OPERATIONS                                     */}
          {/* ========================================================================= */}
          {activeTab === 'officer' && isOfficer && (
            <div className="space-y-6">
              <div className="app-panel p-6 bg-gradient-to-br from-white via-white to-primary/5 border-primary/20">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-primary" />
                  <span>Ruang Kerja Staf Legal & Operasional Mailbox</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Akses langsung ke seluruh instrumen pendukung customer legal tanpa harus berpindah aplikasi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                  <div
                    onClick={() => router.push('/support')}
                    className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-primary cursor-pointer transition-all hover:shadow-xs group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <LifeBuoy className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-3">Tiket Bantuan Klien</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Bantu tangani permohonan pemulihan berkas arsip & konsultasi legal klien.
                    </p>
                  </div>

                  <div
                    onClick={() => router.push('/documents')}
                    className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-500 cursor-pointer transition-all hover:shadow-xs group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-3">Dokumen Legal</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Periksa dokumen legal klien (Akta, SK Menkumham, Perjanjian Kerjasama).
                    </p>
                  </div>

                  <div
                    onClick={() => router.push(customerToken ? '/inbox' : '/login')}
                    className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xs group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Mail className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-3">Buka Webmail Staf</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Kirim surat resmi atau cek korespondensi legal customer di portal email.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick 1-Click Mailbox Access for Officer */}
              <div className="app-panel p-5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Akses Cepat 1-Klik Mailbox Klien</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Masuk langsung ke webmail klien untuk pengecekan dokumen dan korespondensi tanpa memasukkan sandi.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mailboxes.filter(m => m.status === 'active').slice(0, 6).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="block text-xs font-bold text-slate-800 truncate">{m.name}</span>
                        <span className="block text-[11px] font-mono text-slate-500 truncate">{m.mailboxAddress}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImpersonate(m.id)}
                        disabled={impersonatingId === m.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors shrink-0 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {impersonatingId === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        )}
                        <span>Buka Webmail</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-75" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template Onboarding WhatsApp */}
              <div className="app-panel p-5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Template Pesan Kredensial Customer (WhatsApp / Email Pribadi)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Gunakan format resmi berikut saat menyampaikan informasi aktivasi mailbox baru ke klien.
                </p>

                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 whitespace-pre-wrap">
{`Yth. Klien EasyLegal,

Akun email bisnis resmi perusahaan Anda telah aktif:
📧 Alamat Email : [alamat_email]@clienteasylegal.co.id
🔑 Password Sementara : [password_sementara]
🌐 Portal Akses : https://clienteasylegal.co.id/login

Silakan login dan segera ubah password Anda di menu Pengaturan Keamanan.
Salam hormat,
Tim Legal EasyLegal`}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
`Yth. Klien EasyLegal,\n\nAkun email bisnis resmi perusahaan Anda telah aktif:\n📧 Alamat Email : [alamat_email]@clienteasylegal.co.id\n🔑 Password Sementara : [password_sementara]\n🌐 Portal Akses : https://clienteasylegal.co.id/login\n\nSilakan login dan segera ubah password Anda di menu Pengaturan Keamanan.\nSalam hormat,\nTim Legal EasyLegal`
                      );
                      setToast('Template pesan disalin ke clipboard!');
                      setTimeout(() => setToast(''), 3000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Template</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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
        className="modal-panel max-w-md overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-4 bg-primary text-white select-none">
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
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-white px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Buat Mailbox</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
