"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Loader2, Check, CheckCircle2, Folder, ArrowRight } from "lucide-react";
import api, { errMsg } from "@/lib/api";

interface Proposal {
  id: string;
  title: string;
  filename: string;
  currentCategory: string;
  proposedCategory: string;
  confidence: "high" | "medium";
  reason: string;
}

interface Summary {
  total: number;
  needsAction: number;
  alreadyOk: number;
  unclassified: number;
}

export function TidyDocumentsModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [phase, setPhase] = useState<"preview" | "applying" | "done">("preview");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);

  const load = async () => {
    setError("");
    setLoadingPreview(true);
    try {
      const res = await api.post("/documents/categorize/preview");
      setProposals(res.data.proposals || []);
      setSummary(res.data.summary || null);
      setSelected(new Set((res.data.proposals || []).map((p: Proposal) => p.id)));
      setOverrides({});
    } catch (e) {
      setError(errMsg(e, "Gagal memindai dokumen"));
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (open) { setPhase("preview"); setError(""); void load(); }
  }, [open]);

  if (!open) return null;

  const toggled = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const apply = async () => {
    const items = proposals
      .filter((p) => selected.has(p.id))
      .map((p) => ({ id: p.id, category: overrides[p.id] || p.proposedCategory }));
    if (!items.length) { setError("Centang minimal satu dokumen."); return; }
    setError("");
    setPhase("applying");
    try {
      const res = await api.post("/documents/categorize/apply", { items });
      setAppliedCount(res.data.applied ?? items.length);
      setPhase("done");
      window.dispatchEvent(new CustomEvent("easylegal:documents-changed"));
      onApplied?.();
    } catch (e) {
      setError(errMsg(e, "Gagal menerapkan kategori"));
      setPhase("preview");
    }
  };

  const folders = ["Client Agreements", "Tax Filings", "NDA Templates", "Lampiran Email"];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-6 bg-slate-900/30 backdrop-blur-sm">
      <div className="my-auto w-full max-w-xl rounded-3xl border border-border-subtle bg-white shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="size-8 rounded-xl bg-primary/10 flex items-center justify-center"><Folder className="size-4 text-primary" /></span>
            Rapikan & Klasifikasikan Berkas
          </h3>
          <button type="button" onClick={onClose} className="app-icon-button" title="Tutup"><X className="size-4" /></button>
        </div>

        <div className="px-5 py-3 space-y-3 overflow-y-auto min-h-0">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          {phase === "done" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
              <CheckCircle2 className="mx-auto size-7 text-emerald-600" />
              <p className="mt-2 text-sm font-semibold text-emerald-800">{appliedCount} dokumen telah dipindahkan.</p>
              <p className="text-xs text-emerald-700">Periksa Legal Drive untuk hasil merapikan.</p>
              <button onClick={() => { onClose(); }} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">Tutup</button>
            </div>
          ) : loadingPreview ? (
            <div className="flex flex-col items-center py-10 text-xs text-slate-500">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="mt-2">El memindai nama & judul berkas...</span>
            </div>
          ) : phase === "applying" ? (
            <div className="flex flex-col items-center py-10 text-xs text-slate-500">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="mt-2">Menerapkan kategori...</span>
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <Sparkles className="mx-auto size-5 text-slate-400" />
              <p className="mt-2 text-xs font-medium text-slate-700">Semua dokumen sudah sesuai.</p>
              <p className="text-[11px] text-slate-500">
                {summary ? `${summary.total} berkas dipindai — ${summary.alreadyOk} sudah benar, ${summary.unclassified} tidak terklasifikasi` : ""}
              </p>
              <button onClick={load} disabled={loadingPreview} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
                Pindai ulang
              </button>
            </div>
          ) : (
            <>
              {summary && (
                <p className="text-[11px] text-slate-500">
                  El menemukan <span className="font-bold text-slate-900">{summary.needsAction}</span> dokumen yang bisa dirapikan dari <span className="font-bold">{summary.total}</span> berkas.
                </p>
              )}

              <ul className="space-y-2">
                {proposals.map((p) => (
                  <li key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggled(p.id)} className="mt-0.5 accent-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{p.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{p.filename}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700">{p.currentCategory}</span>
                          <ArrowRight className="size-3 text-slate-400" />
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary border border-primary/20">{overrides[p.id] || p.proposedCategory}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold border ${p.confidence === "high" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {p.confidence === "high" ? "Tinggi" : "Sedang"}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{p.reason}</p>
                      </div>
                    </label>
                    <select
                      value={overrides[p.id] || p.proposedCategory}
                      onChange={(e) => setOverrides((m) => ({ ...m, [p.id]: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      aria-label="Kategori target"
                    >
                      {folders.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between pt-1">
                <button onClick={load} className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2">Pindai ulang</button>
                <span className="text-[11px] text-slate-500">{selected.size} terpilih dari {proposals.length}</span>
              </div>
            </>
          )}
        </div>

        {phase === "preview" && proposals.length > 0 && !loadingPreview && !error && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0 flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Nanti</button>
            <button
              onClick={apply}
              disabled={selected.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="size-4" />
              Terapkan ({selected.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
