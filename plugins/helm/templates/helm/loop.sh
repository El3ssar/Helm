#!/usr/bin/env bash
# Run the active milestone as a sequence of fresh, headless agent sessions,
# one task per session, until the milestone needs you.
#
#   .helm/loop.sh [-n MAX_SESSIONS] [-b USD_PER_SESSION] [-m MODEL]
#
# Each session runs `/helm:run 1` with --permission-mode dontAsk: only what
# .helm/loop-settings.json allows can run, and everything gated by an ask rule
# (decisions, ADRs, gates, push/merge/tag) is denied, never prompted.
# The session reports its outcome in .helm/run-status:
#   continue  task done, more ready      -> next session
#   blocked   only human decisions left  -> stop, run /helm:decide
#   qa        milestone ready for QA     -> stop, run /helm:decide
#   stuck     a task hit the stuck rule   -> next session (other tasks may be ready)
#   idle      no active milestone        -> stop, run /helm:milestone
# Exit code: 0 waiting on you (blocked|qa|idle), 3 session limit, 4 stuck twice in a row, 1 error.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

max=20 budget=10 model=""
while getopts "n:b:m:h" o; do
  case "$o" in
    n) max="$OPTARG" ;;
    b) budget="$OPTARG" ;;
    m) model="$OPTARG" ;;
    *) sed -n '2,18p' "$0"; exit 2 ;;
  esac
done

command -v claude >/dev/null || { echo "helm-loop: claude CLI not found" >&2; exit 1; }
[[ -f .helm/loop-settings.json ]] || { echo "helm-loop: missing .helm/loop-settings.json" >&2; exit 1; }
if grep -q HELM_TOOLCHAIN_ALLOW .helm/loop-settings.json; then
  echo "helm-loop: .helm/loop-settings.json still has HELM_TOOLCHAIN_ALLOW (run /helm:init)" >&2; exit 1
fi

mkdir -p .helm/logs
stuck_streak=0
for ((i = 1; i <= max; i++)); do
  rm -f .helm/run-status
  log=".helm/logs/$(date -u +%Y%m%dT%H%M%SZ)-$i.json"
  printf 'helm-loop: session %d/%d ... ' "$i" "$max"
  args=(-p "/helm:run 1" --permission-mode dontAsk --settings .helm/loop-settings.json
        --output-format json --max-budget-usd "$budget")
  [[ -n "$model" ]] && args+=(--model "$model")
  if ! claude "${args[@]}" >"$log" 2>&1; then
    echo "claude exited non-zero; see $log" >&2; exit 1
  fi
  status="$(head -n1 .helm/run-status 2>/dev/null || echo missing)"
  echo "$status"
  case "$status" in
    continue) stuck_streak=0 ;;
    stuck)
      # Two stuck sessions in a row means nothing else is moving: stop.
      if (( ++stuck_streak >= 2 )); then echo "helm-loop: stuck twice in a row -> /helm:status, /helm:decide" >&2; exit 4; fi ;;
    blocked|qa) echo "helm-loop: waiting on you -> /helm:decide"; exit 0 ;;
    idle) echo "helm-loop: no active milestone -> /helm:milestone"; exit 0 ;;
    *) echo "helm-loop: session ended without a status; see $log" >&2; exit 1 ;;
  esac
done
echo "helm-loop: reached $max sessions"
exit 3
