# Environment Variables Dokploy — EasyLegal Portal

Salin dan tempel (copy-paste) konfigurasi berikut ke tab **Environment** pada service Compose Dokploy (`email-portal`):

```env
# ========================================================
# 1. Core & Security
# ========================================================
NODE_ENV=production
HOSTINGER_DOMAIN=clienteasylegal.co.id
JWT_SECRET=easy-legal-jwt-secret-dokploy-2026
ENCRYPTION_KEY=easy-legal-portal-secret-key-2026
CORS_ORIGIN=*
AUTO_SEED_DEMO=true

# ========================================================
# 2. Synology Laptop Runner (Cold Storage)
# ========================================================
SYNOLOGY_RUNNER_TOKEN=easylegal-synology-runner-secret-2026

# ========================================================
# 3. Storage Driver (S3 IDCloudHost)
# ========================================================
STORAGE_DRIVER=s3
S3_ENDPOINT=https://is3.cloudhost.id
S3_BUCKET=emailportal
S3_ACCESS_KEY_ID=4MXLOEG0T3G835XWTNB9
S3_SECRET_ACCESS_KEY=ZJ7kquxWvscOSHACrb1yaL8QXDNoQL1uWsmof2gr
S3_REGION=ap-southeast-3

# ========================================================
# 4. Hostinger Mail API & Provisioning
# ========================================================
HOSTINGER_API_TOKEN=dldHmChOTfmwCX6J7SwS3kw3v3FsvKjtfECDo5EUd3992f33
HOSTINGER_ORDER_ID=OR31f5c5e72318c1c7ed4b36518b58

# ========================================================
# 5. Hostinger SMTP (Alert & Notifikasi Email)
# ========================================================
HOSTINGER_SMTP_HOST=smtp.hostinger.com
HOSTINGER_SMTP_PORT=465
HOSTINGER_SMTP_USER=admin@clienteasylegal.co.id
HOSTINGER_SMTP_PASS=

# ========================================================
# 6. AI Companion El (9router LLM)
# ========================================================
NINEROUTER_API_KEY=sk-f96efee82033d617-ir2wc7-13084550
NINEROUTER_BASE_URL=https://router9-9router-bba7ab-157-10-252-77.sslip.io/v1
NINEROUTER_MODEL=ArticleAI
```

---

## 📝 Catatan Penting
- **`SYNOLOGY_RUNNER_TOKEN`**: Harus sama persis dengan token yang ada di laptop Fedora (`easylegal-synology-runner-secret-2026`). Nilai ini digunakan oleh runner laptop untuk mengautentikasi tugas sinkronisasi.
- **`HOSTINGER_SMTP_PASS`**: Isi dengan password akun email `admin@clienteasylegal.co.id` jika ingin mengaktifkan pengiriman email alert keamanan perangkat baru secara nyata. Jika dibiarkan kosong, notifikasi tetap tercatat di database & Security Radar.
