# Panduan Integrasi Foto Profil & Logo Perusahaan pada Pengiriman Email EasyLegal Portal

Dokumen ini menjelaskan mekanisme teknis bagaimana foto profil / logo perusahaan yang diunggah klien di portal `https://clienteasylegal.co.id/settings?tab=profile` dapat ditampilkan saat mengirimkan email resmi ke penerima (Gmail, Outlook, Apple Mail, dsb).

---

## 1. Fakta Teknis Protokol Email (SMTP Standard)

Protokol email standar dunia (**SMTP - RFC 5322**) dibuat tanpa *header* bawaan untuk melampirkan foto profil secara langsung per pengiriman pesan.

Berbeda dengan aplikasi perpesanan instan (WhatsApp/Telegram), aplikasi email seperti **Gmail, Microsoft Outlook, dan Apple Mail** tidak mengambil foto profil dari file lampiran, melainkan melalui **4 mekanisme standar**:

```
+-----------------------------------------------------------------------------+
|               FOTO PROFIL / LOGO DI PENGIRIMAN EMAIL                        |
+------------------------------------+----------------------------------------+
| 1. Auto HTML Email Signature       | Logo tampil langsung di kaki email     |
|    (Paling Praktis & Universal)    | (Semua email client: Gmail/Outlook)    |
+------------------------------------+----------------------------------------+
| 2. BIMI (Brand Indicators)         | Logo resmi di lingkaran avatar inbox   |
|    (Standar Global Google/Apple)   | (Membutuhkan DNS DMARC & BIMI record)  |
+------------------------------------+----------------------------------------+
| 3. Tampilan Internal Webmail       | Avatar tampil di /inbox sesama akun    |
|    (EasyLegal Portal Native)       | (Menggunakan endpoint avatar publik)   |
+------------------------------------+----------------------------------------+
| 4. Gravatar Synchronization        | Avatar global berbasis hash MD5 email  |
|    (Thunderbird & Webmail Umum)    | (Automattic / Gravatar network)        |
+------------------------------------+----------------------------------------+
```

---

## 2. Opsi Solusi yang Dapat Diterapkan

### Opsi 1: Tanda Tangan Email Otomatis Berlogo (HTML Branded Signature)
> **Status:** Sangat Direkomendasikan & Paling Cepat Berfungsi (Universal).

- **Cara Kerja:**
  Ketika customer mengirim email dari menu **Tulis Pesan** (`/inbox` atau `POST /api/email/send`), sistem otomatis menyematkan blok HTML Signature di bagian bawah email:
  ```html
  <table style="font-family: sans-serif; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    <tr>
      <td style="vertical-align: top; padding-right: 14px;">
        <img src="https://clienteasylegal.co.id/api/settings/avatar/[customerId]" 
             alt="Logo Perusahaan" 
             width="56" height="56" 
             style="border-radius: 8px; object-fit: contain; border: 1px solid #e2e8f0;" />
      </td>
      <td style="vertical-align: top;">
        <strong style="color: #0f172a; font-size: 14px;">[Nama Customer / Perusahaan]</strong><br/>
        <span style="color: #64748b; font-size: 12px;">[Alamat Mailbox Korporasi]</span><br/>
        <span style="color: #0284c7; font-size: 11px;">EasyLegal Verified Corporate Client</span>
      </td>
    </tr>
  </table>
  ```
- **Kelebihan:**
  - 100% muncul di **semua aplikasi penerima** (Gmail, Outlook, Yahoo Mail, HP Android, iPhone).
  - Tampilan sangat profesional layaknya surat korporasi resmi.
  - Sudah didukung langsung oleh endpoint avatar publik yang kita miliki (`/api/settings/avatar/:customerId`).

---

### Opsi 2: BIMI (Brand Indicators for Message Identification)
> **Status:** Standar Resmi Dunia untuk Menampilkan Logo di Bulatan Avatar Gmail & Apple Mail.

- **Cara Kerja:**
  BIMI adalah standar industri yang digunakan oleh Google, Apple, dan Yahoo untuk memvalidasi identitas pengirim dan menampilkan logo resmi perusahaan di sebelah nama pengirim di daftar kotak masuk penerima.
- **Persyaratan DNS (Domain `clienteasylegal.co.id`):**
  1. **SPF & DKIM:** Sudah tervalidasi aktif di Hostinger.
  2. **DMARC Record:** Harus disetel dengan kebijakan `p=quarantine` atau `p=reject`:
     ```dns
     _dmarc.clienteasylegal.co.id TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@clienteasylegal.co.id;"
     ```
  3. **BIMI Record:** Ditambahkan di DNS Hostinger:
     ```dns
     default._bimi.clienteasylegal.co.id TXT "v=BIMI1; l=https://clienteasylegal.co.id/brand-logo.svg;"
     ```
- **Catatan Google:** Google Workspace mewajibkan sertifikat VMC (Verified Mark Certificate) untuk centang biru Gmail, sedangkan Apple Mail dan beberapa penyedia lain sudah mendukung BIMI SVG standar.

---

### Opsi 3: Tampilan Avatar di Dalam Webmail Portal EasyLegal
> **Status:** Dapat langsung diaktifkan di webmail portal.

- Saat klien, officer, atau admin membaca email di `/inbox`, kita dapat menampilkan logo perusahaan pengirim di samping nama pengirim (menggantikan inisial huruf standar).
- Menggunakan endpoint:
  ```ts
  GET /api/settings/avatar/:customerId
  ```

---

## 3. Rangkuman & Rekomendasi Langkah

| Kebutuhan | Solusi Terbaik |
| :--- | :--- |
| **Ingin logo muncul langsung di dalam isi email saat dibuka oleh siapapun (Gmail/Outlook)** | Aktifkan **Opsi 1 (HTML Email Signature Otomatis)** |
| **Ingin logo muncul di bulatan avatar daftar inbox Gmail/Apple Mail penerima** | Konfigurasi **Opsi 2 (BIMI & DMARC DNS Record)** |
| **Ingin logo muncul saat membuka email di dalam portal EasyLegal** | Aktifkan **Opsi 3 (Tampilan Avatar di Webmail `/inbox`)** |
