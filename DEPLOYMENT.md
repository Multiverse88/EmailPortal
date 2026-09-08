# Deployment Guide — Email Portal

## 1. Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis 7+
- Meilisearch 1.7+
- MinIO (optional untuk attachment storage)
- Docker & Docker Compose (alternative: install services manually)

## 2. Quick Start (Docker Compose)

Buat file `docker-compose.yml` di root project:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: email_portal
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:v1.7
    environment:
      MEILI_MASTER_KEY: ms_search_key_change_me
    ports:
      - "7700:7700"
    volumes:
      - meili_data:/meili_data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  meili_data:
  minio_data:
```

```bash
# Start services
docker compose up -d

# Create MinIO bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/email-attachments

# Setup database
cd backend
npm install
npx prisma migrate dev --name init
npm run build
```

## 3. Manual Installation (tanpa Docker)

### PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE email_portal;"
sudo -u postgres psql -c "CREATE USER email_user WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE email_portal TO email_user;"
```

### Redis
```bash
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Meilisearch
```bash
# Download binary
wget https://rs.meilisearch.com/v1.7/meilisearch-linux-amd64
chmod +x meilisearch-linux-amd64
./meilisearch-linux-amd64 --master-key ms_search_key_change_me
```

## 4. Run Application

```bash
# Root level
npm install

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env dengan kredensial Hostinger API
npm run dev

# Frontend (buka terminal baru)
cd frontend
npm install
cp .env.example .env
npm run dev
```

Akses:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/health

## 5. Production Deployment (VPS)

```bash
# Install Node.js, PostgreSQL, Redis via apt
# Clone repo
# Install dependencies
npm install --production

# Build
npm run build

# Use PM2 for process management
pm2 start backend/dist/index.js --name email-api
pm2 start frontend/.next/production --name email-frontend  # or use nginx

# Nginx config example:
# server {
#     listen 80;
#     server_name mail.easylegal.co.id;
#     location / {
#         proxy_pass http://localhost:3000;
#     }
#     location /api {
#         proxy_pass http://localhost:4000;
#     }
# }
```

## 6. Environment Variables

Copy `.env.example` dan sesuaikan nilai-nilainya, terutama:
- `HOSTINGER_API_KEY` — ambil dari Hostinger Control Panel
- `HOSTINGER_IMAP_USER/PASS` — kredensial SMTP/IMAP domain
- `ENCRYPTION_KEY` — generate dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 7. Sync Worker

Worker berjalan otomatis via `npm run dev`. Untuk production, jalankan sebagai service terpisah:

```bash
# Backend worker (sync IMAP)
npm run worker
```

## 8. Testing

```bash
# Run tests
npm run test

# API testing manual
curl http://localhost:4000/health
```

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| PostgreSQL connection error | Check `DATABASE_URL` di .env |
| Redis connection error | Check `REDIS_URL` di .env |
| Meilisearch 403 | Check `MEILISEARCH_API_KEY` |
| IMAP sync gagal | Validate HOSTINGER_IMAP_USER/PASS |
| MinIO error | Check minio endpoint & bucket name |
