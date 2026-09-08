# Setup Hostinger Mail — clienteasylegal.co.id

## Arsitektur Final

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Portal (kita)  │     │  Hostinger Mail  │     │  hPanel          │
│                 │     │  API (SDK)       │     │  (manual)        │
│ • Login JWT     │────▶│ • Baca pesan     │     │                  │
│ • Register DB   │     │ • Kirim pesan    │     │ • Buat mailbox   │
│ • Sync worker   │     │ • Quota          │     │ • Set password   │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

## Jawaban: "Buat mailbox, storage, login pakai apa?"

| Kebutu | Pakai | Alasan |
|---|---|---|
| Buat mailbox | **hPanel manual** (admin) | Mail API SDK tidak punya endpoint provisioning. Hostinger tidak expose API create mailbox. |
| Storage email | **Kuota IMAP plan Hostinger** | Tiap mailbox sudah dapat storage bawaan plan (mis. 5 GB). Attachment lokal cache di `STORAGE_DIR` untuk tampilan cepat. |
| Login portal | **JWT portal + Prisma** | Password mailbox disimpan terenkripsi (AES-256-GCM). Untuk IMAP/SMTP fallback di-decrypt saat perlu. Kalau `HOSTINGER_MAIL_API_KEY` aktif → kirim/baca pesan pakai token, tanpa perlu password IMAP. |

## Alur Operasional (Dari Nol)

### 1. Admin buat mailbox di hPanel

```
hPanel → Email → Email Accounts → Create
  Username: budi
  Domain:   clienteasylegal.co.id
  Password: Bu4t!KuatS3kali   ← catat password ini!
```

### 2. Admin register di portal

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Budi Santoso",
    "personalEmail": "budi@gmail.com",
    "localPart": "budi",
    "mailboxPassword": "Bu4t!KuatS3kali"
  }'
```

- `mailboxPassword` opsional. Jika diisi = **sama dengan password hPanel** → IMAP/SMTP sync langsung jalan.
- Jika kosong → portal generate random → portal login jalan, tapi IMAP fallback gagal (harus set Mail API key atau samakan password).

### 3. Customer login portal

```
POST /api/auth/login/customer
{ "email": "budi@clienteasylegal.co.id", "password": "Bu4t!KuatS3kali" }
```
→ JWT 7 hari → Inbox.

### 4. (Opsional, disarankan) Mail API Key

Generate di hPanel → Email → API. Set di `.env`:

```
HOSTINGER_MAIL_API_KEY=hmg_xxx
```

Maka:
- Sync worker pakai SDK (baca pesan via REST, tanpa decrypt password per request)
- Kirim email via SDK (`sendEmail`), copy otomatis masuk INBOX.Sent
- Password portal murni jadi kredensial portal — tak perlu sama dengan password IMAP

## `.env` Backend

```bash
HOSTINGER_DOMAIN=clienteasylegal.co.id

# Path A: Mail API (disarankan) — token-based
HOSTINGER_MAIL_API_KEY=hmg_xxx

# Path B: IMAP/SMTP fallback — password-based
HOSTINGER_SMTP_HOST=smtp.hostinger.com
HOSTINGER_SMTP_PORT=465
HOSTINGER_SMTP_USER=budi@clienteasylegal.co.id
HOSTINGER_SMTP_PASS=password_hPanel
HOSTINGER_IMAP_HOST=imap.hostinger.com
HOSTINGER_IMAP_PORT=993

# Portal
JWT_SECRET=...
ENCRYPTION_KEY=32-char
MAILBOX_QUOTA=100
```

## Pilihan Path: Mana yang Dipakai?

| | Mail API (Path A) | IMAP/SMTP (Path B) |
|---|---|---|
| Setup | 1 API key per order | Password tiap mailbox |
| Kirim | ✅ SDK | ✅ nodemailer |
| Baca | ✅ SDK (REST) | ✅ imap lib |
| Password match | Tidak perlu | Wajib sama dengan hPanel |
| Folder Sent | Otomatis tersimpan | Simpan manual |
| Webhook notif | ✅ | ❌ |

**Rekomendasi: Path A** (Mail API). Login portal tetap pakai password sendiri (JWT), kirim/baca email pakai API key, tidak ada masalah sinkron password.

## Checklist

- [ ] Domain di Hostinger + MX records benar
- [ ] Admin buat mailbox di hPanel, catat password
- [ ] Set `HOSTINGER_DOMAIN`, `HOSTINGER_MAIL_API_KEY` di `.env`
- [ ] `npm run dev` backend
- [ ] Admin login → register customer (dengan/ tanpa `mailboxPassword`)
- [ ] Customer login portal → inbox tampil
- [ ] (Path B) `HOSTINGER_SMTP_*`, `HOSTINGER_IMAP_*` + password sama dengan hPanel
