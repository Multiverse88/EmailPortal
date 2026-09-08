'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Lock,
  Headphones,
  User,
  CheckCircle2,
  Printer,
  MoreVertical,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Link2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderName: string;
  senderRole: string; // 'client' | 'agent' | 'system'
  senderAvatar?: string | null;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string; // 'open' | 'resolved' | 'closed'
  priority: string; // 'normal' | 'urgent'
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}

interface TicketThreadModalProps {
  ticketId: string;
  onClose: () => void;
  onTicketUpdated?: (ticket: SupportTicket) => void;
}

export function TicketThreadModal({
  ticketId,
  onClose,
  onTicketUpdated,
}: TicketThreadModalProps) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThread = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/support/tickets/${ticketId}`);
      setTicket(res.data.ticket);
      setMessages(res.data.messages || []);
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat thread tiket'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      const res = await api.post(`/support/tickets/${ticketId}/reply`, {
        message: replyText.trim(),
      });
      setMessages((prev) => [...prev, res.data.message]);
      setReplyText('');
      if (ticket && onTicketUpdated) {
        onTicketUpdated({ ...ticket, updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      alert(errMsg(err, 'Gagal mengirim balasan'));
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;
    if (!confirm('Tutup tiket ini sebagai selesai (resolved)?')) return;
    setClosing(true);
    try {
      const res = await api.post(`/support/tickets/${ticketId}/close`);
      setTicket(res.data.ticket);
      if (onTicketUpdated) onTicketUpdated(res.data.ticket);
    } catch (err) {
      alert(errMsg(err, 'Gagal menutup tiket'));
    } finally {
      setClosing(false);
    }
  };

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#fdfcfb] w-full max-w-4xl h-[92vh] rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden">
        {/* Thread Header */}
        <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-start justify-between shrink-0">
          <div className="flex flex-col gap-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 mr-1 flex items-center gap-1 text-xs font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kembali</span>
              </button>

              {ticket?.priority === 'urgent' && (
                <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Mendesak (Urgent)
                </span>
              )}

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                  ticket?.status === 'open'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {ticket?.status === 'open' ? 'Terbuka' : 'Selesai'}
              </span>

              <span className="text-[11px] font-mono text-slate-400">
                {ticket?.ticketNumber}
              </span>
            </div>

            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5">
              {ticket?.subject || 'Memuat Tiket...'}
            </h1>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {ticket?.status === 'open' && (
              <button
                onClick={handleCloseTicket}
                disabled={closing}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {closing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="hidden sm:inline">Tutup Tiket</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors hidden sm:flex"
              title="Cetak Thread"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Conversation Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#fdfcfb]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-primary mb-2" />
              <p className="text-xs">Memuat percakapan...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-red-500 text-xs">{error}</div>
          ) : (
            <>
              {messages.map((msg) => {
                const isClient = msg.senderRole === 'client';
                const isInternal = msg.isInternal;

                if (isInternal) {
                  return (
                    <div
                      key={msg.id}
                      className="max-w-xl mx-auto my-3 p-3 rounded-xl bg-amber-50/70 border border-dashed border-amber-300 text-xs flex items-start gap-2.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] text-amber-800 font-bold mb-0.5">
                          <span>Catatan Internal Tim</span>
                          <span className="font-normal text-slate-400">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 max-w-2xl ${
                      isClient ? 'mr-auto' : 'ml-auto flex-row-reverse'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs mt-0.5 font-bold text-xs ${
                        isClient
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-primary text-white'
                      }`}
                    >
                      {isClient ? (
                        msg.senderName.slice(0, 1) || 'C'
                      ) : (
                        <Headphones className="w-4 h-4" />
                      )}
                    </div>

                    {/* Message Bubble Container */}
                    <div className={`flex flex-col gap-1 ${isClient ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="font-bold text-slate-800">{msg.senderName}</span>
                        {!isClient && (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                            Support Agent
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>

                      <div
                        className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isClient
                            ? 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                            : 'bg-[#930006] text-white rounded-tr-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Bottom Reply Composer */}
        {ticket?.status === 'open' ? (
          <form
            onSubmit={handleSendReply}
            className="p-4 bg-white border-t border-slate-200/90 shrink-0 space-y-2.5"
          >
            <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all bg-white">
              {/* Mini Toolbar */}
              <div className="flex items-center gap-1 p-1.5 bg-slate-50 border-b border-slate-100 text-slate-500 text-xs">
                <button
                  type="button"
                  onClick={() => setReplyText((t) => t + '**teks tebal**')}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                  title="Tebal"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplyText((t) => t + '*teks miring*')}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                  title="Miring"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplyText((t) => t + ' [tautan](https://...)')}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                  title="Tautan"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ketik balasan Anda ke tim support..."
                rows={3}
                className="w-full p-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none resize-none bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Tekan Ctrl+Enter untuk kirim cepat
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setReplyText('')}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Hapus
                </button>
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="px-5 py-2 bg-primary hover:bg-primary-container text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Kirim Balasan</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
            Tiket ini telah ditutup dan diselesaikan. Jika Anda memiliki pertanyaan baru, silakan buka tiket bantuan baru.
          </div>
        )}
      </div>
    </div>
  );
}
