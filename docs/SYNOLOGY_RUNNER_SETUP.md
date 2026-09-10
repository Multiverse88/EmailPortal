# Panduan Setup: Super Admin Synology Laptop Sync Runner (Fedora)

Fitur ini memungkinkan **Super Admin** memicu sinkronisasi file dokumen & lampiran ke **Synology Drive Client** di laptop Fedora langsung dari tombol di web dashboard (`https://clienteasylegal.co.id/admin`).

---

## 🚀 1. Cara Pemasangan Otomatis (1 Langkah)

Cukup jalankan skrip installer di terminal laptop Fedora Anda:

```bash
cd "/home/fullstackiteasylegal/Documents/Email Portal Customer"
./scripts/install-synology-runner.sh
```

Skrip ini akan:
1. Membuat unit file systemd pengguna: `~/.config/systemd/user/easylegal-synology-runner.service`.
2. Mengaktifkan auto-start saat laptop Fedora booting/login.
3. Langsung menyalakan runner di latar belakang.

---

## 🛠️ 2. Perintah Pengelolaan (Management Commands)

| Kebutuhan | Perintah Terminal |
|---|---|
| **Cek status service** | `systemctl --user status easylegal-synology-runner` |
| **Melihat log live** | `journalctl --user -u easylegal-synology-runner -f` |
| **Restart service** | `systemctl --user restart easylegal-synology-runner` |
| **Hentikan sementara** | `systemctl --user stop easylegal-synology-runner` |
| **Nyalakan kembali** | `systemctl --user start easylegal-synology-runner` |
| **Matikan auto-start** | `systemctl --user disable easylegal-synology-runner` |

---

## 🌐 3. Penggunaan di Web Dashboard

1. Buka browser dan login ke akun **Super Admin**:  
   👉 **`https://clienteasylegal.co.id/admin`**
2. Masuk ke tab **Synology & Storage Inspector**.
3. Di kartu **Synology Drive Cold Storage**, Anda akan melihat:
   - **Status Runner**: `🟢 Laptop Terhubung (Synology Drive Online)`
   - **Hostname**: `fedora`
   - **Lokasi Folder**: `/home/fullstackiteasylegal/SynologyDrive/Data Ainan/EmailPortal_ColdStorage` (tertaut juga di `/home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage`)
4. Klik tombol **"Sinkronkan ke Synology Sekarang"**.
5. Laptop Anda akan langsung mengunduh berkas terbaru dari S3 IDCloudHost dan merapikannya ke folder per klien.
6. Aplikasi **Synology Drive Client** di Fedora akan otomatis mengunggahnya ke perangkat Synology NAS kantor Anda!
