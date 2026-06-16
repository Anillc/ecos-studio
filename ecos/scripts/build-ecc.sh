
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_FILE="$(dirname "${BASH_SOURCE[0]}")"
cd "$SCRIPT_FILE/../../ecc"

if command -v direnv; then
  eval "$(direnv export bash)"
fi

uv run pyinstaller ecc.spec --clean --noconfirm
tar -cf dist/ecc.tar -C dist/ecc .
