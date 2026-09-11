# Prompt: Semua Output Telegram Pakai Kartu EL

Prompt siap pakai. Copy blok di bawah ini ke agent coding (Claude Code / Cursor / dsb) dari root repo.

---

## PROMPT

Kamu bekerja di repo EasyLegal Customer Portal. Tugas: **membuat SETIAP output bot Telegram dikirim sebagai kartu gambar (PNG)** dengan desain yang sama persis seperti mockup `easylegal-kartu-notifikasi.html` di root repo, dengan **pose maskot EL yang cocok dengan kondisi** dan **isi kartu yang cocok dengan apa yang ditanyakan user di chat Telegram**.

### Sumber kebenaran desain

`easylegal-kartu-notifikasi.html` (root repo) adalah satu-satunya acuan visual. Yang wajib diikuti dari file itu:

- Objek `TICKET_STATES` dan `SERVER_STATES`: `tone`, `deep`, `pose`, `pill`, `sub`, `bubble`, `msgLabel`.
- `POSE_LAYOUT`: tinggi, offset kanan/bawah, dan panjang ekor bubble tiap pose.
- Ikon Lucide di objek `I`, layout header/body/footer (`headHTML`, `footHTML`, `stageHTML`).
- Tabel layanan di kartu server: kolom Layanan / Status / Latensi / 30 hari terakhir / Uptime.

Jangan mengarang gaya visual baru. Kalau ragu, buka HTML-nya dan tiru.

### Yang sudah ada (jangan tulis ulang, pakai ini)

| File | Isi |
|---|---|
| `backend/src/lib/mascot-assets.ts` | `MASCOT_POSES` — 10 pose PNG base64: `avatar`, `melambai`, `menyapa`, `muncul`, `semangat`, `tips`, `memikirkan`, `konfirmasi`, `saran`, `senang` |
| `backend/src/lib/card-generator.ts` | `TICKET_STATES`, `SERVER_STATES`, `POSE_LAYOUT`, `DEFAULT_SERVICES`, dan generator: `generateTicketCardPng`, `generateServerStatusCardPng`, `generateDailyDigestCardPng`, `generateSecurityAlertCardPng`, `generateAiAssistantCardPng` |
| `backend/src/lib/telegram.ts` | `sendTelegramPhoto(buffer, caption, replyMarkup, chatId)` |
| `backend/src/lib/telegram-ai.ts` | `gatherLiveWebsiteSnapshot()` (data live), `formatCommandResponse()`, `processTelegramAiMessage()` |
| `backend/src/workers/telegram-bot.ts` | Router pesan & callback query |

### Aset gambar: sudah ada di dalam HTML, jangan cari file terpisah

Semua ilustrasi maskot EL **sudah ter-embed di dalam `easylegal-kartu-notifikasi.html`** sebagai 10 data URI `data:image/webp;base64,...` di objek `POSES` (sekitar baris 211). Tidak ada satu pun referensi eksternal di file itu — tidak ada `src="http..."`, tidak ada CDN font/CSS. Itu sebabnya ukurannya 545 KB. Ikon (scale, clock, user, mail, tag, file, msg, zap) juga inline, berupa path SVG Lucide di objek `I`.

Ke-10 pose itu **sudah diekstrak** ke `backend/src/lib/mascot-assets.ts` dalam bentuk PNG base64. Konversi WebP → PNG itu wajib: resvg tidak bisa men-decode WebP, kalau dipaksa hasil render-nya kosong tanpa error. Jadi backend tidak perlu membaca HTML saat runtime.

