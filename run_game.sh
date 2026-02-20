#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[오류] python3가 필요합니다. Python 3를 설치한 뒤 다시 실행하세요."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "심연의 탐험가 로컬 서버를 시작합니다."
echo "- 프로젝트 경로: $ROOT_DIR"
echo "- 실행 주소: http://localhost:${PORT}"
echo "중지하려면 Ctrl+C를 누르세요."

python3 -m http.server "$PORT"
