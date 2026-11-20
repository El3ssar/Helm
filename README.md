# helm

Human-on-the-loop, milestone-driven, test-first development with Claude Code, for any
language. You own the intent and the high-level decisions. Agents execute milestones you
approved and stop when they need a decision from you, and again at QA.

Built on [Superpowers](https://github.com/obra/superpowers) (how a task is done),
[beads](https://github.com/gastownhall/beads) (what to do, as a dependency graph), and
[Probity](https://github.com/nizos/probity) (deterministic TDD and commit rules).

## Install

```
/plugin marketplace add <this repo>
/plugin install helm@helm
```
Superpowers installs as a dependency. Also needed on the machine: the [`bd` CLI](https://github.com/gastownhall/beads#-quick-start), Node ≥ 20, and git.
The beads Claude Code plugin is not needed: `/helm:init` runs `bd setup claude`, which wires beads into each project.

Probity is **not** used as a Claude Code plugin. `/helm:init` installs it per project
(`npm i -D @nizos/probity`) and registers its hook in the project's `.claude/settings.json`.
The Probity plugin hooks every project and fails closed where no config exists, so
uninstall it if you added it: `/plugin uninstall probity@probity`.

## Loop

```
/helm:init        once per repo; detects empty vs existing codebase
/helm:milestone   you + agent: goal, scope, acceptance criteria, demo -> task graph
/helm:run         agent executes the milestone test-first; stops at decisions and at QA
/helm:decide      your inbox: architectural decisions, unblock requests, milestone QA
/helm:status      one-screen picture: intent, progress graph, waiting-on-you, health
```

Unattended execution, from a terminal: `.helm/loop.sh [-n sessions] [-b usd-per-session] [-m model]`.
It runs `/helm:run 1` in a fresh headless session per task, in bypass mode.
It stops when the milestone needs you (decision or QA), when a task is stuck twice, or at the session limit.

## What ends up in your repo

| Path | Owner | Purpose |
|---|---|---|
| `docs/INTENT.md` | you | purpose, non-goals, invariants, open questions |
| `docs/adr/` | you accept, agent drafts | decisions |
| `docs/ARCHITECTURE.md` | agent, every commit | true map of the system |
| `docs/milestones/MNN-*.md` | both | brief, acceptance criteria, QA report, verdict |
| `.beads/` | agent | tasks, dependencies, decisions (`human` label) |
| `.helm/check.sh` | you | the one quality gate: `fast` (pre-commit) / `full` (CI, pre-QA) |
| `.helm/loop.sh` | you | headless loop: one fresh bypass-mode session per task |
| `.helm/public-paths` | you | stable surface; changes need an ADR and doc updates |
| `probity.config.mjs` | you | TDD on source+tests, check-before-commit, no hook bypass |

## Gates

Helm is built for bypass mode. Every gate is a hook or a git/CI check, so none of them depends on permission prompts.

| Layer | Enforces |
|---|---|
| **Authority hook** (helm plugin) | INTENT, ADRs, gates, CI and settings edits; answering decisions; closing milestones; push, merge, tag and PRs. Allowed only in a turn **you** started with `/helm:decide`, `/helm:init` (edits only), or a message containing `helm:override`. Denied in `/helm:run` and in the loop. Fails closed. |
| **Probity hook** (per project) | failing test before code; `.helm/check.sh` before `git commit`; no `--no-verify`, force-push or `reset --hard` |
| **Git hooks** | `check.sh fast` on every commit; Conventional Commits with a `Bead: <id>` trailer on code changes |
| **CI** | `check.sh full`, plus docs-sync on the stable surface |
| **QA backstop** | every QA report lists the protected files the branch changed; an unexplained one fails QA |

What hooks can't do: in-process guards stop an agent that is overreaching, not one that is deliberately evading them. Shell writes to protected files are detected heuristically. That's why the QA backstop exists: whatever got through shows up in front of you before merge.
