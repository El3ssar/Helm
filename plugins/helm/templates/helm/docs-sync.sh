#!/usr/bin/env bash
# Fails when the stable surface changed but the docs did not.
# Stable surface = globs in .helm/public-paths (public API, file formats, CLI, protocols).
# Base of comparison: $HELM_BASE if set (CI sets it to the PR base), else merge-base with main.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[[ -s .helm/public-paths ]] || exit 0

main="$(sed -nE 's/.*"main_branch"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' .helm/state.json 2>/dev/null | head -n1)"
main="${main:-main}"
base="${HELM_BASE:-}"
if [[ -z "$base" ]]; then
  base="$(git merge-base HEAD "$main" 2>/dev/null || true)"
fi
# On main itself, or with no base, there is nothing to compare.
[[ -n "$base" && "$base" != "$(git rev-parse HEAD)" ]] || exit 0

changed="$(git diff --name-only "$base"...HEAD)"
mapfile -t globs < <(grep -vE '^\s*(#|$)' .helm/public-paths)

shopt -s globstar extglob
touched_public=()
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  for g in "${globs[@]}"; do
    # shellcheck disable=SC2053  # glob match is intended
    if [[ "$f" == $g ]]; then touched_public+=("$f"); break; fi
  done
done <<<"$changed"

(( ${#touched_public[@]} == 0 )) && exit 0

if grep -qE '^(docs/|README)' <<<"$changed"; then
  exit 0
fi

{
  echo "helm docs-sync: the stable surface changed but nothing under docs/ or README did:"
  printf '  %s\n' "${touched_public[@]}"
  echo "Update docs/ARCHITECTURE.md (and the ADR that authorised the change)."
} >&2
exit 1
