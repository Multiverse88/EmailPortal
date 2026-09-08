'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HelpCircle,
  Headphones,
  Search,
  Plus,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MessageSquare,
  ArrowRight,
  Shield,
  Loader2,
  X,
  Send,
  Folder,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { AppLauncher } from '@/components/app-launcher';
import { TicketThreadModal, SupportTicket } from '@/components/ticket-thread-modal';

export default function SupportPage() {
  return (
    <AuthGuard type="customer">
      <Suspense fallback={<div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-slate-400">Memuat Pusat Bantuan...</div>}>
        <SupportContent />
      </Suspense>
    </AuthGuard>
  );
}

function SupportContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Document Review');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [initialMessage, setInitialMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Initial ID query param
  useEffect(() => {
    const ticketId = searchParams.get('id');
    if (ticketId) setSelectedTicketId(ticketId);
  }, [searchParams]);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/support/tickets');
      setTickets(res.data.tickets || []);
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat tiket bantuan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) {
      return setSubmitError('Subjek dan deskripsi pesan wajib diisi');
    }
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.post('/support/tickets', {
        subject: subject.trim(),
        category,
        priority,
        message: initialMessage.trim(),
      });
      setTickets((prev) => [res.data.ticket, ...prev]);
      setNewTicketOpen(false);
      setSubject('');
      setInitialMessage('');
      setSelectedTicketId(res.data.ticket.id);
    } catch (err) {
      setSubmitError(errMsg(err, 'Gagal membuat tiket bantuan'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === 'open' && t.status !== 'open') return false;
    if (activeFilter === 'resolved' && t.status !== 'resolved' && t.status !== 'closed')
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-slate-900">
      {/* Global Header */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push('/support')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight">EasyLegal</span>
              <span className="text-xs font-semibold text-primary ml-1">Support</span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block" />

          {/* Quick Cross-App Nav Links */}
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              onClick={() => router.push('/inbox')}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              Mailbox
            </button>
            <button
              onClick={() => router.push('/documents')}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              Legal Drive
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              Pengaturan
            </button>
          </div>
        </div>

        {/* Trailing Area */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* 9-dots App Launcher */}
          <AppLauncher currentApp="support" />

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* User Profile */}
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-slate-100 transition-colors"
            title="Pengaturan Akun"
          >
            <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              {user?.name?.slice(0, 1) || 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-700 hidden lg:inline max-w-[120px] truncate">
              {user?.name || 'Customer'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner 24/7 Live Support */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pusat Bantuan & Layanan Pelanggan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tim hukum dan teknisi kami siap membantu pertanyaan mailbox dan dokumen Anda 24/7.
              </p>
            </div>
          </div>

          <button
            onClick={() => setNewTicketOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-container text-white rounded-full text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-primary/20 transition-all shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Tiket Bantuan</span>
          </button>
        </section>

        {/* 2-Column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Left: Tickets List (2 Columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Tiket Bantuan Anda
                </h3>
                <span className="text-xs font-mono bg-slate-200/80 px-2 py-0.5 rounded-full font-semibold text-slate-700">
                  {tickets.length}
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-0.5 rounded-xl border border-slate-200 bg-white text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setActiveFilter('open')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    activeFilter === 'open'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Terbuka
                </button>
                <button
                  onClick={() => setActiveFilter('resolved')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    activeFilter === 'resolved'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Ticket Cards List */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden divide-y divide-slate-100">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <p className="text-xs">Memuat daftar tiket...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-14 text-center p-6">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Belum ada tiket pada kategori ini</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Klik tombol "Buat Tiket Bantuan" untuk mengajukan pertanyaan baru.
                  </p>
                </div>
              ) : (
                filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start gap-3.5 group relative"
                  >
                    {/* Left Color Indicator Bar */}
                    <div
                      className={`w-1 self-stretch rounded-full shrink-0 ${
                        t.status === 'open' ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                          {t.subject}
                        </span>

                        {t.priority === 'urgent' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 uppercase">
                            Urgent
                          </span>
                        )}

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            t.status === 'open'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {t.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1">
                        Kategori: {t.category} • Diperbarui: {formatDate(t.updatedAt)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 text-[11px] font-mono text-slate-400">
                      {t.ticketNumber}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: FAQ Accordion Section (1 Column) */}
          <aside className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Tanya Jawab (FAQ)
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3 divide-y divide-slate-100">
              <details className="group pt-2 first:pt-0" open>
                <summary className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer list-none hover:text-primary transition-colors">
                  <span>Bagaimana cara membagikan dokumen hukum secara aman?</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Buka tab <strong>Legal Drive</strong>, klik dokumen yang dituju, lalu pilih tombol <strong>Bagikan</strong> untuk menyalin tautan aman terenkripsi.
                </p>
              </details>

              <details className="group pt-3">
                <summary className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer list-none hover:text-primary transition-colors">
                  <span>Berapa lama standar respon layanan bantuan (SLA)?</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Tiket reguler dijawab dalam waktu <strong>1–24 jam kerja</strong>. Tiket dengan prioritas <strong>Urgent (Mendesak)</strong> akan ditangani tim kami dalam waktu <strong>di bawah 4 jam</strong>.
                </p>
              </details>

              <details className="group pt-3">
                <summary className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer list-none hover:text-primary transition-colors">
                  <span>Apakah saya bisa membalas tiket yang sudah selesai?</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Tiket yang berstatus selesai (Resolved) telah dikunci untuk arsip audit. Jika kendala masih berlanjut, silakan buat tiket baru dan sertakan nomor tiket sebelumnya.
                </p>
              </details>

              <details className="group pt-3">
                <summary className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer list-none hover:text-primary transition-colors">
                  <span>Bagaimana jika lupa sandi akun mailbox?</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Gunakan menu <strong>Pengaturan Akun &gt; Keamanan</strong> untuk memperbarui sandi Anda secara mandiri atau hubungi admin perusahaan Anda.
                </p>
              </details>
            </div>
          </aside>
        </div>
      </main>

      {/* New Ticket Modal */}
      {newTicketOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewTicketOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Buat Tiket Bantuan Baru</h3>
              <button
                onClick={() => setNewTicketOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subjek Pertanyaan</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Mis. Kendala verifikasi dokumen perjanjian..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="Document Review">Document Review</option>
                    <option value="Billing & Tagihan">Billing & Tagihan</option>
                    <option value="Access & Security">Access & Security</option>
                    <option value="Mailbox Technical">Mailbox Technical</option>
                    <option value="Umum">Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tingkat Urgensi</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="normal">Reguler (Normal)</option>
                    <option value="urgent">Mendesak (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rincian Pertanyaan / Masalah</label>
                <textarea
                  required
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Jelaskan kendala Anda secara detail agar tim kami dapat segera menindaklanjuti..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewTicketOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Ajukan Tiket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Thread Conversation Modal */}
      {selectedTicketId && (
        <TicketThreadModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={(upd) => {
            setTickets((prev) => prev.map((t) => (t.id === upd.id ? { ...t, ...upd } : t)));
          }}
        />
      )}
    </div>
  );
}
