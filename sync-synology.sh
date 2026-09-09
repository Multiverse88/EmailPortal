#!/usr/bin/env bash
# ==============================================================================
# EasyLegal - Synology Drive Cold Storage Manual Sync Launcher
# Hanya berjalan ketika laptop menyala dan script ini dipanggil secara manual.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

echo "========================================================"
echo " [EasyLegal] Sinkronisasi Manual ke Synology Drive..."
echo " Target Folder: /home/fullstackiteasylegal/SynologyDrive/EmailPortal_ColdStorage"
echo " Struktur Folder: accounts/{email_akun}/"
echo "========================================================"

npm run storage:sync-synology

echo ""
echo "========================================================"
echo " [EasyLegal] Sinkronisasi Selesai!"
echo "========================================================"