| Pose | Yang digambarkan (dari `POSE_ALT`) | Nama asal (`POSE_FILE`) | Dimensi asli |
|---|---|---|---|
| `melambai` | EL melambai | `el-hero-melambai` | 454×640 |
| `menyapa` | EL mengangkat kedua tangan, waspada | `el-menyapa` | 429×522 |
| `muncul` | EL mengintip dari tepi kartu | `el-muncul-dari-tepi` | 237×591 |
| `semangat` | EL melambai bersemangat | `el-semangat` | 402×522 |
| `tips` | EL dengan bola lampu ide | `el-memberikan-tips` | 429×573 |
| `memikirkan` | EL berpikir dengan tanda tanya | `el-memikirkan` | 378×522 |
| `konfirmasi` | EL memegang dokumen bercentang | `el-konfirmasi-dokumen` | 396×564 |
| `saran` | EL memegang papan | `el-memberikan-saran` | 345×522 |
| `senang` | EL senang mengangkat tangan | `el-senang` | 450×522 |
| `avatar` | Kepala EL saja (ikon kecil footer) | `el-avatar-kepala` | 181×160 |

Pemilihan pose harus berdasarkan **ekspresi yang digambarkan di kolom kedua**, bukan berdasarkan nama filenya.

### Aturan wajib

1. **Tidak ada balasan teks polos.** Setiap jawaban bot — perintah slash, pertanyaan bebas, hasil klik tombol inline, notifikasi, dan pesan error — harus dikirim lewat `sendTelegramPhoto` dengan kartu PNG. Teks hanya jadi caption pendek (maks 3–4 baris) di bawah kartu.
2. **Fallback wajib.** Kalau `generate*CardPng` mengembalikan `null` (render gagal), kirim versi teks HTML seperti sekarang. Jangan pernah diam tanpa balasan.
3. **Isi kartu = jawaban atas yang ditanya.** Pilih jenis kartu berdasarkan maksud pertanyaan, bukan satu kartu generik untuk semua. Angka di kartu diambil dari `gatherLiveWebsiteSnapshot()`, bukan hardcode.
4. **Pose maskot mengikuti kondisi**, bukan mengikuti jenis perintah. Kabar baik → pose senang/melambai. Perlu perhatian → memikirkan. Kritis → menyapa. Lihat tabel di bawah.
5. **Caption + inline keyboard nyambung dengan kartu.** Tombol harus relevan dengan isi kartu (contoh: kartu tiket urgent → tombol `Draf Solusi AI` dan `Selesaikan`; kartu server down → tombol `Refresh Status`).
6. Semua teks Bahasa Indonesia, nada profesional dan ramah, sesuai mockup.

### Pemetaan pertanyaan → kartu → pose

| Yang ditanyakan di Telegram | Kartu | stateKey / pose | Tone | Isi utama kartu |
|---|---|---|---|---|
| `/start`, `/help`, sapaan | AI Assistant | `melambai` | biru `#3b82f6` | Daftar perintah cepat + contoh pertanyaan |
| `/status` semua normal | Server Status | `normal` → `senang` | hijau `#22c55e` | Tabel layanan, uptime, jumlah layanan normal |
| `/status` ada yang lambat | Server Status | `gangguan` → `memikirkan` | amber `#f59e0b` | Layanan bermasalah ditandai + latensi aslinya |
| `/status` maintenance | Server Status | `maintenance` → `saran` | biru `#3b82f6` | Jadwal maintenance + layanan terdampak |
| `/status` ada yang mati | Server Status | `down` → `menyapa` | merah `#ef4444` | Layanan down + eskalasi on-call |
| `/tiket` ada urgent | Ticket | `urgent` → `menyapa` | merah | Tiket urgent terbaru: nomor, klien, subjek, sisa SLA |
| `/tiket` normal | Ticket | `baru` → `melambai` | biru | Tiket terbuka terbaru + kategori |
| `/tiket` kosong | AI Assistant | `senang` | hijau | "Semua tiket sudah terselesaikan" |
| Tiket belum dipegang >30 mnt | Ticket | `reminder` → `muncul` | amber | Pengingat, belum ada agen |
| Tiket sedang ditangani | Ticket | `diproses` → `semangat` | cyan `#06b6d4` | Nama agen yang pegang |
| Klik tombol Draf Solusi AI | Ticket | `ai` → `tips` | ungu `#a855f7` | Isi draf balasan AI (label "Draf balasan AI:") |
| Menunggu dokumen klien | Ticket | `menunggu` → `memikirkan` | oranye `#fb923c` | Pesan terakhir ke klien, SLA dijeda |
| Klik tombol Selesaikan | Ticket | `selesai` → `konfirmasi` | hijau | Catatan penyelesaian + durasi |
| `/keamanan` aman | AI Assistant | `senang` | hijau | Sesi aktif, 0 anomali, jumlah audit log |
| `/keamanan` ada anomali multi-IP | Security Alert | `menyapa` | merah | Akun terdampak, jumlah IP, daftar IP |
| `/kegiatan`, `/transaksi`, `/aktivitas` | AI Assistant | `semangat` | cyan | Audit log terbaru + berkas/email terbaru |
| `/storage` kapasitas wajar | AI Assistant | `saran` | amber `#fbbf24` | Hot S3 terpakai, jumlah dokumen, status NAS |
| `/storage` hampir penuh (>80%) | AI Assistant | `memikirkan` | merah | Sisa kapasitas + peringatan |
| `/ringkasan`, `/digest`, digest 07:00 sehat | Daily Digest | `senang` | hijau | 4 widget: cluster, keamanan, storage, tiket |
| Digest ada urgent / anomali | Daily Digest | `memikirkan` | merah | Widget sama + angka masalah disorot |
| Pertanyaan bebas (jawaban AI) | AI Assistant | `tips` | ungu | Pertanyaan user di header, ringkasan jawaban maks 6 baris |
| Bot tidak paham / error | AI Assistant | `memikirkan` | abu `#64748b` | Penjelasan singkat + saran perintah yang tersedia |

