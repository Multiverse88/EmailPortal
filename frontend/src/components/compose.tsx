'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
      form.append('cc', cc);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <form
        onSubmit={send}
        data-testid="compose-modal"
        className="bg-surface-container-lowest w-full sm:max-w-2xl rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-surface-variant bg-surface-container-low rounded-t-xl">
          <h2 className="font-medium text-on-surface text-label-button">Pesan Baru</h2>
          <button type="button" data-testid="compose-close" onClick={onClose} className="p-1 rounded hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </header>

        <div className="p-4 space-y-2 overflow-y-auto">
          {error && (
            <div data-testid="compose-error" role="alert" className="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <input
            data-testid="compose-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            placeholder="Kepada"
            aria-label="Kepada"
            className="w-full px-md py-2 border-b border-surface-variant focus:outline-none focus:border-primary text-sm text-on-surface placeholder:text-on-surface-variant bg-transparent"
          />
          <input
            data-testid="compose-cc"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="Cc"
            aria-label="Cc"
            className="w-full px-md py-2 border-b border-surface-variant focus:outline-none focus:border-primary text-sm text-on-surface placeholder:text-on-surface-variant bg-transparent"
          />
          <input
            data-testid="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subjek"
            aria-label="Subjek"
            className="w-full px-md py-2 border-b border-surface-variant focus:outline-none focus:border-primary text-sm text-on-surface placeholder:text-on-surface-variant bg-transparent"
          />
          <textarea
            data-testid="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Tulis pesan..."
            aria-label="Isi pesan"
            className="w-full px-md py-2 focus:outline-none text-sm resize-none text-on-surface placeholder:text-on-surface-variant bg-transparent"
          />
          {files.length > 0 && (
            <ul className="text-xs text-on-surface-variant space-y-1">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  {f.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-3 px-4 py-3 border-t border-surface-variant">
          <button
            type="submit"
            data-testid="compose-send"
            disabled={sending}
            className="flex items-center gap-2 bg-primary-container text-on-primary-container px-5 py-2 rounded-full text-sm font-medium hover:bg-primary-container/90 disabled:opacity-60 transition-colors shadow-sm"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            {sending ? 'Mengirim...' : 'Kirim'}
          </button>
          <label data-testid="compose-attach" className="p-2 rounded-full hover:bg-surface-variant/50 cursor-pointer transition-colors" title="Lampirkan file">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">attach_file</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
        </footer>
      </form>
    </div>
  );
}
