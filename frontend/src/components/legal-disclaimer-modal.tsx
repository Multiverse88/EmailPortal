'use client';

import { useState } from 'react';
import { ShieldCheck, Languages } from 'lucide-react';

export interface DisclaimerTexts {
  title: string;
  body: string;
  checkboxLabel: string;
  agreeLabel: string;
}

const texts: Record<'id' | 'en', DisclaimerTexts> = {
  id: {
    title: 'KLAUSUL PENAFIAN DAN PELEPASAN TANGGUNG JAWAB HUKUM (LEGAL DISCLAIMER)',
    body: `Akun surel (email) dengan domain @clienteasylegal.co.id ini merupakan fasilitas administratif sementara yang disediakan secara eksklusif untuk menunjang proses pendaftaran legalitas dan perizinan bisnis klien EasyLegal.

Dengan mengakses dan menggunakan akun surel ini, Pengguna secara sadar mengikatkan diri pada ketentuan hukum berikut:
1. Pembatasan Penggunaan: Akun ini dilarang keras digunakan untuk segala bentuk aktivitas yang melanggar hukum dan peraturan perundang-undangan yang berlaku di Negara Kesatuan Republik Indonesia, termasuk namun tidak terbatas pada penipuan, penggelapan, pencucian uang, penyebaran informasi palsu, spam, atau tindak pidana siber lainnya.
2. Pelepasan Tanggung Jawab Mutlak: Segala bentuk aktivitas, isi komunikasi, dan transaksi yang dilakukan melalui akun ini merupakan tanggung jawab pribadi Pengguna sepenuhnya. Pengguna dengan ini membebaskan EasyLegal beserta jajaran direksi, manajemen, dan karyawannya dari segala bentuk tuntutan, gugatan, ganti rugi, maupun implikasi hukum (baik perdata maupun pidana) yang timbul akibat penyalahgunaan akun ini.
3. Hak Pemutusan Sepihak: EasyLegal memiliki hak prerogatif penuh untuk menangguhkan, memblokir, atau menghapus akses akun ini seketika tanpa pemberitahuan sebelumnya, apabila ditemukan indikasi pelanggaran hukum atau penyalahgunaan fungsi.

Dengan melanjutkan penggunaan akun ini, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan di atas.`,
    checkboxLabel: 'Saya telah membaca dan menyetujui Klausul Penafian dan Pelepasan Tanggung Jawab Hukum yang berlaku.',
    agreeLabel: 'Saya Setuju',
  },
  en: {
    title: 'LEGAL DISCLAIMER AND RELEASE OF LIABILITY CLAUSE',
    body: `This email account under the @clienteasylegal.co.id domain is a temporary administrative facility provided exclusively to support the registration of your business legality and licensing with EasyLegal.

By accessing and using this email account, the User consciously binds themselves to the following legal terms:
1. Restricted Use: This account is strictly prohibited from being used for any activity that violates the laws and regulations in force in the Unitary State of the Republic of Indonesia, including but not limited to fraud, embezzlement, money laundering, dissemination of false information, spam, or other cybercriminal acts.
2. Absolute Release of Liability: All activity, communication content, and transactions conducted through this account are entirely the personal responsibility of the User. The User hereby releases EasyLegal and its board of directors, management, and employees from any claims, lawsuits, damages, or legal implications (both civil and criminal) arising from the misuse of this account.
3. Right of Unilateral Termination: EasyLegal holds full prerogative to suspend, block, or delete access to this account immediately and without prior notice if any indication of legal violation or misuse is found.

By continuing to use this account, you declare that you have read, understood, and agree to all of the above terms.`,
    checkboxLabel: 'I have read and agree to the applicable Legal Disclaimer and Release of Liability clause.',
    agreeLabel: 'I Agree',
  },
};

interface LegalDisclaimerModalProps {
  open: boolean;
  onAccept: () => void;
}

export function LegalDisclaimerModal({ open, onAccept }: LegalDisclaimerModalProps) {
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [accepted, setAccepted] = useState(false);
  const t = texts[lang];

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-disclaimer-title">
      <div className="modal-panel w-full max-w-2xl shadow-[0_32px_100px_-32px_rgba(38,22,22,0.45)] flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-border-subtle">
          <div className="mt-0.5 size-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="legal-disclaimer-title" className="text-sm font-bold tracking-tight text-slate-900 leading-snug">
              {t.title}
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              {lang === 'id' ? 'Mohon baca dan setujui klausul berikut sebelum melanjutkan.' : 'Please read and agree to the following clause before continuing.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'id' ? 'en' : 'id'))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] cursor-pointer shrink-0"
            aria-label="Toggle language"
          >
            <Languages className="size-3 text-slate-400" />
            {lang === 'id' ? 'EN' : 'ID'}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-border-subtle bg-[#faf9f8] p-4 text-xs leading-6 text-slate-700 whitespace-pre-line font-serif">
            {t.body}
          </div>
        </div>

        {/* Footer / Consent */}
        <div className="border-t border-border-subtle px-6 py-4 bg-[#fbfaf9] rounded-b-2xl shrink-0">
          <label className="flex items-start gap-3 cursor-pointer group">
            <span className="mt-0.5 pointer-events-none relative size-4 shrink-0 rounded border border-slate-300 bg-white group-has-[:checked]:border-primary group-has-[:checked]:bg-primary/10">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="sr-only peer"
                aria-describedby="checkbox-desc"
              />
              {accepted && (
                <svg className="absolute inset-0 size-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span id="checkbox-desc" className="text-xs leading-5 text-slate-700 select-none">
              {t.checkboxLabel}
            </span>
          </label>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              disabled={!accepted}
              onClick={onAccept}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-container hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] cursor-pointer"
            >
              <ShieldCheck className="size-3.5" />
              {t.agreeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
