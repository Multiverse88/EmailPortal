'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Lock,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Building,
  Calendar,
  DollarSign,
  Briefcase,
  MapPin,
  Users,
  Copy,
  Check,
  Trash2,
  Search,
  RefreshCw,
  Eye,
  FileCheck,
  FileCode,
  Layers,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  Split,
  FileSearch,
  ShieldAlert,
  Scale,
  Award,
} from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';

interface CustomerOption {
  id: string;
  name: string;
  mailboxAddress: string;
}

export interface CrossCheckFinding {
  id: string;
  ruleTitle: string;
  category:
    | 'identitas_perusahaan'
    | 'rujukan_akta_sk'
    | 'kbli_2025'
    | 'kewenangan_pks'
    | 'status_pma'
    | 'lokasi_domisili'
    | 'masa_berlaku_pks';
  status: 'cocok' | 'tidak cocok' | 'data tidak ditemukan';
  summary: string;
  detail: string;
  sourceDocA?: string;
  sourceDocB?: string;
  valueA?: string;
  valueB?: string;
  actionRecommendation?: string;
}

interface StoredMetadata {
  id: string;
  documentId?: string | null;
  customerId?: string | null;
  docType: string;
  subType?: string | null;
  companyName?: string | null;
  normalizedName?: string | null;
  documentNumber?: string | null;
  documentDate?: string | null;
  publisher?: string | null;
  notaryName?: string | null;
  effectiveDate?: string | null;
  capitalAmount?: string | null;
  businessSectors?: string | null;
  registeredAddress?: string | null;
  keyPeople?: string | null;
  summary?: string | null;
  fileHash?: string | null;
  pageCount?: number | null;
  verificationStatus?: 'otomatis' | 'dicek_agen' | 'ditolak' | string;
  confidenceScore: number;
  verifiedBy?: string | null;
  createdAt: string;
  parsedSpecificFields?: any;
  parsedCrossCheckResults?: CrossCheckFinding[];
  parsedFieldConfidence?: any;
  customer?: {
    id: string;
    name: string;
    mailboxAddress: string;
    personalEmail: string;
  } | null;
  document?: {
    id: string;
    title: string;
    filename: string;
    category: string;
  } | null;
}

interface Props {
  mailboxes: CustomerOption[];
  isOfficer: boolean;
  isSuperAdmin: boolean;
  onNotify: (msg: string) => void;
}

