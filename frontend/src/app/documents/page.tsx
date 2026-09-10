'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Folder,
  FileText,
  Upload,
  Search,
  Star,
  Clock,
  Users,
  Trash2,
  Grid,
  List as ListIcon,
  Filter,
  Plus,
  Loader2,
  MoreVertical,
  ExternalLink,
  Download,
  FileSpreadsheet,
  FileCode,
  File,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Shield,
  Menu,
  Headphones,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { useCustomerAuth } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { SuiteHeader } from '@/components/suite-header';
import { DocumentPreviewModal, LegalDocument } from '@/components/document-preview-modal';
import { SupportTicketModal } from '@/components/support-ticket-modal';

export default function DocumentsPage() {
  return (
    <AuthGuard type="customer">
      <Suspense fallback={<div className="min-h-[100dvh] bg-background flex items-center justify-center text-slate-400">Memuat Drive...</div>}>
        <DocumentsContent />
      </Suspense>
    </AuthGuard>
  );
}

function DocumentsContent() {
  const { user, logout } = useCustomerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [folders, setFolders] = useState<string[]>([
    'Client Agreements',
    'Tax Filings',
    'NDA Templates',
  ]);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [storageLimit, setStorageLimit] = useState<number>(5368709120); // 5 GB
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'my-files' | 'recent' | 'starred' | 'shared' | 'trash'>('my-files');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Client Agreements');
  const [uploadStatus, setUploadStatus] = useState('Reviewed');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Initial ID query param
  useEffect(() => {
    const docId = searchParams.get('id');
    if (docId) setPreviewDocId(docId);
  }, [searchParams]);

  // Load documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (selectedFolder) params.folder = selectedFolder;
      if (activeTab === 'starred') params.isStarred = true;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      if (res.data.folders?.length) setFolders(res.data.folders);
      if (res.data.storageUsed !== undefined) setStorageUsed(res.data.storageUsed);
      if (res.data.storageLimit !== undefined) setStorageLimit(res.data.storageLimit);
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat dokumen'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedFolder, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const toggleStar = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      const res = await api.patch(`/documents/${docId}/star`);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, isStarred: res.data.isStarred } : d))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return setUploadError('Pilih berkas untuk diunggah');
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle.trim() || uploadFile.name);
    formData.append('category', uploadCategory);
    formData.append('status', uploadStatus);

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments((prev) => [res.data.document, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
    } catch (err) {
      setUploadError(errMsg(err, 'Gagal mengunggah berkas'));
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="w-8 h-8 text-red-600" />;
    if (mime.includes('spreadsheet') || mime.includes('excel'))
      return <FileSpreadsheet className="w-8 h-8 text-emerald-600" />;
    if (mime.includes('image')) return <FileCode className="w-8 h-8 text-indigo-600" />;
    return <File className="w-8 h-8 text-slate-500" />;
  };

  const isFull = storageUsed >= storageLimit;
  const rawStoragePercent = (storageLimit || 5368709120) > 0
    ? (storageUsed / (storageLimit || 5368709120)) * 100
    : 0;
  const storagePercent = Math.min(100, rawStoragePercent);

  const formatPercent = (used: number, limit: number): string => {
    if (!used || used <= 0) return '0%';
    const p = (used / (limit || 5368709120)) * 100;
    if (p < 0.01) return '< 0.01%';
    if (p < 0.1) return `${p.toFixed(2)}%`;
    if (p % 1 !== 0) return `${p.toFixed(1)}%`;
    return `${p}%`;
  };

  return (
    <div className="app-shell h-[100dvh]">
      <SuiteHeader
        currentApp="documents"
        product="Drive"
        description="Dokumen, arsip, dan persetujuan hukum"
        userName={user?.name}
        userEmail={user?.email}
        avatarUrl={user?.avatarUrl}
        onMenu={() => setMobileSidebar((open) => !open)}
        onLogout={() => {
          logout();
          router.replace('/login');
        }}
        search={
          <form onSubmit={handleSearch} className="mx-auto max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul, kategori, atau nama berkas"
                className="h-10 w-full rounded-xl border border-transparent bg-[#efedec] pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 hover:bg-[#e9e6e5] focus:border-primary/25 focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </form>
        }
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {mobileSidebar && (
          <button
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setMobileSidebar(false)}
            className="fixed inset-0 top-[68px] z-20 bg-slate-950/35 md:hidden"
          />
        )}

        {/* Left Sidebar (256px) */}
        <aside
          className={`fixed bottom-0 left-0 top-[68px] z-30 flex w-64 flex-col workspace-sidebar transition-transform duration-200 md:static ${
            mobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* CTA Upload Button */}
          <div className="p-4">
            <button
              onClick={() => {
                if (isFull) {
                  setTicketModalOpen(true);
                } else {
                  setUploadOpen(true);
                }
              }}
              className={`app-primary-button w-full !min-h-11 ${
                isFull ? '!bg-red-600 hover:!bg-red-700' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isFull ? 'Kuota Penuh (Ajukan Tiket)' : 'Unggah Dokumen'}</span>
            </button>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1">
            <button
              onClick={() => {
                setActiveTab('my-files');
                setSelectedFolder(null);
                setMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-xs font-semibold transition-colors ${
                activeTab === 'my-files' && !selectedFolder
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Berkas Saya</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('recent');
                setSelectedFolder(null);
                setMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-xs font-semibold transition-colors ${
                activeTab === 'recent'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Terbaru</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('starred');
                setSelectedFolder(null);
                setMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-xs font-semibold transition-colors ${
                activeTab === 'starred'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>Berbintang</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('shared');
                setSelectedFolder(null);
                setMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-xs font-semibold transition-colors ${
                activeTab === 'shared'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Dibagikan ke Saya</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('trash');
                setSelectedFolder(null);
                setMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-xs font-semibold transition-colors ${
                activeTab === 'trash'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Sampah</span>
            </button>

            <div className="pt-4 pb-2 px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kategori Dokumen
              </span>
            </div>

            {folders.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setSelectedFolder(f);
                  setMobileSidebar(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-r-full text-xs transition-colors ${
                  selectedFolder === f
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              </button>
            ))}

            {/* Cross-App Navigation Shortcuts */}
            <div className="pt-6 pb-2 px-3 border-t border-slate-100 mt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Aplikasi EasyLegal
              </span>
            </div>
            <button
              onClick={() => router.push('/inbox')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>EasyLegal Mail</span>
            </button>
            <button
              onClick={() => router.push('/support')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Bantuan & Tiket</span>
            </button>
          </nav>

          {/* Storage Indicator */}
          <div className="p-4 border-t border-slate-100 mt-auto bg-slate-50/70">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Mailbox Drive (5 GB)</span>
              </span>
              <span className="font-mono text-[11px] font-bold">
                {formatSize(storageUsed)} / {formatSize(storageLimit)}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFull ? 'bg-red-600' : storagePercent > 80 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{
                  width: `${storageUsed > 0 ? Math.min(100, Math.max(2, storagePercent)) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <span className="text-slate-400 font-medium">
                {formatPercent(storageUsed, storageLimit)} terpakai
              </span>
              <button
                type="button"
                onClick={() => setTicketModalOpen(true)}
                className="font-semibold text-primary hover:underline"
              >
                + Tambah Kuota
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="page-canvas flex flex-1 flex-col overflow-hidden">
          {/* Content Sub-Header & Controls */}
          <div className="workspace-toolbar">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setSelectedFolder(null);
                  setActiveTab('my-files');
                }}
                className="text-slate-500 hover:text-slate-800 font-medium"
              >
                Berkas Saya
              </button>
              {selectedFolder && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-900">{selectedFolder}</span>
                </>
              )}
              {activeTab === 'starred' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-900">Berbintang</span>
                </>
              )}
            </div>

            {/* View Mode & Filter Toggles */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-xs text-primary font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Kisi"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white shadow-xs text-primary font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Tabel"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedFolder && (
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="text-xs text-primary font-semibold hover:underline ml-2"
                >
                  Tampilkan Semua
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Document Content */}
          <div className="flex-1 space-y-7 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {/* Storage Limit Warning Banner */}
            {isFull && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900 shadow-2xs">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-950">Kapasitas Mailbox Drive 5 GB Penuh</h4>
                    <p className="text-red-700 mt-0.5">
                      Anda telah mencapai batas kuota penyimpanan 5 GB. Unggah berkas baru dinonaktifkan sementara sampai kuota ditingkatkan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(true)}
                  className="self-start sm:self-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <Headphones className="size-3.5" />
                  <span>Ajukan Tiket Tambah Kuota</span>
                </button>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span>{error}</span>
                <button type="button" onClick={fetchDocuments} className="font-semibold hover:underline">Coba lagi</button>
              </div>
            )}
            {/* Folder Section (if not in single folder mode) */}
            {!selectedFolder && activeTab === 'my-files' && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Folder Dokumen
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {folders.map((f) => {
                    const count = documents.filter((d) => d.category === f).length;
                    return (
                      <div
                        key={f}
                        onClick={() => setSelectedFolder(f)}
                        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-border-subtle bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-panel"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Folder className="w-5 h-5 fill-primary/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-primary transition-colors">
                            {f}
                          </h4>
                          <span className="text-[11px] text-slate-400">{count} berkas hukum</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Files Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {selectedFolder ? `Berkas di ${selectedFolder}` : 'Semua Berkas'}
                </h3>
                <span className="text-xs text-slate-400">{documents.length} berkas</span>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <p className="text-xs">Memuat berkas...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">Belum ada dokumen di sini</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Klik tombol "Unggah Dokumen" di atas untuk menambahkan berkas baru.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                /* Bento Grid Cards */
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setPreviewDocId(doc.id)}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-panel"
                    >
                      {/* Thumbnail Container */}
                      <div className="relative flex h-36 items-center justify-center overflow-hidden border-b border-border-subtle bg-[#f2efee] transition-colors group-hover:bg-[#ece8e7]">
                        {getFileIcon(doc.mimeType)}

                        {/* Hover Star Button */}
                        <button
                          onClick={(e) => toggleStar(e, doc.id)}
                          className={`absolute top-2 right-2 p-1 rounded-full bg-white/90 shadow-xs transition-colors ${
                            doc.isStarred
                              ? 'text-amber-500'
                              : 'text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                          }`}
                          title="Tandai Bintang"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${doc.isStarred ? 'fill-amber-500' : ''}`}
                          />
                        </button>

                        {/* File Format Badge */}
                        <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded shadow-xs uppercase text-slate-600">
                          {doc.filename.split('.').pop() || 'PDF'}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h4
                            className="text-xs font-bold text-slate-800 truncate group-hover:text-primary transition-colors"
                            title={doc.title}
                          >
                            {doc.title}
                          </h4>
                          <span className="inline-block text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.2 rounded mt-1">
                            {doc.status}
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{formatSize(doc.size)}</span>
                          <span>{formatDate(doc.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View Table */
                <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Nama Dokumen</th>
                        <th className="py-2.5 px-4">Kategori</th>
                        <th className="py-2.5 px-4">Ukuran</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Tanggal</th>
                        <th className="py-2.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documents.map((doc) => (
                        <tr
                          key={doc.id}
                          onClick={() => setPreviewDocId(doc.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-4 h-4 shrink-0">{getFileIcon(doc.mimeType)}</div>
                              <span className="font-semibold text-slate-800 group-hover:text-primary truncate max-w-xs">
                                {doc.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{doc.category}</td>
                          <td className="py-2.5 px-4 text-slate-500 font-mono">{formatSize(doc.size)}</td>
                          <td className="py-2.5 px-4">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{formatDate(doc.createdAt)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={(e) => toggleStar(e, doc.id)}
                              className="p-1 text-slate-400 hover:text-amber-500"
                            >
                              <Star
                                className={`w-4 h-4 ${doc.isStarred ? 'text-amber-500 fill-amber-500' : ''}`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Upload File Modal */}
      {uploadOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUploadOpen(false);
          }}
        >
          <div className="modal-panel max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Unggah Dokumen Hukum Baru</h3>
              <button
                onClick={() => setUploadOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Berkas</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !uploadTitle) setUploadTitle(f.name);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Judul Dokumen</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Mis. Perjanjian Layanan Utama 2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kategori Folder</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Client Agreements">Client Agreements</option>
                  <option value="Tax Filings">Tax Filings</option>
                  <option value="NDA Templates">NDA Templates</option>
                  <option value="Corporate Governance">Corporate Governance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status Dokumen</label>
                <select
                  value={uploadStatus}
                  onChange={(e) => setUploadStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Urgent Review">Urgent Review</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Approved">Approved</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <span>Unggah Sekarang</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocId && (
        <DocumentPreviewModal
          documentId={previewDocId}
          onClose={() => setPreviewDocId(null)}
          onDeleted={(delId) => {
            setDocuments((prev) => prev.filter((d) => d.id !== delId));
            setPreviewDocId(null);
          }}
        />
      )}

      {/* Quick Support Ticket Modal */}
      <SupportTicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        initialCategory="Penyimpanan & Kuota"
        initialSubject="Permohonan Penambahan Kuota Mailbox Drive (5 GB Penuh)"
      />
    </div>
  );
}
