---
name: run
description: Execute the active milestone task by task, test-first, until it is done, blocked on a human decision, or the task limit is reached; at the end of the milestone, verify it and write the QA report. Works interactively and headless (.helm/loop.sh runs it one task per session).
disable-model-invocation: true
argument-hint: "[max tasks this session]"
---

# /helm:run

Execute the active milestone autonomously, inside the boundaries the human approved.
Never wait for input. Anything that needs the human becomes a decision bead, and you
move on. The session may be headless (`.helm/loop.sh`), in which case every
human-gated action is denied, not prompted. Don't attempt one.

Task limit for this session: $ARGUMENTS (empty = no limit).

Before you end the session, **always** write the outcome as the first line of
`.helm/run-status`, using one of these words:
`continue | blocked | qa | stuck | idle`. The loop script depends on it.

## 0. Orient
1. Read `.helm/state.json`. If `active_milestone` is null: write `idle` and stop.
2. Read the milestone doc, `docs/ARCHITECTURE.md` and the CLAUDE.md helm block. They are your constraints.
3. `git switch <branch>`.
4. **Recover from a crashed session:**
   - `bd list --parent EPIC --status in_progress --json`. Any task listed there was left by a session that died. Resume it first (go to step 3 of the loop), and keep whatever uncommitted work belongs to it.
   - If the tree is dirty and no task is in progress: `git stash push -u -m "helm-orphan <date>"`, record the stash in a triage bead, and continue.

## 1. Task loop
Repeat until the task limit is reached or no ready task remains:

1. **Pick**: `bd ready --parent EPIC --exclude-label human --json -n 1`, then `bd update <id> --claim`. Read it with `bd show <id>`.
2. **Escalation check**: check the task against the "Escalate, don't decide" list in CLAUDE.md before writing anything.
   - If any item applies, create the decision bead:
     - `-d` holds Question / Context / Options with consequences / Recommendation / Blocks;
     - `--design` holds the full ADR draft when the decision is architectural. `/helm:decide` turns it into the ADR file. Never write to `docs/adr/` yourself.
   - Then `bd dep add <id> <decision>` and `bd update <id> --status open`, and go back to step 1.
3. **Plan**: use `superpowers:writing-plans` for this task only, from its acceptance and design fields. Link the plan with `bd update <id> --spec-id <plan path>`.
4. **Execute**: use `superpowers:subagent-driven-development` to carry out the plan, with `superpowers:test-driven-development` for every step.
   - On a failure you don't understand: `superpowers:systematic-debugging`.
   - Probity rejections are instructions. Follow them; don't work around them.
   - Permission denials mean you are outside your remit. Escalate; never retry another way.
5. **Docs**: if the change alters anything `docs/ARCHITECTURE.md` describes, update it in the same commit.
6. **Verify and commit**: `superpowers:verification-before-completion`, then `.helm/check.sh fast`, then commit:
   ```
   <type>(<scope>): <summary>

   Bead: <id>
   ```
7. **Close**: `bd close <id> -r "<what changed>; verified by <tests>; decided: <any local choices>"`.
8. **Discovered work**: anything out of scope becomes `bd create "<title>" -l triage --deps discovered-from:<id>`. Don't do it.

**Stuck rule:** after 3 failed attempts on the same task, stop working on it.
- Record what you tried with `bd update <id> --append-notes "..."`.
- Create a decision bead "Decide: how to unblock <task>", with the options you see.
- Block the task on it.
- If you are in headless single-task mode, write `stuck` and end. Otherwise continue with other work.

## 2. When the loop ends
Pick the first case that applies:

0. **An open `qa` bead exists under EPIC**: write `qa` and stop. QA is already waiting on the human.
1. **Task limit reached and ready tasks remain**: write `continue`. Report progress with `bd epic status`.
2. **Open tasks remain, but all are blocked by human decisions**: write `blocked`. Report each pending decision as question / options / recommendation / what it blocks, then: run `/helm:decide`.
3. **Every task under EPIC is closed** (except an open `qa` bead): go to section 3.

## 3. Milestone verification (QA preparation)
1. `.helm/check.sh full`. It must pass. If it doesn't, create a task for each problem and write `continue`.
2. Use `superpowers:requesting-code-review` on `git diff <main>...HEAD`, with the milestone doc's acceptance criteria as the review brief.
   - Each real finding becomes a task under EPIC; then write `continue` and end.
3. Run the demo script yourself and capture the output.
4. Fill the milestone doc's **QA report**:
   - **Criteria:** one row per acceptance criterion: met or not met, with evidence.
   - **Decisions made without escalation:** collected from the close reasons.
   - **Deviations from plan**, **New work discovered** (triage bead ids), **Known limitations**.
5. Set `Status: QA`. Then `.helm/check.sh fast` and `git commit -m "docs(milestone): QA report MNN"`.
6. `bd create "QA: accept MNN" -t decision -l human,qa --parent EPIC -d "See <doc>, section QA report"`.
7. Write `qa`. Final message: a 5-line summary (built, criteria met X/Y, deviations), then `/helm:decide` to run QA.
