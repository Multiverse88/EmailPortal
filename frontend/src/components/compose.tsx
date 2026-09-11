'use client';

import { useState } from 'react';
import { Loader2, Paperclip, X, Send, FileText, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import api, { errMsg } from '@/lib/api';
import { SupportTicketModal } from '@/components/support-ticket-modal';
import { useCustomerAuth } from '@/store/auth';

export interface Draft {
  to?: string;
  subject?: string;
  body?: string;
  inReplyTo?: string;
  references?: string;
}

export function ComposeModal({
  draft,
  onClose,
  onSent,
}: {
  draft: Draft;
  onClose: () => void;
  onSent: () => void;
}) {
  const { user } = useCustomerAuth();
  const [to, setTo] = useState(draft.to ?? '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(Boolean(draft.to && draft.to.includes(',')));
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsQuotaExceeded(false);
    setSending(true);
    try {
      const form = new FormData();
      form.append('to', to);
      if (cc) form.append('cc', cc);
      form.append('subject', subject);
      form.append('body', body);
      if (draft.inReplyTo) form.append('inReplyTo', draft.inReplyTo);
      if (draft.references) form.append('references', draft.references);
      files.forEach((f) => form.append('attachments', f));
      await api.post('/email/send', form);
      onSent();
    } catch (err: any) {
      const isExceeded =
        err?.response?.data?.code === 'STORAGE_QUOTA_EXCEEDED' ||
        err?.response?.status === 403 ||
        err?.response?.data?.error?.includes('5 GB');
      if (isExceeded) {
        setIsQuotaExceeded(true);
      }
      setError(errMsg(err, 'Gagal mengirim email'));
    } finally {
      setSending(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-backdrop !items-end !p-0 sm:!items-center sm:!p-4">
      <form
        onSubmit={send}
        data-testid="compose-modal"
        className="modal-panel flex max-h-[92vh] w-full flex-col overflow-hidden !rounded-b-none sm:max-w-2xl sm:!rounded-2xl"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-primary/10 bg-primary px-5 py-4 text-white select-none">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-white/90" />
            <h2 className="font-semibold text-sm tracking-wide">Pesan Baru</h2>
          </div>
          <button
            type="button"
            data-testid="compose-close"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Form Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-2.5 overflow-y-auto flex-1">
          {error && (
            <div
              data-testid="compose-error"
              role="alert"
              className="bg-red-50 text-red-700 border border-red-200/80 px-3.5 py-2.5 rounded-xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <span>{error}</span>
              {(isQuotaExceeded || error.toLowerCase().includes('kuota') || error.includes('5 GB')) && (
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(true)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-[11px] self-start sm:self-auto shrink-0 transition-colors inline-flex items-center gap-1"
                >
                  <span>Ajukan Tiket Support &rarr;</span>
                </button>
              )}
            </div>
          )}

          {/* To Field */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500 w-14 shrink-0">Kepada</span>
            <input
              data-testid="compose-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              placeholder="nama@perusahaan.co.id"
              aria-label="Kepada"
              className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-[11px] font-semibold text-slate-500 hover:text-primary px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              >
                Cc
              </button>
            )}
          </div>

          {/* Optional CC Field */}
          {showCc && (
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-500 w-14 shrink-0">Cc</span>
              <input
                data-testid="compose-cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="rekan@perusahaan.co.id"
                aria-label="Cc"
                className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500 w-14 shrink-0">Subjek</span>
            <input
              data-testid="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Topik atau judul email..."
              aria-label="Subjek"
              className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
          </div>

          {/* Message Body */}
          <div className="flex-1 min-h-[220px] pt-1">
            <textarea
              data-testid="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              placeholder="Tulis pesan Anda di sini..."
              aria-label="Isi pesan"
              className="w-full h-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent leading-relaxed"
            />
          </div>

          {/* Attached Files Chips */}
          {files.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Lampiran ({files.length}):</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Pemindaian Keamanan &amp; Enkripsi Ketat Aktif
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={f.name + i}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="max-w-[180px] truncate font-medium">{f.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({Math.round(f.size / 1024)} KB)</span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                      Aman
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-slate-400 hover:text-red-600 ml-0.5"
                      title="Hapus lampiran"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              data-testid="compose-send"
              disabled={sending}
              className="app-primary-button !text-xs"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Email</span>
                </>
              )}
            </button>

            <label
              data-testid="compose-attach"
              className="flex items-center gap-1.5 p-2 rounded-xl text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer transition-colors text-xs font-medium"
              title="Lampirkan file (hingga 10MB)"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Lampiran</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...selected]);
                }}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
        </footer>
      </form>

      {/* Support Ticket Modal for Quota Upgrade */}
      <SupportTicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        initialCategory="Penyimpanan & Kuota"
        initialSubject="Permohonan Penambahan Kuota Mailbox (Kirim Email Terhalang)"
      />
    </div>
  );
}
