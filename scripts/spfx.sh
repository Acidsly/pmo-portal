#!/usr/bin/env bash
# Запускает команду в spfx/ под Node 26 LTS (SPFx 1.24 поддерживает 22, 24 и 26). Системный Node не трогается.
set -euo pipefail
if command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix node@26 2>/dev/null)/bin/node" ]; then
  export PATH="$(brew --prefix node@26)/bin:$PATH"
fi
node -v | grep -q '^v26\.' || { echo "Нужен Node 26: brew install node@26" >&2; exit 1; }
cd "$(dirname "$0")/../spfx"
exec "$@"
