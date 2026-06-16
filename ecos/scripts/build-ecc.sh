#!/usr/bin/env bash
set -euo pipefail

SCRIPT_FILE="$(dirname "${BASH_SOURCE[0]}")"
cd "$SCRIPT_FILE/../../ecc"

if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  version="$(sed -n 's/^version = "\(.*\)"/\1/p' pyproject.toml | head -n 1)"
  : "${version:?missing version in pyproject.toml}"

  mkdir -p dist
  gh release download "v$version" \
    --repo openecos-projects/ecc \
    --pattern '*.tar.gz' \
    --output dist/ecc.tar.gz \
    --clobber
  gzip -dc dist/ecc.tar.gz > dist/ecc.tar
  exit 0
fi

if command -v direnv; then
  eval "$(direnv export bash)"
fi

uv run pyinstaller ecc.spec --clean --noconfirm
tar -cf dist/ecc.tar -C dist/ecc .
