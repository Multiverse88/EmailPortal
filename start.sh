#!/usr/bin/env bash

# ==============================================================================
# Email Portal - All-in-One Development Runner
# Menjalankan Backend (Port 4000) & Frontend (Port 3000) secara bersamaan
# dari direktori root tanpa perlu membuka folder satu per satu.
# ==============================================================================

set -e

# Pindah ke direktori root project tempat script ini berada
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$PROJECT_ROOT"

echo -e "\033[1;36m=============================================================\033[0m"
echo -e "\033[1;32m      🚀 MENJALANKAN EMAIL PORTAL (FRONTEND & BACKEND)       \033[0m"
echo -e "\033[1;36m=============================================================\033[0m"
echo -e "📁 Direktori Root   : $PROJECT_ROOT"
echo -e "🌐 Frontend Web     : \033[1;34mhttp://localhost:3000\033[0m"
echo -e "🔐 Admin Console    : \033[1;34mhttp://localhost:3000/admin\033[0m"
echo -e "⚙️  Backend API     : \033[1;34mhttp://localhost:4000/api\033[0m"
echo -e "\033[1;33mℹ️  Tekan Ctrl+C untuk menghentikan seluruh service.\033[0m"
echo -e "\033[1;36m-------------------------------------------------------------\033[0m"

# Fungsi untuk membersihkan port jika masih tersangkut proses sebelumnya
cleanup_port() {
  local PORT=$1
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -9 "${PORT}/tcp" >/dev/null 2>&1 || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    local PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo -e "\033[1;33m⚠️  Membersihkan proses lama di port $PORT...\033[0m"
      kill -9 $PIDS 2>/dev/null || true
    fi
  fi
}

# Bersihkan port 3000 dan 4000 sebelum startup
cleanup_port 3000
cleanup_port 4000

# Tangkap sinyal exit/Ctrl+C untuk menghentikan seluruh subproses secara bersih
trap 'echo -e "\n\033[1;33m🛑 Menghentikan seluruh service...\033[0m"; cleanup_port 3000; cleanup_port 4000; exit 0' INT TERM EXIT

# Jalankan backend dan frontend sekaligus menggunakan concurrently
npm run dev
