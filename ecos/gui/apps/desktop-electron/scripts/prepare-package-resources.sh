#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GUI_DIR="$(cd "$APP_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$GUI_DIR/../.." && pwd)"
RESOURCES_DIR="$APP_DIR/resources"
BINARIES_DIR="$RESOURCES_DIR/binaries"
OSS_CAD_DIR="$RESOURCES_DIR/oss-cad-suite"

detect_api_server_triple() {
  local uname_s
  local uname_m
  uname_s="$(uname -s)"
  uname_m="$(uname -m)"

  case "$uname_s/$uname_m" in
    Linux/x86_64)
      echo "x86_64-unknown-linux-gnu"
      ;;
    Linux/aarch64|Linux/arm64)
      echo "aarch64-unknown-linux-gnu"
      ;;
    Darwin/arm64)
      echo "aarch64-apple-darwin"
      ;;
    Darwin/x86_64)
      echo "x86_64-apple-darwin"
      ;;
    MINGW*/*|MSYS*/*|CYGWIN*/*)
      echo "x86_64-pc-windows-msvc"
      ;;
    *)
      echo "ERROR: unsupported host platform for API server bundle naming: $uname_s/$uname_m" >&2
      exit 1
      ;;
  esac
}

resolve_api_server_bin() {
  if [[ -n "${ECOS_API_SERVER_BIN:-}" ]]; then
    readlink -f "$ECOS_API_SERVER_BIN"
    return 0
  fi

  if ! command -v bazel >/dev/null 2>&1; then
    echo "ERROR: bazel is required to resolve ECOS_API_SERVER_BIN automatically." >&2
    echo "Set ECOS_API_SERVER_BIN explicitly or install bazel." >&2
    exit 1
  fi

  (
    cd "$REPO_ROOT"
    bazel build //ecos:build_ecos_server >/dev/null
    readlink -f "$(bazel cquery --output=files //ecos:build_ecos_server 2>/dev/null | head -n 1)"
  )
}

prepare_oss_cad_dir() {
  rm -rf "$OSS_CAD_DIR"
  mkdir -p "$OSS_CAD_DIR"

  local yosys_bin="${ECOS_OSS_CAD_BIN:-}"
  if [[ -z "$yosys_bin" && -n "${CHIPCOMPILER_OSS_CAD_DIR:-}" && -f "${CHIPCOMPILER_OSS_CAD_DIR}/bin/yosys" ]]; then
    yosys_bin="${CHIPCOMPILER_OSS_CAD_DIR}/bin/yosys"
  fi

  if [[ -n "$yosys_bin" ]]; then
    local oss_root
    oss_root="$(dirname "$(dirname "$(readlink -f "$yosys_bin")")")"
    if [[ ! -f "$oss_root/bin/yosys" ]]; then
      echo "ERROR: invalid OSS CAD suite root inferred from $yosys_bin" >&2
      exit 1
    fi
    cp -a "$oss_root/." "$OSS_CAD_DIR/"
    return 0
  fi

  echo "placeholder for electron package build" > "$OSS_CAD_DIR/README"
  echo "placeholder" > "$OSS_CAD_DIR/placeholder.txt"
}

main() {
  local api_server_bin
  api_server_bin="$(resolve_api_server_bin)"
  if [[ ! -f "$api_server_bin" ]]; then
    echo "ERROR: api server binary not found: $api_server_bin" >&2
    exit 1
  fi

  local target_triple
  target_triple="${ECOS_API_SERVER_TRIPLE:-$(detect_api_server_triple)}"

  mkdir -p "$BINARIES_DIR"
  cp -f "$api_server_bin" "$BINARIES_DIR/api-server-$target_triple"
  chmod +x "$BINARIES_DIR/api-server-$target_triple"

  prepare_oss_cad_dir
}

main "$@"