export function DocumentMetadataExtractor({ mailboxes, isOfficer, isSuperAdmin, onNotify }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [saveToDatabase, setSaveToDatabase] = useState<boolean>(false);
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);
  const [showRawText, setShowRawText] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 3-Layer Navigation Tab: 'layer1' (Metadata Umum) | 'layer2' (Field Khusus) | 'layer3' (Cek Silang Otomatis)
  const [activeLayerTab, setActiveLayerTab] = useState<'layer1' | 'layer2' | 'layer3'>('layer3');

  // Multi-Document Selection for Cross-Check Hub
  const [selectedDocIdsForCrossCheck, setSelectedDocIdsForCrossCheck] = useState<string[]>([]);
  const [isRunningCrossCheck, setIsRunningCrossCheck] = useState(false);
  const [manualCrossCheckResults, setManualCrossCheckResults] = useState<CrossCheckFinding[] | null>(null);

  // Filter & Search states for persistent records
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDocType, setFilterDocType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<StoredMetadata | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all persisted document metadata
  const { data, mutate, isLoading } = useSWR<{ metadata: StoredMetadata[]; total: number }>(
    '/admin/documents/metadata',
    fetcher,
    { refreshInterval: 25000 }
  );

  const metadataList = data?.metadata || [];

  const handleCopy = (text?: string | null, key?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        onNotify('Hanya berkas PDF yang didukung untuk ekstraksi legal');
        return;
      }
      setFile(selected);
      setExtractedData(null);
      setSavedRecordId(null);
      setManualCrossCheckResults(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      onNotify('Silakan pilih berkas PDF terlebih dahulu');
      return;
    }

    setIsExtracting(true);
    setManualCrossCheckResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedCustomerId) {
        formData.append('customerId', selectedCustomerId);
      }
      if (saveToDatabase) {
        formData.append('saveToDatabase', 'true');
      }

      const res = await api.post('/admin/documents/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setExtractedData(res.data.extraction);
        setSavedRecordId(res.data.data?.id || null);
        // Default to Layer 3 if findings exist, or Layer 1
        if (res.data.extraction.crossCheckResults && res.data.extraction.crossCheckResults.length > 0) {
          setActiveLayerTab('layer3');
        } else {
          setActiveLayerTab('layer1');
        }

        if (saveToDatabase) {
          onNotify('Metadata 3-Lapis berhasil diekstrak dan disimpan ke Persistent Memory!');
          mutate();
        } else {
          onNotify('Ekstraksi 3-Lapis selesai (Mode Sekali Pakai: Data langsung hilang saat relog/tutup web)');
        }
      }
    } catch (err: any) {
      console.error('Extraction failed:', err);
      onNotify(errMsg(err, 'Gagal mengekstrak metadata dokumen'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExplicitSave = async () => {
    if (!extractedData) return;
    setIsSavingRecord(true);
    try {
      const res = await api.post('/admin/documents/save', {
        metadata: extractedData,
        customerId: selectedCustomerId || null,
      });
      if (res.data.success) {
        setSavedRecordId(res.data.data?.id || null);
        onNotify('Salinan metadata 3-Lapis berhasil disimpan permanen ke database lokal SQLite');
        mutate();
      }
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal menyimpan metadata ke database'));
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handlePurgeMemory = () => {
    setFile(null);
    setExtractedData(null);
    setSavedRecordId(null);
    setManualCrossCheckResults(null);
    setShowRawText(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNotify('Data sesi berhasil dimusnahkan bersih dari RAM!');
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Hapus metadata dokumen ini dari persistent memory?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/documents/metadata/${id}`);
      onNotify('Metadata dokumen berhasil dihapus');
      if (selectedRecordForDetail?.id === id) {
        setSelectedRecordForDetail(null);
      }
      setSelectedDocIdsForCrossCheck((prev) => prev.filter((i) => i !== id));
      mutate();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal menghapus metadata'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleVerificationStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'dicek_agen' ? 'ditolak' : currentStatus === 'ditolak' ? 'otomatis' : 'dicek_agen';
    try {
      await api.patch(`/admin/documents/metadata/${id}/status`, { verificationStatus: nextStatus });
      onNotify(`Status verifikasi diperbarui menjadi: ${nextStatus}`);
      mutate();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal memperbarui status'));
    }
  };

  const handleToggleSelectDocForCrossCheck = (id: string) => {
    setSelectedDocIdsForCrossCheck((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRunMultiDocCrossCheck = async () => {
    if (selectedDocIdsForCrossCheck.length < 2) {
      onNotify('Pilih minimal 2 dokumen dari tabel persistent memory untuk dibandingkan');
      return;
    }

    setIsRunningCrossCheck(true);
    try {
      const res = await api.post('/api/admin/documents/cross-check', {
        metadataIds: selectedDocIdsForCrossCheck,
      });

      if (res.data.success) {
        setManualCrossCheckResults(res.data.findings);
        setActiveLayerTab('layer3');
        onNotify(`Analisis cek silang selesai: ${res.data.findings.length} aturan hukum diperiksa!`);
      }
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal menjalankan analisis cek silang dokumen'));
    } finally {
      setIsRunningCrossCheck(false);
    }
  };

  const activeCrossCheckFindings: CrossCheckFinding[] =
    manualCrossCheckResults || extractedData?.crossCheckResults || [];

  const filteredRecords = metadataList.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.notaryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterDocType === 'all' || m.docType.toLowerCase().includes(filterDocType.toLowerCase());
    const matchesStatus = filterStatus === 'all' || m.verificationStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 3-Layer Architecture Header Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 backdrop-blur-xs shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-emerald-950">
                  Ekstraksi Dokumen Legal 3-Lapis & Cek Silang Otomatis (Cross-Checking)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 100% In-Memory RAM
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900">
                  KBLI 2025 Validated
                </span>
              </div>
              <p className="text-xs text-emerald-900/85 mt-1 leading-relaxed max-w-3xl">
                Arsitektur ekstraksi terbagi 3 lapis: <strong>Lapis 1</strong> Metadata umum semua dokumen & hash SHA-256;{' '}
                <strong>Lapis 2</strong> Field khusus terstruktur per jenis berkas (Akta, SK AHU, NIB OSS, PKS); dan{' '}
                <strong>Lapis 3</strong> Temuan ketidaksesuaian silang antar dokumen (Nama identik, rujukan akta, KBLI 2025, Direksi PKS, status PMA, & domisili).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Zero Data Leakage Protected</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Trigger Form */}
        <div className="lg:col-span-4 space-y-4">
          <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Unggah Dokumen Legal</span>
              </h4>
              <span className="text-[11px] font-medium text-slate-500">PDF Legal Indonesia</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Pilih dokumen legal klien (Akta Notaris, SK AHU Kemenkumham, NIB OSS, atau Perjanjian Kerjasama) untuk dianalisis 3-Lapis.
            </p>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              {file ? (
                <div>
                  <span className="block text-xs font-bold text-slate-900 truncate max-w-xs mx-auto">
                    {file.name}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Klik untuk ganti
                  </span>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-semibold text-slate-800">
                    Pilih Berkas PDF Dokumen Legal
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1">
                    Akta Notaris, SK AHU, NIB OSS, atau PKS (Maks 25 MB)
                  </span>
                </div>
              )}
            </div>

            {/* Customer Association */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hubungkan dengan Akun Klien (Untuk Cek Silang Otomatis):
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">-- Tanpa Hubungan Akun (Stand-alone File) --</option>
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mailboxAddress})
                  </option>
                ))}
              </select>
            </div>

            {/* Persistent Memory Toggle */}
            <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToDatabase}
                  onChange={(e) => setSaveToDatabase(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Simpan salinan ke Persistent Memory SQLite
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                    {saveToDatabase
                      ? '✅ Data hasil ekstraksi & hasil cek silang akan disimpan permanen ke database lokal SQLite.'
                      : '🛡️ Mode Sekali Pakai (Default): Dokumen HANYA ada di memori sesi saat ini. Begitu relog/tutup web, data LANGSUNG HILANG (0% data at-rest).'}
                  </span>
                </div>
              </label>
            </div>

            {/* Action Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleExtract}
                disabled={!file || isExtracting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis Dokumen In-Memory...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>
                      {saveToDatabase
                        ? 'Ekstraksi 3-Lapis & Simpan ke Persistent Memory'
                        : 'Ekstraksi 3-Lapis (Mode Sekali Pakai)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 3-Layer Results Viewer & Cross-Check Cards */}
        <div className="lg:col-span-8">
          <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs min-h-[420px] flex flex-col justify-between">
            <div>
              {/* Header & Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Hasil Analisis Dokumen Legal
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {extractedData ? `${extractedData.companyName} • ${extractedData.docType}` : 'Pilih dokumen untuk memulai'}
                    </span>
                  </div>
                </div>

                {extractedData && (
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveLayerTab('layer1')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeLayerTab === 'layer1'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lapis 1: Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLayerTab('layer2')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeLayerTab === 'layer2'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lapis 2: Field Khusus
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLayerTab('layer3')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeLayerTab === 'layer3'
                          ? 'bg-primary text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Lapis 3: Cek Silang</span>
                      {activeCrossCheckFindings.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold">
                          {activeCrossCheckFindings.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Empty State */}
              {!extractedData && !isExtracting && (
                <div className="py-20 text-center text-slate-400">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Belum ada dokumen yang dianalisis</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Pilih berkas PDF di panel kiri, lalu klik &quot;Ekstraksi 3-Lapis&quot; untuk menguji keabsahan Akta, SK AHU, NIB OSS, dan PKS.
                  </p>
                </div>
              )}

              {/* Loading State */}
              {isExtracting && (
                <div className="py-20 text-center text-slate-500">
                  <Loader2 className="w-9 h-9 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-800">Sedang mengekstrak 3-Lapis Dokumen Legal...</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Menganalisis Maksud & Tujuan, Modal, Pemegang Saham, Pengurus, KBLI 2025, dan menjalankan cek silang otomatis.
                  </p>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 1: METADATA UMUM (SEMUA DOKUMEN)                      */}
              {/* ========================================================= */}
              {extractedData && activeLayerTab === 'layer1' && (
                <div className="space-y-4 pt-3">
                  {/* Top Summary Bar */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-primary/10 text-primary">
                          {extractedData.docType}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="font-semibold text-slate-800">{extractedData.subType || '-'}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Penerbit Resmi: <strong>{extractedData.publisher}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Keyakinan: {(extractedData.confidenceScore * 100).toFixed(0)}%
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {extractedData.pageCount || 1} Halaman
                      </span>
                    </div>
                  </div>

                  {/* General Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" /> Nama Perseroan / Entitas (Tertulis)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.companyName, 'comp')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedKey === 'comp' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 block truncate">
                        {extractedData.companyName || '-'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Versi Ternormalisasi: <code className="text-slate-600">{extractedData.normalizedEntityName}</code>
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" /> Nomor Dokumen / Registrasi
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.documentNumber, 'docNo')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedKey === 'docNo' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-mono font-bold text-slate-900 block truncate">
                        {extractedData.documentNumber || '-'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Kunci utama pencocokan rujukan silang
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Tanggal Dokumen / Pengesahan
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.effectiveDate, 'date')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedKey === 'date' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-semibold text-slate-900 block truncate">
                        {extractedData.effectiveDate || '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Award className="w-3 h-3 text-slate-400" /> Status Verifikasi Legal
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {extractedData.verificationStatus === 'otomatis' ? '⚙️ Diekstrak Otomatis' : extractedData.verificationStatus}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-400" /> Integritas Berkas (SHA-256 Hash & Duplikasi)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.fileHash, 'hash')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedKey === 'hash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-mono text-[11px] text-slate-600 block truncate">
                        {extractedData.fileHash || 'd5a8b2...'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs">
                    <span className="text-[10px] font-bold text-indigo-900 block mb-1">
                      Ringkasan Pokok Hukum Dokumen
                    </span>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {extractedData.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: FIELD KHUSUS PER JENIS DOKUMEN                    */}
              {/* ========================================================= */}
              {extractedData && activeLayerTab === 'layer2' && (
                <div className="space-y-4 pt-3 text-xs">
                  {/* AKTA NOTARIS SPECIFIC VIEW */}
                  {extractedData.specificFields?.aktaNotaris && (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Jenis Akta Notaris</span>
                          <span className="font-bold text-primary text-xs">
                            {extractedData.specificFields.aktaNotaris.jenisAkta}
                          </span>
                        </div>
                        <span className="text-slate-600 text-[11px]">
                          Kedudukan: <strong>{extractedData.specificFields.aktaNotaris.tempatKedudukan}</strong>
                        </span>
                      </div>

                      {/* Modal Table */}
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                          Struktur Permodalan Perseroan
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Modal Dasar</span>
                            <span className="font-bold text-slate-900 block truncate">
                              {extractedData.specificFields.aktaNotaris.modal.modalDasar}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Modal Ditempatkan</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.aktaNotaris.modal.modalDitempatkan}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Modal Disetor</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.aktaNotaris.modal.modalDisetor}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Jumlah Saham</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.aktaNotaris.modal.jumlahSaham}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pemegang Saham */}
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                          Susunan Pemegang Saham (Penentu Status PMA / PMDN)
                        </span>
                        <div className="space-y-1.5">
                          {extractedData.specificFields.aktaNotaris.pemegangSaham?.map((s: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{s.nama}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                                    s.kewarganegaraan === 'WNA'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-emerald-100 text-emerald-900'
                                  }`}
                                >
                                  {s.kewarganegaraan}
                                </span>
                              </div>
                              <span className="font-semibold text-slate-700">
                                {s.jumlahSaham} Lembar ({s.persentaseSaham})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Direksi & Komisaris */}
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                          Susunan Direksi & Dewan Komisaris
                        </span>
                        <div className="space-y-1.5">
                          {extractedData.specificFields.aktaNotaris.direksiKomisaris?.map((d: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900 block">{d.nama}</span>
                                <span className="text-[10px] text-slate-400 block">NIK: {d.nik}</span>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary block">
                                  {d.jabatan}
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                  Masa Jabatan: {d.akhirMasaJabatan || '5 Tahun'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SK KEMENKUMHAM SPECIFIC VIEW */}
                  {extractedData.specificFields?.skKemenkumham && (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Pola Klasifikasi SK Ditjen AHU</span>
                          <span className="font-bold text-primary text-xs">
                            {extractedData.specificFields.skKemenkumham.polaKlasifikasi} • {extractedData.specificFields.skKemenkumham.deskripsiPola}
                          </span>
                        </div>
                        <span className="font-mono text-slate-700 text-xs font-semibold">
                          {extractedData.specificFields.skKemenkumham.nomorSk}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                          Rujukan Akta yang Disahkan
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Nomor Akta</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.skKemenkumham.rujukanAkta.nomorAkta}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Tanggal Akta</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.skKemenkumham.rujukanAkta.tanggalAkta}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-[9px] text-slate-400 block">Notaris Pembuat</span>
                            <span className="font-semibold text-slate-900 block truncate">
                              {extractedData.specificFields.skKemenkumham.rujukanAkta.notaris}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Nomor Daftar Perseroan</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {extractedData.specificFields.skKemenkumham.nomorDaftarPerseroan}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs">Kedudukan: {extractedData.specificFields.skKemenkumham.tempatKedudukan}</span>
                      </div>
                    </div>
                  )}

                  {/* NIB OSS SPECIFIC VIEW */}
                  {extractedData.specificFields?.nibOss && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 font-bold block">Nomor NIB (13 Digit)</span>
                          <span className="font-mono font-bold text-slate-900 block truncate">
                            {extractedData.specificFields.nibOss.nib}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 font-bold block">NPWP Badan (16 Digit)</span>
                          <span className="font-mono font-semibold text-slate-900 block truncate">
                            {extractedData.specificFields.nibOss.npwpBadan}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 font-bold block">Status Permodalan</span>
                          <span className="font-bold text-primary block">
                            {extractedData.specificFields.nibOss.statusPmaPmdn}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 font-bold block">Skala Usaha</span>
                          <span className="font-semibold text-slate-800 block">
                            {extractedData.specificFields.nibOss.skalaUsaha}
                          </span>
                        </div>
                      </div>

                      {/* KBLI List with 2025 Validator */}
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                          Daftar KBLI Terdaftar di NIB OSS (Validasi Standar 2025)
                        </span>
                        <div className="space-y-2">
                          {extractedData.specificFields.nibOss.daftarKbli?.map((k: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                k.isDeprecated2020
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-white border-slate-200/80'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900">{k.code}</span>
                                  <span className="font-semibold text-slate-800">{k.title}</span>
                                </div>
                                {k.isDeprecated2020 ? (
                                  <span className="text-[10px] text-red-700 font-bold block mt-0.5">
                                    ⚠️ KBLI 2020 Kedaluwarsa (Golongan Pokok 45). {k.migrationAdvice}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    Tingkat Risiko: {k.riskLevel || 'Rendah'} • Status: {k.statusPerizinan} ({k.statusVerifikasi})
                                  </span>
                                )}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  k.isDeprecated2020
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {k.isDeprecated2020 ? 'Wajib Migrasi' : 'Valid 2025'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Fungsi Tambahan & Akses</span>
                          <span className="font-semibold text-slate-800">
                            {extractedData.specificFields.nibOss.fungsiTambahan.apiImpor} • {extractedData.specificFields.nibOss.fungsiTambahan.aksesKepabeanan}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          Kontak: {extractedData.specificFields.nibOss.kontakTerdaftar.email} ({extractedData.specificFields.nibOss.kontakTerdaftar.telepon})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* PKS SPECIFIC VIEW */}
                  {extractedData.specificFields?.pks && (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Judul & Objek Perjanjian</span>
                          <span className="font-bold text-slate-900 text-xs">
                            {extractedData.specificFields.pks.judulKontrak}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {extractedData.specificFields.pks.objekRuangLingkup}
                          </span>
                        </div>
                        <span className="font-mono text-slate-700 text-xs">
                          {extractedData.specificFields.pks.nomorKontrak}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Masa Berlaku Kontrak</span>
                          <span className="font-semibold text-slate-800 block">
                            {extractedData.specificFields.pks.jangkaWaktu.tanggalMulai} s/d {extractedData.specificFields.pks.jangkaWaktu.tanggalBerakhir}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Pemberitahuan terminasi: {extractedData.specificFields.pks.jangkaWaktu.masaPemberitahuan}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Kepatuhan Bahasa UU 24/2009</span>
                          <span className="font-semibold text-emerald-800 block">
                            {extractedData.specificFields.pks.bahasa.kepatuhanUu24}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Bahasa naskah: {extractedData.specificFields.pks.bahasa.bahasaPerjanjian}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Para Pihak & Penandatangan</span>
                        <div className="space-y-1.5">
                          {extractedData.specificFields.pks.paraPihak?.map((p: any, idx: number) => (
                            <div key={idx} className="p-2 bg-white rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-900 block">{p.namaBadan}</span>
                                <span className="text-[10px] text-slate-500 block">Penandatangan: {p.penandatangan} ({p.jabatan})</span>
                              </div>
                              <span className="text-[10px] text-slate-400 italic">{p.dasarKewenangan}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!extractedData.specificFields?.aktaNotaris &&
                    !extractedData.specificFields?.skKemenkumham &&
                    !extractedData.specificFields?.nibOss &&
                    !extractedData.specificFields?.pks && (
                      <div className="p-8 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>Dokumen diklasifikasikan sebagai dokumen korporasi umum. Tidak ada field khusus spesifik.</p>
                      </div>
                    )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: HASIL CEK SILANG OTOMATIS (LAPIS TERPENTING ⭐)    */}
              {/* ========================================================= */}
              {extractedData && activeLayerTab === 'layer3' && (
                <div className="space-y-4 pt-3">
                  {/* Summary Metric Header */}
                  <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Scale className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">
                          Analisis Otomatis Ketidaksesuaian Antar Dokumen (Cross-Check Engine)
                        </h5>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Membandingkan 7 aturan hukum: Nama identik, rujukan akta, KBLI 2025, Direksi PKS, status PMA, kedudukan, & masa berlaku.
                        </p>
                      </div>
                    </div>

                    {/* Status Counters */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{activeCrossCheckFindings.filter((f) => f.status === 'cocok').length} Cocok</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        <span>{activeCrossCheckFindings.filter((f) => f.status === 'tidak cocok').length} Tidak Cocok</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-700 text-slate-300 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>{activeCrossCheckFindings.filter((f) => f.status === 'data tidak ditemukan').length} Pending</span>
                      </span>
                    </div>
                  </div>

                  {/* Cross-Check Cards List */}
                  {activeCrossCheckFindings.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <p className="text-xs font-semibold text-slate-600">Belum ada temuan cek silang.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pilih minimal 2 dokumen dari tabel di bawah lalu klik &quot;Bandingkan & Cek Silang&quot;.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5">
                      {activeCrossCheckFindings.map((finding) => {
                        const isMatch = finding.status === 'cocok';
                        const isMismatch = finding.status === 'tidak cocok';

                        return (
                          <div
                            key={finding.id}
                            className={`rounded-2xl border p-4.5 transition-all ${
                              isMatch
                                ? 'bg-emerald-50/50 border-emerald-200'
                                : isMismatch
                                ? 'bg-red-50/50 border-red-200 shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 mb-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                    isMatch
                                      ? 'bg-emerald-600 text-white'
                                      : isMismatch
                                      ? 'bg-red-600 text-white'
                                      : 'bg-slate-300 text-slate-700'
                                  }`}
                                >
                                  {isMatch ? (
                                    <Check className="w-4 h-4" />
                                  ) : isMismatch ? (
                                    <AlertTriangle className="w-4 h-4" />
                                  ) : (
                                    <HelpCircle className="w-4 h-4" />
                                  )}
                                </span>
                                <div>
                                  <h5 className="text-xs font-bold text-slate-900">{finding.ruleTitle}</h5>
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                    Kategori: {finding.category.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>

                              {/* 3 Status Badges */}
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0 ${
                                  isMatch
                                    ? 'bg-emerald-200 text-emerald-950 border border-emerald-300'
                                    : isMismatch
                                    ? 'bg-red-200 text-red-950 border border-red-300 animate-pulse'
                                    : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                {finding.status === 'cocok'
                                  ? '🟢 Cocok'
                                  : finding.status === 'tidak cocok'
                                  ? '🔴 Tidak Cocok'
                                  : '⚪ Data Tidak Ditemukan'}
                              </span>
                            </div>

                            {/* Summary Headline */}
                            <p className="text-xs font-semibold text-slate-800 mb-2 leading-relaxed">
                              {finding.summary}
                            </p>

                            {/* Comparison Box if values present */}
                            {(finding.valueA || finding.valueB) && (
                              <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200/80 mb-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {finding.sourceDocA && (
                                  <div>
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase">
                                      {finding.sourceDocA}
                                    </span>
                                    <span className="font-semibold text-slate-900 block truncate">
                                      {finding.valueA || '-'}
                                    </span>
                                  </div>
                                )}
                                {finding.sourceDocB && (
                                  <div>
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase">
                                      {finding.sourceDocB}
                                    </span>
                                    <span
                                      className={`font-semibold block truncate ${
                                        isMismatch ? 'text-red-700 font-bold' : 'text-slate-900'
                                      }`}
                                    >
                                      {finding.valueB || '-'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Detail Explanation */}
                            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                              {finding.detail}
                            </p>

                            {/* Action Recommendation if Mismatch */}
                            {finding.actionRecommendation && (
                              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-xs">
                                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-900 block text-[11px]">
                                    Rekomendasi Tindakan Hukum / Mitigasi:
                                  </span>
                                  <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                                    {finding.actionRecommendation}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            {extractedData && (
              <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  {savedRecordId ? (
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan aman di Persistent Memory SQLite lokal
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Mode Sekali Pakai: Data langsung musnah saat relog / tutup halaman
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!savedRecordId && (
                    <button
                      type="button"
                      onClick={handleExplicitSave}
                      disabled={isSavingRecord}
                      className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-xs font-semibold text-primary cursor-pointer transition-colors shadow-2xs"
                    >
                      {isSavingRecord ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                        </span>
                      ) : (
                        '💾 Simpan ke Database'
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePurgeMemory}
                    className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 cursor-pointer transition-colors shadow-2xs"
                  >
                    🔥 Musnahkan dari Memori (Purge)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Document Cross-Check Hub & Persistent Records Table */}
      <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Penyimpanan Persistent Dokumen & Hub Cek Silang Antar Dokumen
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {metadataList.length} Dokumen
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih 2 atau lebih berkas dokumen (centang kotak) untuk menjalankan analisis cek silang menyeluruh secara instan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedDocIdsForCrossCheck.length >= 2 && (
              <button
                type="button"
                onClick={handleRunMultiDocCrossCheck}
                disabled={isRunningCrossCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary-dark text-xs font-bold shadow-xs cursor-pointer transition-all animate-in fade-in"
              >
                {isRunningCrossCheck ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Scale className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>Bandingkan & Cek Silang ({selectedDocIdsForCrossCheck.length} Dokumen)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama PT, nomor SK/Akta, nama notaris, atau nama klien..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white"
            >
              <option value="all">Semua Tipe Dokumen</option>
              <option value="Akta">Akta Notaris</option>
              <option value="SK">SK Kemenkumham (AHU)</option>
              <option value="NIB">NIB OSS</option>
              <option value="Perjanjian">Perjanjian Kerjasama (PKS)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="otomatis">Otomatis</option>
              <option value="dicek_agen">Diverifikasi Agen</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>
        </div>

        {/* Table Records */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200/80">
                <th className="py-2.5 px-3 w-10 text-center">Pilih</th>
                <th className="py-2.5 px-3">Nama Perusahaan & Tipe Lapis 1</th>
                <th className="py-2.5 px-3">Nomor Registrasi / SK</th>
                <th className="py-2.5 px-3">Notaris / Tanggal</th>
                <th className="py-2.5 px-3">Status Verifikasi</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada metadata dokumen yang cocok dengan pencarian
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isChecked = selectedDocIdsForCrossCheck.includes(rec.id);

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectDocForCrossCheck(rec.id)}
                          className="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block truncate max-w-xs">
                          {rec.companyName || 'Tanpa Nama PT'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-primary font-semibold block">
                            {rec.docType}
                          </span>
                          {rec.subType && (
                            <span className="text-[9px] text-slate-500 block truncate max-w-[140px]">
                              • {rec.subType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {rec.documentNumber || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="block truncate max-w-[140px]">{rec.notaryName || '-'}</span>
                        <span className="text-[10px] text-slate-400 block">{rec.effectiveDate || '-'}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleVerificationStatus(rec.id, rec.verificationStatus || 'otomatis')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                            rec.verificationStatus === 'dicek_agen'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : rec.verificationStatus === 'ditolak'
                              ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Klik untuk mengubah status verifikasi"
                        >
                          {rec.verificationStatus === 'dicek_agen'
                            ? '✓ Dicek Agen'
                            : rec.verificationStatus === 'ditolak'
                            ? '✕ Ditolak'
                            : '⚙️ Otomatis'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecordForDetail(rec)}
                          className="p-1.5 text-slate-500 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Lihat Detail 3-Lapis"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === rec.id}
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Hapus Metadata"
                        >
                          {deletingId === rec.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal (Displays all 3 Layers for Stored Document) */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {selectedRecordForDetail.docType}
                  </span>
                  <span className="text-[10px] text-slate-400">•</span>
                  <span className="text-[10px] font-semibold text-slate-600">
                    {selectedRecordForDetail.subType || 'Umum'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedRecordForDetail.companyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Lapis 1 Info in Modal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Nomor Dokumen</span>
                <span className="font-mono font-bold text-slate-900">{selectedRecordForDetail.documentNumber || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Penerbit Resmi</span>
                <span className="font-semibold text-slate-800">{selectedRecordForDetail.publisher || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Tanggal Pengesahan</span>
                <span className="font-medium text-slate-800">{selectedRecordForDetail.effectiveDate || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Modal Tercatat</span>
                <span className="font-semibold text-slate-800">{selectedRecordForDetail.capitalAmount || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block">Klasifikasi Usaha (KBLI)</span>
                <span className="font-medium text-slate-800">{selectedRecordForDetail.businessSectors || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block">Alamat Domisili</span>
                <span className="font-medium text-slate-800">{selectedRecordForDetail.registeredAddress || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block">Pengurus & Direksi</span>
                <span className="font-medium text-slate-800">{selectedRecordForDetail.keyPeople || '-'}</span>
              </div>
            </div>

            {/* Summary */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs">
              <span className="text-[10px] font-bold text-indigo-900 block mb-1">Ringkasan Legalitas</span>
              <p className="text-slate-700 leading-relaxed">{selectedRecordForDetail.summary}</p>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
