#!/usr/bin/env bash
# Raw snapshot for /helm:status. Read-only.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

section() { printf '\n### %s\n' "$1"; }
field() { sed -nE "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\".*/\1/p" .helm/state.json | head -n1; }

section state
cat .helm/state.json 2>/dev/null || echo "not initialized"
epic="$(field id)"

section intent
sed -n '/^## Purpose/,/^## /p' docs/INTENT.md 2>/dev/null | sed '1d;$d' | grep -v '^<!--' | head -8

section milestones
for f in docs/milestones/M*.md; do
  [[ -e "$f" ]] || continue
  printf '%s | %s | %s\n' "$(basename "$f" .md)" \
    "$(sed -nE 's/^Status: (.*)/\1/p' "$f" | head -n1)" \
    "$(sed -n '/^## Goal/,/^## /p' "$f" | sed '1d;$d' | grep -v '^<!--' | grep . | head -n1)"
done

section epics
bd epic status 2>&1 | head -30

if [[ -n "$epic" ]]; then
  section "active milestone graph ($epic)"
  bd dep tree "$epic" --direction both 2>&1 | head -60
  section "ready (agent can do now)"
  bd ready --parent "$epic" --exclude-label human --plain 2>&1 | head -15
fi

section "waiting on you"
bd human list -s open 2>&1 | head -20

section "triage (discovered, unplanned)"
bd ready -l triage --plain 2>&1 | head -15

section decisions
for f in docs/adr/[0-9]*.md; do
  [[ -e "$f" ]] || continue
  printf '%s | %s\n' "$(head -n1 "$f" | sed 's/^# //')" "$(sed -nE 's/^Status: (.*)/\1/p' "$f" | head -n1)"
done

section "recent commits"
git log --oneline -12 2>&1

section "branch"
git status -sb 2>&1 | head -5