### Cara menentukan kondisi (jangan hardcode)

- **Server state**: turunkan dari `snapshot.system.dbOk`, uptime, dan latensi/status layanan nyata. `down` kalau ada layanan mati, `gangguan` kalau ada yang lambat, `maintenance` kalau flag maintenance aktif, selain itu `normal`.
- **Ticket state**: dari `status` (`open`/`resolved`/`closed`) + `priority` (`urgent`/`normal`) + umur tiket (>30 menit tanpa agen → `reminder`).
- **Digest health**: `urgentTickets === 0 && multiIpCount === 0` → sehat.
- **Storage**: persentase pemakaian terhadap kuota, bukan angka mentah.

### Definition of done

1. Kirim tiap perintah ini ke bot dan pastikan balasannya **gambar**, bukan teks: `/start`, `/status`, `/tiket`, `/keamanan`, `/kegiatan`, `/storage`, `/ringkasan`, satu pertanyaan bebas, dan satu perintah ngawur.
2. Klik tiap tombol inline (`ai_draft`, `resolve`, `view_tickets`, `digest_refresh`) — balasannya juga kartu dengan pose yang sesuai tabel.
3. Render sampel tiap state ke PNG dan periksa: tidak ada teks kepotong, tidak ada elemen tumpang tindih, maskot tidak menutupi data.
4. `npx tsc --noEmit -p .` bersih dan `npx jest --runInBand` hijau di `backend/`.
5. Tambah/perbarui test di `backend/tests/telegram-notifications.test.ts`: tiap intent di tabel menghasilkan buffer PNG non-null dengan `stateKey`/`pose` yang benar.

Kerjakan dengan diff sekecil mungkin: pakai generator dan state map yang sudah ada, jangan bikin generator baru kalau cuma beda teks.

---

## Catatan

- Pose `avatar` dipakai untuk ikon kecil di footer kartu, bukan untuk panggung utama.
- Kalau butuh pose baru, ekstrak dari `easylegal-kartu-notifikasi.html` (base64 WebP → PNG) dan tambahkan ke `mascot-assets.ts`, jangan pakai gambar dari luar.
- Cara ekstraksi yang sudah terbukti: ambil string setelah `"<pose>": {"src": "` di HTML, buang prefix `data:image/webp;base64,`, decode ke file `.webp`, lalu `magick in.webp -resize 320x out.png` (resize supaya payload base64-nya tidak membengkak), baru encode ulang ke base64 untuk `mascot-assets.ts`.
