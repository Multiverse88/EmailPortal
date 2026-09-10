'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  LifeBuoy,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  HardDrive,
  Mail,
  Loader2,
  RefreshCw,
  Search,
  Check,
  ArrowRight,
  Database,
  Archive,
  Bell,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';

interface TicketListItem {
  id: string;
  customerId: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    mailboxAddress: string;
    personalEmail: string;
    createdAt: string;
  };
  messages: {
    id: string;
    senderName: string;
    senderRole: string;
    message: string;
    createdAt: string;
  }[];
  _count: {
    messages: number;
  };
}

interface Props {
  onNotify: (msg: string) => void;
}

export function SupportTicketsDesk({ onNotify }: Props) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // SWR for ticket list
  const { data, mutate, isLoading } = useSWR<{
    tickets: TicketListItem[];
    total: number;
    stats: { open: number; resolved: number; urgent: number };
  }>('/admin/support/tickets', fetcher, { refreshInterval: 15000 });

  const tickets = data?.tickets || [];
  const stats = data?.stats || { open: 0, resolved: 0, urgent: 0 };

  // Set default selected ticket if none
  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [tickets, selectedTicketId]);

  // SWR for selected ticket detail
  const {
    data: detailData,
    mutate: mutateDetail,
    isLoading: isDetailLoading,
  } = useSWR<{
    ticket: any;
    messages: any[];
    customerContext: {
      name: string;
      mailboxAddress: string;
      personalEmail: string;
      retention: { remainingDays: number; isExpiringSoon: boolean };
      storageStats: { storageUsed: number; storageLimit: number; isFull: boolean };
      docCount: number;
      status: string;
    };
  }>(selectedTicketId ? `/admin/support/tickets/${selectedTicketId}` : null, fetcher);

  // AI Suggestion state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggestedReply: string;
    categoryInsight: string;
    recommendedActions: string[];
    customerDiagnostic: any;
  } | null>(null);

  // Reply Composer state
  const [replyText, setReplyText] = useState('');
  const [markAsResolved, setMarkAsResolved] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Telegram Notification Center state
  const [testingTg, setTestingTg] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [showTgGuide, setShowTgGuide] = useState(false);

  const { data: tgStatus, mutate: mutateTgStatus } = useSWR<{
    configured: boolean;
    enabled: boolean;
    maskedChatId: string;
    cronSchedule: string;
    timezone: string;
    hasBotToken: boolean;
  }>('/admin/telegram/status', fetcher);

  const handleTestTelegram = async () => {
    setTestingTg(true);
    try {
      const res = await api.post('/admin/telegram/test');
      if (res.data.success) {
        onNotify('Pesan uji coba Telegram berhasil terkirim!');
      } else {
        onNotify('Peringatan: ' + (res.data.error || 'Gagal mengirim pesan'));
      }
      mutateTgStatus();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal menguji notifikasi Telegram'));
    } finally {
      setTestingTg(false);
    }
  };

  const handleSendDigestNow = async () => {
    setSendingDigest(true);
    try {
      const res = await api.post('/admin/telegram/send-digest');
      if (res.data.success) {
        onNotify('Rangkuman Harian Sistem & Keamanan berhasil dikirim ke Telegram!');
      } else {
        onNotify('Peringatan: ' + (res.data.error || 'Gagal mengirim rangkuman'));
      }
      mutateTgStatus();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal memicu pengiriman rangkuman'));
    } finally {
      setSendingDigest(false);
    }
  };

  const handleGetAiSuggestion = async () => {
    if (!selectedTicketId) return;
    setIsGeneratingAi(true);
    try {
      const res = await api.post(`/admin/support/tickets/${selectedTicketId}/suggest-reply`);
      setAiSuggestion(res.data);
      onNotify('Rekomendasi solusi AI berhasil dibuat');
    } catch (err: any) {
      console.error('AI suggest error:', err);
      onNotify(errMsg(err, 'Gagal membuat rekomendasi AI'));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiReply = () => {
    if (aiSuggestion?.suggestedReply) {
      setReplyText(aiSuggestion.suggestedReply);
      onNotify('Draf balasan AI berhasil diterapkan ke kolom balasan');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      await api.post(`/admin/support/tickets/${selectedTicketId}/reply`, {
        message: replyText.trim(),
        status: markAsResolved ? 'resolved' : 'open',
      });
      setReplyText('');
      setAiSuggestion(null);
      onNotify('Balasan resmi berhasil dikirim ke klien');
      mutateDetail();
      mutate();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal mengirim balasan tiket'));
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedTicketId || !detailData?.ticket) return;
    const nextStatus = detailData.ticket.status === 'open' ? 'resolved' : 'open';

    setIsTogglingStatus(true);
    try {
      await api.patch(`/admin/support/tickets/${selectedTicketId}/status`, {
        status: nextStatus,
      });
      onNotify(`Status tiket berhasil diubah menjadi "${nextStatus === 'resolved' ? 'Selesai' : 'Buka'}"`);
      mutateDetail();
      mutate();
    } catch (err: any) {
      onNotify(errMsg(err, 'Gagal memperbarui status tiket'));
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customer.mailboxAddress.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const activeTicket = detailData?.ticket;
  const messages = detailData?.messages || [];
  const custCtx = detailData?.customerContext;

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-panel p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Tiket Bantuan</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{tickets.length}</div>
            <span className="text-[11px] text-slate-400">Seluruh korespondensi klien</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5" />
          </div>
        </div>

        <div className="app-panel p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Menunggu Tanggapan</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.open}</div>
            <span className="text-[11px] text-amber-600/80 font-medium">Perlu perhatian Super Admin</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="app-panel p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Tiket Prioritas Urgent</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.urgent}</div>
            <span className="text-[11px] text-red-600/80 font-medium">SLA penanganan &lt; 4 Jam</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="app-panel p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Tiket Selesai / Resolved</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.resolved}</div>
            <span className="text-[11px] text-emerald-600 font-medium">Solusi tuntas terkirim</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Telegram Notification & Automated Daily Digest Center */}
      <div className="app-panel p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/60 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold tracking-tight text-white">
                  Pusat Notifikasi &amp; Rangkuman Harian Telegram
                </h3>
                {tgStatus?.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Bot Aktif Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <AlertCircle className="w-3 h-3" />
                    Belum Dikonfigurasi di .env
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {tgStatus?.configured ? (
                  <>
                    Target Obrolan: <code className="text-blue-300 bg-white/10 px-1.5 py-0.5 rounded">{tgStatus.maskedChatId}</code> &bull; Jadwal Rangkuman: <span className="font-semibold text-emerald-300">Setiap Hari 08:00 WIB</span> &bull; Alert Tiket: <span className="font-semibold text-blue-300">Real-time</span>
                  </>
                ) : (
                  <>
                    Atur <code className="text-amber-300 bg-white/10 px-1 py-0.5 rounded">TELEGRAM_BOT_TOKEN</code> &amp; <code className="text-amber-300 bg-white/10 px-1 py-0.5 rounded">TELEGRAM_CHAT_ID</code> di server backend agar notifikasi tiket baru &amp; rangkuman harian dikirim otomatis.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTg}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              title="Kirim pesan verifikasi ke Telegram"
            >
              {testingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{testingTg ? 'Mengirim...' : 'Tes Bot'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendDigestNow}
              disabled={sendingDigest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              title="Kirim laporan kondisi website & keamanan sekarang"
            >
              {sendingDigest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{sendingDigest ? 'Memproses...' : 'Kirim Rangkuman Sekarang'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTgGuide(!showTgGuide)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Panduan Pengaturan Bot Telegram"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Setup Guide */}
        {showTgGuide && (
          <div className="mt-4 pt-4 border-t border-slate-700/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-black/20 border border-white/5 space-y-1">
              <div className="font-semibold text-blue-300">1. Buat Bot di Telegram</div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Chat dengan <b>@BotFather</b> di Telegram, kirim perintah <code>/newbot</code>, ikuti petunjuk, lalu salin HTTP API Token yang diberikan.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5 space-y-1">
              <div className="font-semibold text-blue-300">2. Dapatkan Chat ID</div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Tambahkan bot ke grup/channel Super Admin EasyLegal, lalu periksa Chat ID (misal: <code>-100xxxxxxx</code>) via bot <b>@userinfobot</b> atau Webhook update.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5 space-y-1">
              <div className="font-semibold text-blue-300">3. Masukkan ke .env Backend</div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Tambahkan <code>TELEGRAM_BOT_TOKEN=...</code> dan <code>TELEGRAM_CHAT_ID=...</code> pada file <code>backend/.env</code>, lalu restart server.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tickets Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="app-panel p-4 bg-white border border-slate-200/90 shadow-2xs space-y-3">
            {/* Header & Filter */}
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>Daftar Antrean Tiket</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {filteredTickets.length}
                </span>
              </h4>

              <button
                type="button"
                onClick={() => mutate()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Refresh Antrean Tiket"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nomor tiket, subjek, nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1 text-center rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({tickets.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`flex-1 py-1 text-center rounded-lg transition-all ${
                  statusFilter === 'open'
                    ? 'bg-white text-amber-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Buka ({stats.open})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`flex-1 py-1 text-center rounded-lg transition-all ${
                  statusFilter === 'resolved'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Selesai ({stats.resolved})
              </button>
            </div>

            {/* Tickets List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Tidak ada tiket dalam antrean ini
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  const isUrgent = t.priority === 'urgent';
                  const isOpen = t.status === 'open';

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-primary">
                            {t.ticketNumber}
                          </span>
                          {isUrgent && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-700 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> URGENT
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOpen
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOpen ? 'Perlu Respon' : 'Selesai'}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {t.subject}
                      </h5>

                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {t.messages[0]?.message || 'Tidak ada pesan awal'}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-medium text-slate-600 truncate max-w-[130px]">
                          {t.customer.name}
                        </span>
                        <span>
                          {format(new Date(t.updatedAt), 'dd MMM HH:mm', { locale: localeId })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Ticket Detail, Live Diagnostics & AI Resolution */}
        <div className="lg:col-span-7 space-y-4">
          {!activeTicket && isDetailLoading && (
            <div className="app-panel p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs">Memuat detail tiket dan diagnosis akun...</p>
            </div>
          )}

          {!activeTicket && !isDetailLoading && (
            <div className="app-panel p-16 text-center text-slate-400">
              <LifeBuoy className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Pilih tiket dari daftar di sebelah kiri</p>
            </div>
          )}

          {activeTicket && (
            <div className="space-y-4">
              {/* Ticket Header & Status Controls */}
              <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary">
                        {activeTicket.ticketNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {activeTicket.category}
                      </span>
                      {activeTicket.priority === 'urgent' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Prioritas Mendesak (&lt; 4 Jam)
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {activeTicket.subject}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleStatus}
                      disabled={isTogglingStatus}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                        activeTicket.status === 'open'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isTogglingStatus ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : activeTicket.status === 'open' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tandai Selesai</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Buka Kembali</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Customer Live Context Diagnostics Banner */}
                {custCtx && (
                  <div className="mt-3.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Klien Pemohon
                      </span>
                      <span className="font-bold text-slate-800 block truncate">{custCtx.name}</span>
                      <span className="text-[11px] font-mono text-slate-500 block truncate">{custCtx.mailboxAddress}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Status Retensi 90 Hari
                      </span>
                      <span className={`font-semibold block ${custCtx.retention.isExpiringSoon ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {custCtx.retention.remainingDays} Hari Tersisa
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {custCtx.retention.isExpiringSoon ? 'Peringatan Masa Retensi' : 'Status Akun Aktif'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Kapasitas Storage S3
                      </span>
                      <span className="font-semibold text-slate-800 block">
                        {(custCtx.storageStats.storageUsed / (1024 * 1024)).toFixed(1)} MB / 5.000 MB
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {custCtx.docCount} Berkas Legal Drive
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Thread */}
              <div className="app-panel p-5 bg-white border border-slate-200/90 shadow-2xs space-y-4 max-h-[380px] overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span>Riwayat Korespondensi Tiket ({messages.length} Pesan)</span>
                </h4>

                <div className="space-y-3">
                  {messages.map((m: any) => {
                    const isClient = m.senderRole === 'client';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-700">
                            {m.senderName}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                              isClient
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {isClient ? 'Klien' : 'Super Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {format(new Date(m.createdAt), 'dd MMM HH:mm', { locale: localeId })}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl max-w-lg text-xs leading-relaxed ${
                            isClient
                              ? 'bg-slate-100 text-slate-900 rounded-tl-xs'
                              : 'bg-primary text-white rounded-tr-xs shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ✨ Super Admin AI Suggested Resolution Engine ✨ */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">
                        AI Suggested Resolution (Super Admin Copilot)
                      </h4>
                      <p className="text-[11px] text-indigo-700/80">
                        Analisis otomatis masalah klien & buat draf resolusi resmi berstandar SLA.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGetAiSuggestion}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isGeneratingAi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{aiSuggestion ? 'Perbarui Saran AI' : 'Dapatkan Solusi AI'}</span>
                  </button>
                </div>

                {aiSuggestion && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-indigo-100 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs text-indigo-900 font-semibold bg-indigo-100/60 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700">Diagnosa AI:</span>
                      <span>{aiSuggestion.categoryInsight}</span>
                    </div>

                    {/* Operational Recommendations */}
                    {aiSuggestion.recommendedActions.length > 0 && (
                      <div className="p-3 bg-white/90 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Langkah Operasional Super Admin yang Disarankan:
                        </span>
                        <ul className="space-y-1 list-disc list-inside text-slate-700">
                          {aiSuggestion.recommendedActions.map((act, i) => (
                            <li key={i} className="text-[11px]">{act}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI Drafted Reply */}
                    <div className="p-3 bg-white/90 rounded-xl border border-indigo-100 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-indigo-950 uppercase tracking-wider">
                          Draf Balasan Resmi yang Dibuat AI:
                        </span>
                        <button
                          type="button"
                          onClick={handleApplyAiReply}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Gunakan Draf Ini di Kolom Balasan</span>
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {aiSuggestion.suggestedReply}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply Composer Form */}
              <form onSubmit={handleSendReply} className="app-panel p-4 bg-white border border-slate-200/90 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-primary" />
                  <span>Kirim Balasan Resmi Super Admin</span>
                </h4>

                <textarea
                  rows={4}
                  placeholder="Ketik balasan resmi atau gunakan draf AI di atas..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsResolved}
                      onChange={(e) => setMarkAsResolved(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                    <span>Tandai tiket langsung sebagai Selesai (Resolved)</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSendingReply ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Kirim Tanggapan</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
