# Spesifikasi Desain: AI Email Sentinel, Anti-Phishing/BEC, & Hardening Security Radar

**Versi Dokumen:** 1.0.0  
**Tanggal:** 20 September 2026  
**Status:** Disetujui (Tahap Perancangan Selesai)  
**Terkait:** `docs/SPESIFIKASI_KEAMANAN_AI_DAN_DATA.md`  

---

## 1. Ringkasan Eksekutif & Tujuan

Tujuan utama dari spesifikasi ini adalah memperkuat postur keamanan EasyLegal Customer Portal dengan subsistem cerdas **AI Email Sentinel**:
1. **Peningkatan Deteksi Ancaman Email:** Menggantikan deteksi berbasis regex statis murni dengan arsitektur hibrida dua tingkat (*Dual-Engine Hybrid*) untuk mendeteksi *Business Email Compromise* (BEC)—seperti rekayasa pengalihan rekening bank vendor/notaris, intimidasi hukum fiktif, pancingan kredensial canggih, dan *prompt injection* pada email masuk.
2. **Jaminan Kelancaran Proses Bisnis (*Zero Business Disruption*):** Pengambilan dan penyimpanan email berjalan instan dan *non-blocking*. Analisis AI Sentinel dieksekusi secara asinkron (*background enrichment*) dengan *strict timeout* (3.5 detik) dan *intelligent local fallback*, sehingga email klien dan korespondensi hukum tidak pernah tertahan atau gagal masuk.
3. **Kepatuhan Privasi (*Zero Data Leakage*):** Seluruh data identitas sensitif (PII seperti nomor rekening, NIK, nomor telepon) disanitasi dan disamarkan (*in-memory redactor*) sebelum dievaluasi oleh mesin analisis semantik.
4. **Pemisahan Peran & Presisi Radar Keamanan (Super Admin Exclusive):**
   - Notifikasi dan tinjauan ancaman hanya diteruskan ke dasbor **Super Admin** (tab *Security Radar* dan bot Telegram privat). Halaman Officer tetap bersih dari interupsi keamanan.
   - Pensiunkan deteksi *multi-IP* yang memicu ambiguitas dan *false alarm* tinggi, memusatkan fokus radar pada ancaman riil: *AI Email Threats*, *Brute-Force Login Attacks*, dan *Active Session Management*.

---

## 2. Arsitektur Pipeline & Alur Data

### 2.1 Alur Pemrosesan Sinkronisasi Email (Dual-Engine)

```text
[Email Masuk via IMAP / API Hostinger]
                 │
                 ▼
     ┌───────────────────────┐
     │  Email Sync Worker    │
     │  (backend/workers)    │
     └───────────┬───────────┘
                 │
                 ├──────────────────────────────────────────────┐
                 ▼ (Inline Fast Path - < 15ms)                  │ (Asynchronous Task - Non-blocking)
     ┌───────────────────────────────┐                          ▼
     │ Tier-1: Local Fast Scanner    │             ┌───────────────────────────┐
     │ - Magic Bytes & Executable    │             │ AI Email Sentinel         │
     │ - Double Extension (.pdf.exe) │             │ (backend/lib/sentinel.ts) │
     │ - ZIP Archive Inspector       │             └─────────────┬─────────────┘
     │ - Basic Spoofing / Fast Regex │                           │
     └───────────┬───────────────────┘                           ├─► In-Memory PII Sanitizer
                 │                                               │   (Masking Rekening, NIK, Telp)
                 ▼                                               │
     ┌───────────────────────────────┐                           ├─► 9router LLM / Local Heuristic
     │ Database: MessageCache        │                           │   (Timeout: 3.5s + AbortController)
     │ - Email langsung tersimpan    │                           │
     │ - Langsung muncul di Inbox    │                           ▼
     └───────────┬───────────────────┘             ┌───────────────────────────┐
                 │                                 │ Apakah Terdeteksi Bahaya? │
                 │                                 └─────────────┬─────────────┘
                 │                                               │
                 │◄──────── Update Status & Catatan ─────────────┘ (Jika Ya)
                 │          (securityStatus = 'threat')
                 ▼
  ┌─────────────────────────────────────────┐
  │ Integrasi Radar & Notifikasi            │
  │ - Dicatat ke AuditLog (Super Admin)     │
  │ - Push SSE ke Security Radar (/admin)   │
  │ - Notifikasi Instan Telegram Bot        │
  └─────────────────────────────────────────┘
```

### 2.2 Komponen Teknis Baru & Perubahan

