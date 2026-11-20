#!/usr/bin/env bash
# Classify the current directory for /helm:init. Prints key=value lines.
#   mode = initialized | greenfield | brownfield
# Greenfield: no git repo, or a repo with no source files.
set -euo pipefail

root="${1:-$PWD}"
cd "$root"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  has_git=1
  root="$(git rev-parse --show-toplevel)"
  cd "$root"
  files() { git ls-files --cached --others --exclude-standard; }
  commits="$(git rev-list --count HEAD 2>/dev/null || echo 0)"
  branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo none)"
else
  has_git=0
  files() { find . -type f -not -path './.git/*' -not -path '*/node_modules/*' | sed 's|^\./||'; }
  commits=0
  branch=none
fi

all="$(files)"
# Source = files whose extension is a programming language, excluding docs/config.
src_re='\.(c|cc|cpp|cxx|h|hpp|rs|go|py|pyx|jl|lean|hs|ml|mli|scala|kt|java|cs|fs|swift|m|mm|rb|ex|exs|erl|clj|zig|nim|d|f90|f95|r|R|ts|tsx|js|jsx|mjs|cjs|lua|sh|cu|v|sv|vhd|sql)$'
src="$(grep -E "$src_re" <<<"$all" | grep -vE '(^|/)\.helm/' || true)"
n_files="$(grep -c . <<<"$all" || true)"
n_src="$(grep -c . <<<"$src" || true)"

if [[ -f .helm/state.json ]]; then
  mode=initialized
elif (( n_src == 0 )); then
  mode=greenfield
else
  mode=brownfield
fi

echo "mode=$mode"
echo "root=$root"
echo "has_git=$has_git"
echo "branch=$branch"
echo "commits=$commits"
echo "files=$n_files"
echo "source_files=$n_src"
# Top extensions by count
echo "languages=$(grep -oE '\.[A-Za-z0-9]+$' <<<"$src" | sort | uniq -c | sort -rn | head -6 | awk '{printf "%s:%s ", $2, $1}' || true)"
# Build/manifest files that reveal toolchains
manifests="$(grep -E '(^|/)(Cargo\.toml|pyproject\.toml|setup\.py|requirements[^/]*\.txt|package\.json|go\.mod|lakefile\.(lean|toml)|lean-toolchain|CMakeLists\.txt|Makefile|meson\.build|build\.gradle(\.kts)?|pom\.xml|Project\.toml|flake\.nix|dune-project|stack\.yaml|cabal\.project|[^/]*\.cabal|mix\.exs|Gemfile)$' <<<"$all" | grep -v '/node_modules/' | head -20 | tr '\n' ' ' || true)"
echo "manifests=$manifests"
echo "test_dirs=$(grep -oE '(^|/)(tests?|spec|specs|__tests__|test_[^/]*\.py|[^/]*_test\.[a-z]+)(/|$)' <<<"$all" | sed 's|/$||' | sort -u | head -8 | tr '\n' ' ' || true)"
echo "ci=$(grep -E '^(\.github/workflows/|\.gitlab-ci\.yml|\.woodpecker|\.forgejo/workflows/|\.gitea/workflows/|Jenkinsfile|\.circleci/)' <<<"$all" | head -5 | tr '\n' ' ' || true)"
echo "docs=$(grep -iE '^(README[^/]*|docs?/[^/]+|ARCHITECTURE[^/]*|CONTRIBUTING[^/]*|CLAUDE\.md|AGENTS\.md)$' <<<"$all" | head -10 | tr '\n' ' ' || true)"
echo "beads=$([[ -d .beads ]] && echo 1 || echo 0)"
for t in bd node npx git gh; do
  printf 'tool_%s=%s\n' "$t" "$(command -v "$t" >/dev/null && echo 1 || echo 0)"
done
