#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lumen-atlas}"
KEEP="${KEEP:-7}"

STAMP="$(date +%Y-%m-%d-%H%M)"
ARCHIVE="${BACKUP_DIR}/lumen-${STAMP}.tar.gz"

echo "[backup] start: $(date -Iseconds)"
echo "[backup] app: ${APP_DIR}"
echo "[backup] backup dir: ${BACKUP_DIR}"

mkdir -p -- "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
echo "[backup] archive: ${ARCHIVE}"

tar -czf "${ARCHIVE}" -C "${APP_DIR}" \
  --exclude='data/tmp' \
  --exclude='data/geocode-cache.json' \
  data .env

echo "[backup] size: $(du -h -- "${ARCHIVE}" | awk '{print $1}')"

if ! tar tzf "${ARCHIVE}" >/dev/null 2>&1; then
  echo "[backup] verification failed: ${ARCHIVE}" >&2
  rm -f -- "${ARCHIVE}"
  exit 1
fi
echo "[backup] verified: ${ARCHIVE}"

REMOVED="$(ls -1t "${BACKUP_DIR}"/lumen-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)"
if [ -n "${REMOVED}" ]; then
  echo "[backup] removing old backups:"
  printf '%s\n' "${REMOVED}"
  printf '%s\n' "${REMOVED}" | xargs -r rm -f --
else
  echo "[backup] no old backups to remove"
fi

echo "[backup] done: ${ARCHIVE}"
