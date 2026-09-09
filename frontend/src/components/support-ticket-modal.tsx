'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send, Headphones, CheckCircle2, AlertCircle, Loader2, HardDrive, Clock } from 'lucide-react';
import api, { errMsg } from '@/lib/api';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
  initialSubject?: string;
  initialMessage?: string;
  initialPriority?: 'normal' | 'urgent';
  onTicketCreated?: (ticket: any) => void;
}

export function SupportTicketModal({
  isOpen,
  onClose,
  initialCategory = 'Penyimpanan & Kuota',
  initialSubject = 'Permohonan Penambahan Kapasitas Penyimpanan (5 GB Penuh)',
  initialMessage = 'Halo Tim Support EasyLegal,\n\nKapasitas penyimpanan Mailbox Drive kami saat ini telah mencapai batas maksimal 5 GB. Kami memohon penambahan kuota penyimpanan agar aktivitas penerimaan berkas legal dan pengiriman email dapat terus berjalan lancar.\n\nTerima kasih.',
  initialPriority = 'urgent',
  onTicketCreated,
}: SupportTicketModalProps) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState<'normal' | 'urgent'>(initialPriority);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<{ id: string; ticketNumber: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setPriority(initialPriority);
      setSubject(initialSubject);
      setMessage(initialMessage);
      setError('');
      setCreatedTicket(null);
    }
  }, [isOpen, initialCategory, initialPriority, initialSubject, initialMessage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return setError('Subjek tiket wajib diisi');
    if (!message.trim()) return setError('Pesan permohonan wajib diisi');

    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/support/tickets', {
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
      });
      const ticket = res.data?.ticket;
      setCreatedTicket({
        id: ticket?.id,
        ticketNumber: ticket?.ticketNumber || '#TK-BARU',
      });
      if (onTicketCreated) onTicketCreated(ticket);
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat tiket support'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToSupport = () => {
    onClose();
    if (createdTicket?.id) {
      router.push(`/support?id=${createdTicket.id}`);
    } else {
      router.push('/support');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hubungi Tim Support</h3>
              <p className="text-[11px] text-slate-500">Permohonan bantuan teknis &amp; kuota penyimpanan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {createdTicket ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Tiket Berhasil Dibuat!</h4>
              <p className="text-xs text-slate-600 mt-1">
                Nomor tiket Anda adalah{' '}
                <span className="font-mono font-bold text-primary">{createdTicket.ticketNumber}</span>. Tim kami akan segera menindaklanjuti permohonan Anda.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={handleGoToSupport}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Buka di Menu Bantuan
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {category === 'Masa Aktif & Retensi Akun' ? (
              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[11px]">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Layanan Bantuan Masa Aktif Akun (1x24 Jam)</span>
                  <p className="text-amber-800 mt-0.5">
                    Permohonan perpanjangan atau pemulihan akun non-aktif akan diproses oleh tim kami maksimal dalam kurun waktu 1x24 jam kerja.
                  </p>
                </div>
              </div>
            ) : category === 'Penyimpanan & Kuota' ? (
              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[11px]">
                <HardDrive className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Batas Kuota Standar 5 GB Tercapai</span>
                  <p className="text-amber-800 mt-0.5">
                    Pengajuan ini akan diteruskan langsung ke Admin Support untuk menambah batas kuota Mailbox Drive Anda.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Masa Aktif & Retensi Akun">Masa Aktif &amp; Retensi Akun</option>
                  <option value="Penyimpanan & Kuota">Penyimpanan &amp; Kuota</option>
                  <option value="Document Review">Document Review</option>
                  <option value="Billing">Billing</option>
                  <option value="Umum">Umum</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Prioritas</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="urgent">Urgent</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Subjek</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Pesan Permohonan</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white rounded-xl font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Permohonan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
