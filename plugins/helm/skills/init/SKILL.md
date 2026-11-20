---
name: init
description: Set up helm in this repository. Detects whether it is an empty project or an existing codebase and installs intent docs, beads, TDD enforcement, git hooks and CI accordingly.
disable-model-invocation: true
argument-hint: "[short description of the project, for empty repos]"
---

# /helm:init

Goal: leave the repo with a written intent, a truthful architecture map, one quality
gate (`.helm/check.sh`) wired into git hooks, Probity and CI, and beads ready for
milestone planning. The human approves the intent and every decision. You do the
rest.

Plugin files live at `${CLAUDE_PLUGIN_ROOT}`. Project argument: $ARGUMENTS

## 1. Detect

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect.sh"` and read the result.

- `mode=initialized`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --phase gates`. It is idempotent, and on a fresh clone it rewires the machine-local git hooks and the Probity hook. Then stop and point to `/helm:status`.
- `tool_bd=0` or `tool_node=0`: stop and say what to install (`bd`: see beads README; Node ≥ 20 for Probity).
- `has_git=0`: run `git init -b main`.

Tell the user in one line which mode you detected and why (e.g. "existing codebase: 212 Rust files, Cargo workspace, tests/ present"). Then use AskUserQuestion with these two questions:
1. Confirm the mode: greenfield or brownfield (put the detected one first, marked Recommended).
2. CI: GitHub Actions or "none yet". The local gate works either way.

## 2. Intent and baseline

### Greenfield
1. Use `superpowers:brainstorming` to interview the user about the project, scoped to the content of `docs/INTENT.md`: purpose, outcomes, non-goals, invariants, quality bar, open questions. Do not design features yet. Ask one question at a time and push back on vague outcomes or invariants that can't be tested.
2. Write `docs/INTENT.md` from `${CLAUDE_PLUGIN_ROOT}/templates/docs/INTENT.md`. The write triggers a permission prompt, which is how the user approves it.
3. Stack decision: propose the language, build tool, test framework (plus a property-testing library where the domain is mathematical) and formatter/linter as `docs/adr/0001-toolchain.md` (Status: Proposed, using the ADR template). Present it. On approval, set `Status: Accepted` and fill in Decision.
4. Scaffold the smallest buildable project for that stack with **one** real test that passes. No features.

### Brownfield
1. Survey with parallel `Explore` subagents: (a) module structure and data flow, (b) how to build, test, lint and format, from manifests, CI files, Makefiles and READMEs, (c) existing docs and stated goals, (d) the stable surface: public API, file formats, CLI, protocols.
2. Run the existing build and test commands. Record the baseline: number passing, failing, skipped, and runtime.
3. Write `docs/ARCHITECTURE.md` describing the system **as it is**, using the template.
4. Draft `docs/INTENT.md` inferred from the code and docs. Mark every inferred statement `(inferred)`. Walk the user through it section by section with AskUserQuestion, and remove each `(inferred)` mark only after the user confirms that statement.
5. Write `docs/adr/0001-adopt-helm.md` covering the baseline, the quality gate commands, and how pre-existing failures are handled.
   - If the baseline is red, the gate must still be green from day one, or nobody can commit. Exclude each failing test explicitly, using the runner's own skip/ignore mechanism with a comment `helm-baseline: <bead-id>`. Create one bead per excluded test: `bd create "Fix baseline failure: <test>" -t bug -l baseline`. Never exclude a test silently.

## 3. Scaffold (both modes)

The gates fail closed on an unconfigured project, so they go live last.

1. `bd init --quiet --skip-agents` (skip if `beads=1`). The beads plugin primes sessions itself.
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --phase files --main <branch> --ci <github|none>`. It is idempotent. It prints what was created or kept and a TODO list.
3. Fill each TODO it prints:
   - `.helm/check.sh`: replace every `HELM_UNSET` with the real command for this project. `fmt` checks and never rewrites. `test_fast` must finish in seconds. `docs` is `true` only if the language has no doc tooling. Run `.helm/check.sh fast` to prove the commands work.
   - `probity.config.mjs`: replace `HELM_SOURCE_GLOBS` with an array covering the source **and** test paths (e.g. `['src/**', 'tests/**']`, `['**/*.lean']`).
   - `.github/workflows/helm.yml`: replace `# HELM_TOOLCHAIN_STEPS` with the official setup actions for the toolchain, pinned to the versions in ADR-0001 or the repo's toolchain files.
   - `.helm/loop-settings.json`: replace `"HELM_TOOLCHAIN_ALLOW"` with one `Bash(...)` rule per toolchain command that agents need to build and test in this project. Examples: `"Bash(cargo *)"`; `"Bash(lake *)"`; `"Bash(uv run *)"`, `"Bash(python3 -m pytest *)"`. Keep it to build, test and format tools. Headless sessions can run nothing else, and that is the point.
   - `.helm/public-paths`: brownfield, the stable surface you found in step 2. Greenfield, leave it empty until the first public API exists. Show the user the list.
4. `npm install -D @nizos/probity`. If there is no `package.json`, create `{"private": true}` first. Record in ADR-0001 that this is the cost of language-agnostic TDD enforcement.
5. `.helm/check.sh full` must pass. Fix the configuration, not the gate.
6. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --phase gates`. It refuses while any placeholder remains. From here on, git hooks and Probity are live.

## 4. Commit and hand over

1. On the main branch: `.helm/check.sh fast`, then `git add -A && git commit -m "chore(helm): bootstrap workflow"`.
2. Reply with a short summary:
   - mode and stack;
   - what the gate checks;
   - the human gates: edits to INTENT, ADRs, the gates and CI, plus push, merge, tag and answering decisions, all prompt the user;
   - brownfield only: the baseline beads.
   - Next step: `/helm:milestone` to plan the first milestone, then `/helm:run` in a session or `.helm/loop.sh` in a terminal.

Do not start any feature work in this command.
