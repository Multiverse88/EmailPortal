#!/usr/bin/env bash
# ==============================================================================
# EasyLegal - Synology Laptop Runner Systemd Installer (Fedora)
# Memasang background service tingkat pengguna (systemd --user) agar runner
# otomatis aktif saat laptop menyala tanpa memerlukan sudo / password root.
# ==============================================================================

set -e

SERVICE_NAME="easylegal-synology-runner"
USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NPM_BIN="$(which npm || echo "/usr/bin/npm")"

echo "=========================================================="
echo " [EasyLegal] Memasang Synology Laptop Runner Service..."
echo "=========================================================="
echo " Direktori Project : $REPO_DIR"
echo " Lokasi Systemd    : $USER_SYSTEMD_DIR"
echo " NPM Binary        : $NPM_BIN"
echo "=========================================================="

mkdir -p "$USER_SYSTEMD_DIR"

UNIT_FILE="$USER_SYSTEMD_DIR/$SERVICE_NAME.service"

cat <<EOF > "$UNIT_FILE"
[Unit]
Description=EasyLegal Synology Drive Cold Storage Runner
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
ExecStart=$NPM_BIN --prefix backend run storage:agent
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=BACKEND_API_URL=https://clienteasylegal.co.id

[Install]
WantedBy=default.target
EOF

echo "✓ Unit service dibuat di: $UNIT_FILE"

echo "Memuat ulang konfigurasi systemd..."
systemctl --user daemon-reload

echo "Mengaktifkan service (auto-start saat boot/login)..."
systemctl --user enable "$SERVICE_NAME.service"

echo "Menyalakan service..."
systemctl --user restart "$SERVICE_NAME.service"

echo ""
echo "=========================================================="
echo " Status Service Saat Ini:"
echo "=========================================================="
systemctl --user status "$SERVICE_NAME.service" --no-pager || true

echo ""
echo "=========================================================="
echo " ✅ Pemasangan Berhasil!"
echo " Runner aktif di background laptop Anda."
echo " Log live: journalctl --user -u $SERVICE_NAME -f"
echo "=========================================================="
