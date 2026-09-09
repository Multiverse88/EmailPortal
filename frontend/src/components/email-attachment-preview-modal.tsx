'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import api, { errMsg } from '@/lib/api';

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType?: string;
  size: number;
}

type PreviewKind = 'pdf' | 'image' | 'text' | 'audio' | 'video' | 'unsupported';

interface EmailAttachmentPreviewModalProps {
  attachment: EmailAttachment;
  onClose: () => void;
  onDownload: (attachment: EmailAttachment) => Promise<void>;
  downloading?: boolean;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

function getMimeType(attachment: EmailAttachment): string {
  const declared = attachment.mimeType?.trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') return declared;
  const extension = attachment.filename.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

function getPreviewKind(mimeType: string): PreviewKind {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') return 'image';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'unsupported';
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function PreviewIcon({ kind }: { kind: PreviewKind }) {
  const className = 'h-6 w-6';
  if (kind === 'image') return <FileImage className={className} />;
  if (kind === 'audio') return <FileAudio className={className} />;
  if (kind === 'video') return <FileVideo className={className} />;
  if (kind === 'pdf' || kind === 'text') return <FileText className={className} />;
  return <File className={className} />;
}

export function EmailAttachmentPreviewModal({
  attachment,
  onClose,
  onDownload,
  downloading = false,
}: EmailAttachmentPreviewModalProps) {
  const mimeType = useMemo(() => getMimeType(attachment), [attachment]);
  const kind = useMemo(() => getPreviewKind(mimeType), [mimeType]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(kind !== 'unsupported');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (kind === 'unsupported') {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let objectUrl = '';

    const loadPreview = async () => {
      setLoading(true);
      setError('');
      setPreviewUrl('');
      setTextContent('');
      try {
        const response = await api.get(`/email/attachment/${attachment.id}/preview`, {
          responseType: 'blob',
          signal: controller.signal,
        });
        const blob = response.data as Blob;
        if (kind === 'text') {
          setTextContent(await blob.text());
        } else {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        }
      } catch (requestError: any) {
        if (requestError?.code !== 'ERR_CANCELED') {
          setError(errMsg(requestError, 'Pratinjau gagal dimuat. Coba lagi atau unduh berkas.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadPreview();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, kind, reloadKey]);

  const handleDownload = useCallback(async () => {
    await onDownload(attachment);
  }, [attachment, onDownload]);

  const renderPreview = () => {
    if (loading) {
      return (
        <div data-testid="attachment-preview-loading" className="w-full max-w-3xl space-y-4" aria-live="polite">
          <div className="h-[58vh] min-h-80 animate-pulse rounded-xl border border-slate-200 bg-white/70" />
          <p className="text-center text-xs font-medium text-slate-500">Menyiapkan pratinjau...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex max-w-sm flex-col items-center text-center" role="alert">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-primary">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Pratinjau tidak dapat dimuat</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">{error}</p>
          <button onClick={() => setReloadKey((value) => value + 1)} className="app-secondary-button mt-4 !min-h-9 !text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </button>
        </div>
      );
    }

    if (kind === 'unsupported') {
      return (
        <div data-testid="attachment-preview-unsupported" className="flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
            <PreviewIcon kind={kind} />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Format ini belum dapat dipreview</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Berkas tetap aman dan dapat diunduh. Preview langsung tersedia untuk PDF, gambar, teks, audio, dan video.
          </p>
          <button onClick={handleDownload} disabled={downloading} className="app-primary-button mt-5">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Unduh Berkas
          </button>
        </div>
      );
    }

    if (kind === 'pdf' && previewUrl) {
      return (
        <iframe
          data-testid="attachment-preview-frame"
          src={`${previewUrl}#toolbar=1&navpanes=0`}
          title={`Pratinjau ${attachment.filename}`}
          className="h-full min-h-[62vh] w-full border-0 bg-white"
        />
      );
    }

    if (kind === 'image' && previewUrl) {
      return (
        <img
          data-testid="attachment-preview-image"
          src={previewUrl}
          alt={`Pratinjau ${attachment.filename}`}
          className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
        />
      );
    }

    if (kind === 'text') {
      return (
        <pre
          data-testid="attachment-preview-text"
          className="h-full min-h-[62vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-5 font-mono text-xs leading-6 text-slate-700 sm:p-7"
        >
          {textContent}
        </pre>
      );
    }

    if (kind === 'audio' && previewUrl) {
      return (
        <div className="flex w-full max-w-xl flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <FileAudio className="h-8 w-8" />
          </div>
          <audio data-testid="attachment-preview-audio" controls className="w-full" src={previewUrl}>
            Browser Anda tidak mendukung pemutar audio.
          </audio>
        </div>
      );
    }

    if (kind === 'video' && previewUrl) {
      return (
        <video data-testid="attachment-preview-video" controls className="max-h-full max-w-full rounded-xl bg-slate-950" src={previewUrl}>
          Browser Anda tidak mendukung pemutar video.
        </video>
      );
    }

    return null;
  };

  return (
    <div
      data-testid="attachment-preview-modal"
      className="modal-backdrop !p-2 sm:!p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel flex h-[94dvh] max-w-6xl flex-col overflow-hidden bg-background">
        <header className="workspace-toolbar gap-3 !px-3 sm:!px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary sm:flex">
              <PreviewIcon kind={kind} />
            </div>
            <div className="min-w-0">
              <h2 id="attachment-preview-title" className="truncate text-sm font-semibold text-slate-900">
                {attachment.filename}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatSize(attachment.size)} <span aria-hidden="true">•</span> Pratinjau lampiran
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="app-secondary-button !min-h-9 !px-3 !text-xs"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Unduh</span>
            </button>
            <button onClick={onClose} className="app-icon-button" aria-label="Tutup pratinjau">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#ebe8e7] p-3 sm:p-6">
          {renderPreview()}
        </main>
      </div>
    </div>
  );
}
