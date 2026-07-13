#!/usr/bin/env bash
set -euo pipefail

REPO="SichenGuo0927/local-pomodoro"
VERSION="0.3.1"
ASSET_NAME="本地番茄钟-${VERSION}.dmg"
DMG_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET_NAME}"
INSTALL_DIR="/Applications"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'This installer only supports macOS.\n' >&2
  exit 1
fi

need_command curl
need_command hdiutil
need_command awk
need_command find
need_command ditto

tmp_dir="$(mktemp -d)"
mount_point=""

cleanup() {
  if [[ -n "$mount_point" ]]; then
    hdiutil detach "$mount_point" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

dmg_path="${tmp_dir}/${ASSET_NAME}"

printf 'Downloading local-pomodoro %s...\n' "$VERSION"
curl -fL "$DMG_URL" -o "$dmg_path"

printf 'Mounting installer...\n'
mount_point="$(hdiutil attach -nobrowse -readonly "$dmg_path" | awk '/\/Volumes\// { print substr($0, index($0, "/Volumes/")); exit }')"

if [[ -z "$mount_point" || ! -d "$mount_point" ]]; then
  printf 'Could not find mounted DMG volume.\n' >&2
  exit 1
fi

app_path="$(find "$mount_point" -maxdepth 1 -name '*.app' -type d | head -n 1)"

if [[ -z "$app_path" || ! -d "$app_path" ]]; then
  printf 'Could not find an app bundle in the DMG.\n' >&2
  exit 1
fi

app_name="$(basename "$app_path")"
target_path="${INSTALL_DIR}/${app_name}"

printf 'Installing %s to %s...\n' "$app_name" "$INSTALL_DIR"
if [[ -w "$INSTALL_DIR" ]]; then
  rm -rf "$target_path"
  ditto "$app_path" "$target_path"
else
  sudo rm -rf "$target_path"
  sudo ditto "$app_path" "$target_path"
fi

printf 'Installed: %s\n' "$target_path"
printf 'If macOS blocks the unsigned app on first launch, right-click it and choose Open.\n'
