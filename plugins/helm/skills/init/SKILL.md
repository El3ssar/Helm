---
name: init
description: Set up helm in this repo (empty or existing codebase).
disable-model-invocation: true
argument-hint: "[project description, for empty repos]"
---
Set up helm. Ask questions the way the "Asking the human" rule in `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.helm.md` says. Read that rule first.

Plugin root: `${CLAUDE_PLUGIN_ROOT}` (scripts in `scripts/`, templates in `templates/`). Project description: $ARGUMENTS

1. **Detect.** Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/detect.sh`.
   - `mode=initialized`: run `scaffold.mjs --phase files --main <main_branch from state> --ci <ci from state>`, then `--phase gates`. This refreshes the CLAUDE.md block and rewires the hooks. Then stop.
   - `tool_bd=0` or `tool_node=0`: say what to install, then stop.
   - `has_git=0`: `git init -b main`.
   - Confirm the mode (citing the evidence), and ask CI: GitHub Actions or none.

2. **Intent and baseline.**
   - **Greenfield:**
     1. Interview the human for `docs/INTENT.md`, one section at a time: purpose, outcomes, non-goals, invariants, quality bar, open questions. Reject untestable outcomes or invariants.
     2. Propose the toolchain as `docs/adr/0001-toolchain.md`, using `docs/adr/TEMPLATE.md` once step 3 has created it. Get explicit approval, then set Status to Accepted and fill in Decision.
     3. Only then, scaffold a minimal project with one passing test.
   - **Brownfield:**
     1. Survey with parallel Explore agents: structure, build/test/lint commands, existing docs, stable surface (API, formats, CLI).
     2. Run the tests and record the baseline.
     3. Write `docs/ARCHITECTURE.md` as the system is.
     4. Draft INTENT from the evidence, marking each claim `(inferred)`. Confirm the claims one section at a time.
     5. Write `docs/adr/0001-adopt-helm.md`: baseline, gate commands, failure policy. Skip each pre-existing failing test explicitly with a `helm-baseline: <bead>` comment, plus `bd create "Fix baseline failure: <test>" -t bug -l baseline`.

3. **Scaffold.**
   1. Run `bd init --quiet --skip-agents` (skip it if `beads=1`), then `bd setup claude`.
   2. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs --phase files --main <branch> --ci <github|none>`, then fill every TODO it prints:
      - `.helm/check.sh`: real commands; `fmt` checks only; `test_fast` takes seconds;
      - `probity.config.mjs`: source **and** test globs;
      - the CI toolchain steps;
      - `.helm/public-paths`: the stable surface, confirmed with the human.
   3. Run `npm i -D @nizos/probity`. Create `{"private":true}` first if there's no `package.json`.
   4. `.helm/check.sh full` must pass.
   5. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs --phase gates`.

4. **Finish.** Run `.helm/check.sh fast`, then `git add -A && git commit -m "chore(helm): bootstrap workflow"`. Summarise in 5 lines and point to `/helm:milestone`. No feature work.