1. **`backend/src/lib/ai-email-sentinel.ts` (Modul Baru):**
   - **`sanitizePii(text: string): string`**: Mengubah nomor rekening bank, kartu, NIK, dan nomor telepon pribadi menjadi token anonim sebelum diproses.
   - **`analyzeEmailThreat(params: { sender: string; subject: string; bodyText: string; bodyHtml?: string }): Promise<AiSentinelResult>`**:
     - Memeriksa sanitasi PII.
     - Memanggil 9router LLM (`NINEROUTER_API_KEY`) dengan *structured JSON prompt* dan *AbortController* 3.5s.
     - Jika API tidak terkonfigurasi, error, atau timeout, otomatis beralih ke `analyzeLocalHeuristic()`.
   - **`analyzeLocalHeuristic(params)`**: Mesin analisis deterministik berbasis kamus pola rekayasa sosial, manipulasi rekening bank, intimidasi hukum Indonesia, dan *typosquatting* domain.

2. **`backend/src/workers/sync.ts` (Pembaruan Non-Blocking):**
   - Setelah email disimpan ke `MessageCache`, pemanggilan `analyzeEmailThreat` dijalankan secara asinkron di latar belakang (`void runAsyncSentinelEnrichment(messageId, payload)`).
   - Jika terdeteksi ancaman:
     - `MessageCache.update` status menjadi `'threat'` dan `securityNotes` diisi penjelasan temuan AI.
     - Mencatat event keamanan ke `AuditLog`.
     - Mengirim notifikasi ancaman via Telegram ke Super Admin (dengan *idempotency guard* agar tidak dobel alert).

3. **`backend/src/workers/security-monitor.ts` & `backend/src/lib/security-events.ts` (Pembersihan Multi-IP):**
   - Menghapus aturan dan kalkulasi `multi_ip` yang ambigu.
   - Menghilangkan `THRESHOLD_MULTI_IP` dan metrik `multiIpAlerts`.
   - Mempertahankan dan memprioritaskan `brute_force` (&ge; 5 kegagalan) serta sesi aktif akun.

4. **`frontend/src/app/admin/page.tsx` & `backend/src/routes/security.ts` (Pembaruan Security Radar):**
   - Menghapus banner peringatan dan filter `multiIpAlertCount`.
   - Menampilkan tabel/feed insiden keamanan terkini (*AI Detected Threat Feed* & *Brute Force Attempts*) khusus Super Admin.
   - Memastikan Officer tidak memiliki akses ke data keamanan ini.

---

## 3. Spesifikasi Kontrak Interface & Data

```typescript
export interface AiSentinelResult {
  isThreat: boolean;
  riskLevel: 'clean' | 'low' | 'medium' | 'high' | 'critical';
  threatCategory?:
    | 'bec_invoice_or_bank_redirection'
    | 'credential_harvesting'
    | 'legal_intimidation'
    | 'brand_impersonation'
    | 'prompt_injection';
  confidenceScore: number; // 0.0 - 1.0
  reasons: string[];
  summary: string;
  source: '9router' | 'local_heuristic';
}
```

Format penyimpanan pada `MessageCache.securityNotes`:
```text
[AI SENTINEL: bec_invoice_or_bank_redirection (Tingkat: HIGH, Skor: 0.92)] Terdeteksi upaya pengalihan rekening pembayaran secara mendadak ke rekening perorangan non-resmi.
```

---

## 4. Matriks Akses Peran (RBAC Boundary)

| Modul / Fitur | Customer | Officer | Super Admin |
| :--- | :---: | :---: | :---: |
| **Penerimaan Email Masuk** | Normal (Inbox tanpa jeda) | Normal | Normal |
| **Pemrosesan AI Sentinel** | Berjalan di background | Berjalan di background | Berjalan di background |
| **Notifikasi Ancaman AI** | ❌ Tidak ditampilkan | ❌ Tidak ditampilkan | ✅ Tab Security Radar & Telegram |
| **Audit Log Insiden Email** | ❌ Tidak ada akses | ❌ Tidak ada akses | ✅ Akses penuh (/admin/radar) |
| **Terminasi Sesi & Blokir** | Mandiri untuk akunnya | ❌ Tidak ada akses | ✅ Kontrol penuh |

---

## 5. Strategi Pengujian & Verifikasi

1. **Unit Test AI Sentinel (`backend/tests/ai-email-sentinel.test.ts`):**
   - Verifikasi fungsi `sanitizePii` (masking nomor rekening, kartu kredit, NIK).
   - Verifikasi deteksi skenario BEC (email pengalihan rekening bank vs email tagihan legal resmi).
   - Verifikasi ketahanan *timeout* dan *fallback* ke mesin heuristik lokal saat jaringan terputus.
2. **Regresi Security Monitor & Radar (`backend/tests/security-scanner.test.ts` & `backend/tests/security-monitor.test.ts`):**
   - Memastikan penghapusan `multi_ip` berhasil bersih tanpa merusak kalkulasi status kesehatan server.
   - Verifikasi bahwa `brute_force` tetap terdeteksi secara akurat.
3. **Integritas Build:**
   - Kompilasi TypeScript backend (`npm run build` / `tsc`) bebas error.
   - Kompilasi Next.js frontend (`npm run build`) bebas error.
   - Seluruh test suite (`npm test`) lulus 100%.
