#!/bin/sh
# Isolate this install from image-inherited mirror and NodeSource configuration.
# APT still verifies Ubuntu Release signatures with its installed archive keyring.
set -eu
sources=$(mktemp -d)
trap 'rm -rf "$sources"' EXIT HUP INT TERM
chmod 755 "$sources"
mkdir -p "$sources/lists/partial"
cat > "$sources/ubuntu.list" <<'SOURCES'
deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble main universe
deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble-updates main universe
deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://security.ubuntu.com/ubuntu noble-security main universe
SOURCES
export DEBIAN_FRONTEND=noninteractive
set -- \
  -o "Dir::Etc::sourcelist=$sources/ubuntu.list" \
  -o 'Dir::Etc::sourceparts=-' \
  -o "Dir::State::lists=$sources/lists" \
  -o Acquire::Languages=none \
  -o Acquire::Retries=1 \
  -o Acquire::https::Timeout=30
apt-get "$@" update
apt-get "$@" install -y --no-install-recommends openbox
command -v openbox
command -v xvfb-run
