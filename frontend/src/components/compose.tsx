'use client';

import { useState } from 'react';
import { Loader2, Paperclip, X, Send, FileText, CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '@/lib/api';

export interface Draft {
  to?: string;
  subject?: string;
  body?: string;
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
  const [to, setTo] = useState(draft.to ?? '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(Boolean(draft.to && draft.to.includes(',')));
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const form = new FormData();
      form.append('to', to);
      if (cc) form.append('cc', cc);
      form.append('subject', subject);
      form.append('body', body);
      files.forEach((f) => form.append('attachments', f));
      await api.post('/email/send', form);
      onSent();
    } catch (err) {
      setError(errMsg(err, 'Gagal mengirim email'));
    } finally {
      setSending(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150">
      <form
        onSubmit={send}
        data-testid="compose-modal"
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-primary to-primary-container text-white select-none shrink-0">
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
            <div data-testid="compose-error" role="alert" className="bg-red-50 text-red-700 border border-red-200/80 px-3.5 py-2.5 rounded-xl text-xs font-medium">
              {error}
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
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Lampiran ({files.length}):</span>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={f.name + i}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="max-w-[180px] truncate font-medium">{f.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({Math.round(f.size / 1024)} KB)</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-slate-400 hover:text-red-600 ml-0.5"
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
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:opacity-95 disabled:opacity-60 transition-all shadow-md shadow-primary/20 active:scale-95"
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
    </div>
  );
}
