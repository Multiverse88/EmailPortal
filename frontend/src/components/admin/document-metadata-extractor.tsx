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
} from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';

interface CustomerOption {
  id: string;
  name: string;
  mailboxAddress: string;
}

interface StoredMetadata {
  id: string;
  documentId?: string | null;
  customerId?: string | null;
  docType: string;
  companyName?: string | null;
  documentNumber?: string | null;
  notaryName?: string | null;
  effectiveDate?: string | null;
  capitalAmount?: string | null;
  businessSectors?: string | null;
  registeredAddress?: string | null;
  keyPeople?: string | null;
  summary?: string | null;
  confidenceScore: number;
  verifiedBy?: string | null;
  createdAt: string;
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
  const [showRawText, setShowRawText] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter & Search states for persistent records
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDocType, setFilterDocType] = useState('all');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<StoredMetadata | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all persisted document metadata
  const { data, mutate, isLoading } = useSWR<{ metadata: StoredMetadata[]; total: number }>(
    '/admin/documents/metadata',
    fetcher,
    { refreshInterval: 20000 }
  );

  const metadataList = data?.metadata || [];

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
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
    }
  };

  const handleExtract = async () => {
    if (!file) {
      onNotify('Silakan pilih berkas PDF terlebih dahulu');
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedCustomerId) {
        formData.append('customerId', selectedCustomerId);
      }

      const res = await api.post('/admin/documents/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setExtractedData(res.data.extraction);
        setSavedRecordId(res.data.data?.id || null);
        onNotify('Metadata berhasil diekstrak dan disimpan ke Persistent Memory!');
        mutate();
      }
    } catch (err: any) {
      console.error('Extraction failed:', err);
      onNotify(errMsg(err, 'Gagal mengekstrak metadata dokumen'));
    } finally {
      setIsExtracting(false);
    }
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
      mutate();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal menghapus metadata'));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRecords = metadataList.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.notaryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterDocType === 'all' || m.docType.toLowerCase().includes(filterDocType.toLowerCase());

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Zero Data Leakage Privacy Shield Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-950">
                  Zero Data Leakage & Persistent Memory Guarantee
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 100% On-Premise
                </span>
              </div>
              <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                Pemrosesan berkas PDF dilakukan sepenuhnya di memori server Node.js lokal menggunakan mesin parser internal.
                <strong> Tidak ada data teks, dokumen, atau informasi rahasia yang dikirim ke API luar atau model publik.</strong> Seluruh
                hasil ekstraksi disimpan aman di database Persistent Memory lokal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>SQLite Persistent Storage</span>
          </div>
        </div>
      </div>

      {/* Main Extraction Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Trigger Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Unggah & Ekstraksi Dokumen Legal</span>
              </h4>
              <span className="text-[11px] text-slate-500">PDF Akta / SK / NIB</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Pilih dokumen legal klien (Akta Notaris, SK Kemenkumham AHU, NIB OSS, atau Perjanjian Kerjasama) untuk dianalisis secara otomatis.
            </p>

            {/* Dropzone Area */}
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
                    {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti
                  </span>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-semibold text-slate-800">
                    Pilih Berkas PDF Dokumen Legal
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1">
                    Mendukung Akta Notaris, SK Kemenkumham, NIB OSS, NPWP (Maks 25 MB)
                  </span>
                </div>
              )}
            </div>

            {/* Customer Association */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hubungkan dengan Akun Klien (Opsional):
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">-- Tanpa Hubungan Akun (Stand-alone Legal File) --</option>
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mailboxAddress})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
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
                    <span>Mengekstrak Metadata Lokal (In-Memory)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Mulai Ekstraksi AI & Simpan ke Persistent Memory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Extraction Results Card */}
        <div className="lg:col-span-7">
          <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs min-h-[380px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Hasil Ekstraksi Dokumen Legal (Persistent Memory)</span>
                </h4>
                {extractedData && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Keyakinan: {(extractedData.confidenceScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {!extractedData && !isExtracting && (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Belum ada dokumen yang diekstrak</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Pilih berkas PDF di panel kiri, lalu klik &quot;Mulai Ekstraksi AI&quot; untuk menampilkan metadata terstruktur secara instan.
                  </p>
                </div>
              )}

              {isExtracting && (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-800">Sedang membaca teks PDF secara lokal...</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Memproses pola hukum Indonesia: Akta Notaris, SK AHU Kemenkumham, NIB OSS, dan Modal Dasar.
                  </p>
                </div>
              )}

              {extractedData && (
                <div className="space-y-4">
                  {/* Document Type Badge */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Tipe Dokumen Terdeteksi
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {extractedData.docType}
                      </span>
                    </div>
                    <span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary">
                      Tersimpan di SQLite
                    </span>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" /> Nama Perseroan / Perusahaan
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.companyName, 'comp')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'comp' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 block truncate">
                        {extractedData.companyName || '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" /> Nomor Registrasi / SK / Akta
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.documentNumber, 'docNo')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'docNo' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 block truncate">
                        {extractedData.documentNumber || '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-slate-400" /> Notaris Pembuat
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.notaryName, 'notary')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'notary' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-medium text-slate-900 block truncate">
                        {extractedData.notaryName || 'Tidak tertera'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Tanggal Pengesahan / Efektif
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.effectiveDate, 'date')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'date' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-medium text-slate-900 block truncate">
                        {extractedData.effectiveDate || '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-slate-400" /> Modal Dasar / Modal Disetor
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.capitalAmount, 'capital')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'capital' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-semibold text-slate-900 block truncate">
                        {extractedData.capitalAmount || 'Tidak tertera dalam ringkasan'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> Alamat Kedudukan / Domisili
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.registeredAddress, 'addr')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'addr' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-medium text-slate-800 block truncate">
                        {extractedData.registeredAddress || 'Indonesia'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" /> Pengurus / Direksi & Para Pihak
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(extractedData.keyPeople, 'people')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedKey === 'people' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="font-medium text-slate-800 block truncate">
                        {extractedData.keyPeople || 'Tercatat dalam lampiran dokumen'}
                      </span>
                    </div>
                  </div>

                  {/* Legal Summary */}
                  <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs">
                    <span className="text-[10px] font-bold text-indigo-900 block mb-1">
                      Ringkasan Pokok Hukum Dokumen
                    </span>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {extractedData.summary}
                    </p>
                  </div>

                  {/* Raw Text Accordion Toggle */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-primary font-semibold cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{showRawText ? 'Sembunyikan' : 'Lihat'} Teks Asli yang Diproses (In-Memory)</span>
                    </button>
                    {showRawText && (
                      <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {extractedData.rawExtractedText}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {extractedData && (
              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan aman di persistent memory lokal
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setExtractedData(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Ekstraksi Berkas Baru
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Memory Database Table */}
      <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Daftar Metadata Dokumen Tersimpan (Persistent Memory)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh metadata dokumen yang telah diekstrak dan disimpan secara persisten di database SQLite internal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
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
              className="text-xs rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white w-full sm:w-auto"
            >
              <option value="all">Semua Tipe Dokumen</option>
              <option value="Akta">Akta Pendirian / Perubahan</option>
              <option value="SK">SK Kemenkumham (AHU)</option>
              <option value="NIB">NIB (Nomor Induk Berusaha)</option>
              <option value="NPWP">NPWP Badan Usaha</option>
              <option value="Perjanjian">Perjanjian Kerjasama (PKS)</option>
            </select>
          </div>
        </div>

        {/* Table Records */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200/80">
                <th className="py-2.5 px-3">Nama Perusahaan & Tipe</th>
                <th className="py-2.5 px-3">Nomor Registrasi / SK</th>
                <th className="py-2.5 px-3">Notaris / Tanggal</th>
                <th className="py-2.5 px-3">Akun Klien Terhubung</th>
                <th className="py-2.5 px-3">Keyakinan AI</th>
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
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block truncate max-w-xs">
                        {rec.companyName || 'Tanpa Nama PT'}
                      </span>
                      <span className="text-[10px] text-primary font-semibold block mt-0.5">
                        {rec.docType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {rec.documentNumber || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="block truncate max-w-[140px]">{rec.notaryName || '-'}</span>
                      <span className="text-[10px] text-slate-400 block">{rec.effectiveDate || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {rec.customer ? (
                        <div>
                          <span className="font-semibold text-slate-800 block truncate max-w-[120px]">
                            {rec.customer.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[120px]">
                            {rec.customer.mailboxAddress}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Stand-alone</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        {(rec.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => setSelectedRecordForDetail(rec)}
                        className="p-1.5 text-slate-500 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors"
                        title="Lihat Detail Lengkap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === rec.id}
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {selectedRecordForDetail.docType}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedRecordForDetail.companyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Nomor Dokumen</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecordForDetail.documentNumber || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">Notaris</span>
                <span className="font-medium text-slate-800">{selectedRecordForDetail.notaryName || '-'}</span>
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

            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs">
              <span className="text-[10px] font-bold text-indigo-900 block mb-1">Ringkasan Legalitas</span>
              <p className="text-slate-700 leading-relaxed">{selectedRecordForDetail.summary}</p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
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
