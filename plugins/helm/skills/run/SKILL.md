---
name: run
description: Execute the active milestone test-first until done, blocked, or task limit; then prepare QA.
disable-model-invocation: true
argument-hint: "[max tasks]"
---
Execute the active milestone. Never wait for input; anything that needs the human becomes a decision bead. This is often a headless bypass session. Human-owned actions are denied here, so don't attempt them.

Task limit: $ARGUMENTS (empty = none). **Before ending, always write the first line of `.helm/run-status`** with one of: `continue | blocked | qa | stuck | idle`.

**0. Orient.**
1. If `.helm/state.json` has no `active_milestone`, write `idle` and stop.
2. Read the milestone doc and ARCHITECTURE, then `git switch <branch>`.
3. Run `bd list --parent EPIC --status in_progress --json` and resume any task it lists first.
4. If the tree is dirty and nothing is in progress: `git stash push -u -m "helm-orphan"` and file a triage bead.

**1. Loop** until the task limit is reached or nothing is ready:
1. `bd ready --parent EPIC --exclude-label human --json -n 1`, then `bd update <id> --claim`, then `bd show <id>`.
2. If an escalation trigger applies: create the decision bead, block the task on it, `bd update <id> --status open`, and go to the next task.
3. Plan with `superpowers:writing-plans`, then `bd update <id> --spec-id <plan>`.
4. Execute with `superpowers:subagent-driven-development` and `superpowers:test-driven-development`. Use `superpowers:systematic-debugging` when stuck.
5. Update ARCHITECTURE in the same commit if the structure changed.
6. Run `superpowers:verification-before-completion`, then `.helm/check.sh fast`, then commit with the `Bead:` trailer.
7. `bd close <id> -r "<change; tests; local decisions>"`.

**Stuck rule:** after 3 failed attempts, record what you tried with `bd update <id> --append-notes`, create "Decide: how to unblock <task>", and block the task on it. Then write `stuck` and end if you're running a single task; otherwise continue.

**2. End.** Use the first case that applies:
- an open `qa` bead exists: write `qa`;
- the limit was hit and work is still ready: write `continue`;
- only human blockers remain: write `blocked`, list each decision (question, options, recommendation, what it blocks), and point to `/helm:decide`;
- all tasks are closed: go to step 3.

**3. QA prep.**
1. `.helm/check.sh full`. On failure: create tasks and write `continue`.
2. `superpowers:requesting-code-review` on `git diff <main>...HEAD`, against the acceptance criteria. Findings become tasks; write `continue`.
3. Run the demo script and capture the output.
4. Fill the doc's QA report: each criterion as met or not met, with evidence; decisions made without escalation (from the close reasons); deviations; triage beads; limitations; and **Protected files changed**, which is the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/authority.mjs protected-diff <main>`.
5. Set Status to QA and commit `docs(milestone): QA report MNN`.
6. `bd create "QA: accept MNN" -t decision -l human,qa --parent EPIC`.
7. Write `qa`, and give a 5-line summary pointing to `/helm:decide`.
