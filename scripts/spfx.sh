#!/usr/bin/env bash
# Запускает команду в spfx/ под Node 22 (SPFx 1.23 требует >=22.14 <23). Системный Node не трогается.
set -euo pipefail
if command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix node@22 2>/dev/null)/bin/node" ]; then
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi
node -v | grep -q '^v22\.' || { echo "Нужен Node 22: brew install node@22" >&2; exit 1; }
cd "$(dirname "$0")/../spfx"
exec "$@"
