'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Shield,
  FileSpreadsheet,
  FileCode,
  File,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';

export interface DocumentVersion {
  id: string;
  versionNumber: string;
  authorName: string;
  approved: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface LegalDocument {
  id: string;
  title: string;
  category: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  status: string;
  isStarred: boolean;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersion[];
}

interface DocumentPreviewModalProps {
  documentId: string;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (doc: LegalDocument) => void;
}

export function DocumentPreviewModal({
  documentId,
  onClose,
  onDeleted,
  onUpdated,
}: DocumentPreviewModalProps) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchDoc = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/documents/${documentId}`);
        if (mounted) {
          setDoc(res.data.document);
          setVersions(res.data.versions || []);
        }
      } catch (err) {
        if (mounted) setError(errMsg(err, 'Gagal memuat dokumen'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDoc();
    return () => {
      mounted = false;
    };
  }, [documentId]);

  const handleDownload = () => {
    if (!doc) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`;
    window.open(downloadUrl, '_blank');
  };

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}/documents?id=${documentId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirm(`Hapus dokumen "${doc.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/documents/${doc.id}`);
      onDeleted?.(doc.id);
      onClose();
    } catch (err) {
      alert(errMsg(err, 'Gagal menghapus dokumen'));
      setDeleting(false);
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
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-red-600" />;
    if (mime.includes('spreadsheet') || mime.includes('excel'))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (mime.includes('image')) return <FileCode className="w-5 h-5 text-indigo-600" />;
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const downloadUrl = doc
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`
    : '';

  return (
    <div
      className="modal-backdrop overflow-hidden !p-2 sm:!p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-background">
        {/* Modal Top Bar */}
        <header className="workspace-toolbar">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Berkas</span>
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            <h2 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
              {doc?.title || 'Memuat Dokumen...'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="app-secondary-button !min-h-9 !px-3 !text-xs"
              title="Salin tautan dokumen"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Bagikan'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="app-primary-button !min-h-9 !px-3 !text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Berkas</span>
            </button>

            <button
              onClick={onClose}
              className="app-icon-button !size-8"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Modal Body: Split Canvas & Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Document Viewer Canvas */}
          <main className="flex-1 bg-[#edeeef]/60 p-4 sm:p-6 overflow-y-auto flex justify-center items-start">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-xs font-medium">Memuat pratinjau dokumen...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-red-500">
                <p className="text-sm font-semibold">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-3 px-4 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700"
                >
                  Tutup
                </button>
              </div>
            ) : doc ? (
              <div className="w-full max-w-[820px] bg-white shadow-md border border-slate-200/90 rounded-xl min-h-[900px] p-6 sm:p-10 relative flex flex-col">
                {/* Document Simulated Sheet Header */}
                <div className="border-b-2 border-primary pb-4 mb-6 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                      {doc.category}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                      {doc.title}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">EasyLegal Services & Partners</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      CONFIDENTIAL
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Berlaku: {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>

                {/* PDF / Document Embed or Simulated Content */}
                {doc.mimeType.includes('pdf') ? (
                  <div className="flex-1 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50 min-h-[600px] relative">
                    <iframe
                      src={`${downloadUrl}#toolbar=0`}
                      className="w-full h-full min-h-[600px] border-none"
                      title={doc.title}
                    />
                  </div>
                ) : doc.mimeType.includes('image') ? (
                  <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <img
                      src={downloadUrl}
                      alt={doc.title}
                      className="max-h-[650px] w-auto object-contain rounded shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 text-xs text-slate-600 leading-relaxed pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <h3 className="font-bold text-slate-900 text-sm mb-1.5">
                        Ringkasan Perjanjian Hukum
                      </h3>
                      <p>
                        Dokumen ini dibuat dan disahkan sesuai dengan ketentuan perundang-undangan Republik Indonesia. Para pihak menyatakan setuju untuk melaksanakan seluruh klausul kerahasiaan dan kepatuhan hukum yang tercantum di dalam berkas resmi ini.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="h-3.5 bg-slate-100 rounded w-full" />
                      <div className="h-3.5 bg-slate-100 rounded w-11/12" />
                      <div className="h-3.5 bg-slate-100 rounded w-4/5" />
                    </div>

                    <div className="pt-4">
                      <h4 className="font-bold text-slate-800 text-xs mb-1">
                        Pasal 1: Hak dan Kewajiban
                      </h4>
                      <p>
                        Setiap pihak wajib menjaga kerahasiaan data perusahaan, sertifikat legalitas, dan informasi operasional yang disampaikan dalam kerjasama ini. Pelanggaran terhadap klausul ini tunduk pada penyelesaian sengketa di Badan Arbitrase Nasional Indonesia.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="h-3.5 bg-slate-100 rounded w-full" />
                      <div className="h-3.5 bg-slate-100 rounded w-5/6" />
                    </div>
                  </div>
                )}

                {/* Page Indicator Footer */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Dokumen Terdaftar Resmi EasyLegal Hub</span>
                  <span className="font-mono">Halaman 1 dari 1</span>
                </div>
              </div>
            ) : null}
          </main>

          {/* Right Sidebar: Details & Version History */}
          <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/90 flex flex-col overflow-y-auto shrink-0 p-5 space-y-6">
            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={handleDownload}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Berkas Asli</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShare}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200/70 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200/70 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* File Metadata Details */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Detail Berkas
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <dt className="text-slate-400">Tipe Berkas</dt>
                  <dd className="text-slate-800 font-medium flex items-center gap-1.5">
                    {doc ? getFileIcon(doc.mimeType) : null}
                    <span className="uppercase font-mono text-[11px]">
                      {doc?.filename.split('.').pop() || 'FILE'}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-400">Ukuran</dt>
                  <dd className="text-slate-800 font-medium">{doc ? formatSize(doc.size) : '-'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-400">Kategori Folder</dt>
                  <dd className="text-slate-800 font-medium">{doc?.category || '-'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-400">Status Dokumen</dt>
                  <dd>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {doc?.status || 'Active'}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-400">Pemilik / Pengunggah</dt>
                  <dd className="text-slate-800 font-medium flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold">
                      {doc?.ownerName?.slice(0, 1) || 'L'}
                    </div>
                    <span>{doc?.ownerName || 'Legal Team'}</span>
                  </dd>
                </div>
              </dl>
            </section>

            <hr className="border-slate-100" />

            {/* Version History Timeline */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Riwayat Versi
                </h3>
                <span className="text-[11px] text-slate-400">{versions.length} versi</span>
              </div>

              <div className="space-y-3 pt-1">
                {versions.map((ver, idx) => (
                  <div key={ver.id} className="flex items-start gap-3 relative group">
                    {/* Timeline line */}
                    {idx < versions.length - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-[-12px] w-0.5 bg-slate-200" />
                    )}
                    {/* Timeline Dot */}
                    <div
                      className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border-2 ${
                        idx === 0
                          ? 'bg-primary border-primary ring-2 ring-primary/20'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-slate-800">
                          {ver.versionNumber} {idx === 0 ? '(Saat Ini)' : ''}
                        </p>
                        {ver.approved && (
                          <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                            Disetujui
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(ver.createdAt)} oleh {ver.authorName}
                      </p>
                      {ver.notes && (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic truncate">
                          "{ver.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Danger Zone: Delete Button */}
            <div className="pt-2 mt-auto">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-2 px-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus Dokumen</span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
