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
Superpowers and beads install as dependencies. Also needed on the machine: the `bd` CLI, Node ≥ 20, and git.

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
It runs `/helm:run 1` in a fresh headless session per task (`--permission-mode dontAsk`).
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
| `.helm/loop.sh`, `.helm/loop-settings.json` | you | headless loop and its allow-list (toolchain commands only) |
| `.helm/public-paths` | you | stable surface; changes need an ADR and doc updates |
| `probity.config.mjs` | you | TDD on source+tests, check-before-commit, no hook bypass |

## Gates

| Layer | Enforces | Bypassable by the agent? |
|---|---|---|
| Permission `ask` rules | edits to INTENT, ADRs, gates, CI; `push`, `merge`, `tag`; answering decisions; closing epics | no, you are prompted every time (even in auto mode) |
| Probity hook | failing test before code; `.helm/check.sh` before `git commit`; no `--no-verify`, force-push, `reset --hard` | no |
| Git hooks | `check.sh fast` on commit; Conventional Commits with a `Bead: <id>` trailer on code changes | no (`--no-verify` is blocked) |
| CI | `check.sh full`, plus a docs-sync check on the stable surface | no |

Don't run sessions with `--dangerously-skip-permissions`: it disables the `ask` layer, and with it your control over decisions.
