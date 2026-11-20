#!/usr/bin/env bash
# The project's single quality gate.
#   .helm/check.sh fast   pre-commit hook, and agents before every commit
#   .helm/check.sh full   CI, and /helm:run before a milestone goes to QA
# /helm:init fills the four functions below with real commands. Keep it that way:
# every rule about "is this change acceptable" lives here, nowhere else.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fmt()        { HELM_UNSET; }   # check formatting, never rewrite
lint()       { HELM_UNSET; }   # static analysis / type check
test_fast()  { HELM_UNSET; }   # unit tests, seconds
test_full()  { HELM_UNSET; }   # everything: integration, property, slow tests
docs()       { HELM_UNSET; }   # build API docs / doctests; `true` if none

HELM_UNSET() { echo "helm: a check in .helm/check.sh is not configured (run /helm:init)" >&2; return 1; }

step() { printf '==> %s\n' "$1"; "$1"; }

case "${1:-fast}" in
  fast) step fmt; step lint; step test_fast ;;
  full) step fmt; step lint; step test_full; step docs; .helm/docs-sync.sh ;;
  *) echo "usage: $0 fast|full" >&2; exit 2 ;;
esac
echo "helm: ${1:-fast} check passed"
