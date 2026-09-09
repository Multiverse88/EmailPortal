#!/usr/bin/env bash

# ==============================================================================
# Email Portal Development Runner
# Menjalankan Backend (Port 4000) & Frontend (Port 3000) secara bersamaan.
# ==============================================================================

# Pindah ke direktori root project
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$PROJECT_ROOT"

echo -e "\033[1;36m=====================================================\033[0m"
echo -e "\033[1;32m       🚀 MEMULAI EMAIL PORTAL DEVELOPMENT         \033[0m"
echo -e "\033[1;36m=====================================================\033[0m"
echo -e "📁 Direktori Proyek : $PROJECT_ROOT"
echo -e "🌐 Frontend         : \033[1;34mhttp://localhost:3000\033[0m"
echo -e "🔐 Admin Portal     : \033[1;34mhttp://localhost:3000/admin\033[0m"
echo -e "⚙️  Backend API      : \033[1;34mhttp://localhost:4000/api\033[0m"
echo -e "\033[1;33mℹ️  Tekan Ctrl+C untuk menghentikan seluruh service.\033[0m"
echo -e "\033[1;36m-----------------------------------------------------\033[0m"

# Bersihkan port jika masih ada proses lama yang tersisa
cleanup_port() {
  local PORT=$1
  if command -v lsof >/dev/null 2>&1; then
    local PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo -e "\033[1;33m⚠️  Membersihkan proses lama di port $PORT (PID: $PIDS)...\033[0m"
      kill -9 $PIDS 2>/dev/null || true
    fi
  fi
}

cleanup_port 3000
cleanup_port 4000

# Jalankan backend dan frontend menggunakan npm run dev
npm run dev
