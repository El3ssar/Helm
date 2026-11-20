---
name: run
description: Execute the active milestone task by task, test-first, until it is done or blocked on a human decision; then verify the whole milestone and write the QA report.
disable-model-invocation: true
argument-hint: "[max tasks this session]"
---

# /helm:run

Execute the active milestone autonomously, inside the boundaries the human approved.
Stop only for:
- human decisions;
- repeated failure;
- the end of the milestone, which is the QA gate.

Task limit for this session (optional): $ARGUMENTS

## 0. Preconditions
- Read `.helm/state.json`. If `active_milestone` is null, stop and point to `/helm:milestone`.
- `git switch <branch>` to the milestone branch. The tree must be clean.
- Read the milestone doc, `docs/ARCHITECTURE.md` and the CLAUDE.md helm block. They are your constraints.

## 1. Task loop
Repeat until no ready tasks remain or the task limit is reached:

1. **Pick**: `bd ready --parent EPIC --exclude-label human --json -n 1`, then `bd update <id> --claim`. Read it with `bd show <id>`.
2. **Escalation check**: before writing anything, check the task against the "Escalate, don't decide" list in CLAUDE.md.
   - If any item applies: create the decision bead (and a Proposed ADR if the decision is architectural), `bd dep add <id> <decision>`, `bd update <id> --status open`, and go to the next task.
3. **Plan**: use `superpowers:writing-plans` for this task only. Base it on the task's acceptance and design fields. Link the plan with `bd update <id> --spec-id <plan path>`.
4. **Execute**: use `superpowers:subagent-driven-development` to carry out the plan, with `superpowers:test-driven-development` for every step.
   - On a failure you don't understand: `superpowers:systematic-debugging`.
   - Probity rejections are instructions. Follow them; don't work around them.
5. **Docs**: if the change alters anything `docs/ARCHITECTURE.md` describes (components, conventions, vocabulary), update it in the same commit.
6. **Verify and commit**: `superpowers:verification-before-completion`, then `.helm/check.sh fast`, then commit:
   ```
   <type>(<scope>): <summary>

   Bead: <id>
   ```
7. **Close**: `bd close <id> -r "<what changed>; verified by <tests>; decided: <any local choices>"`.
8. **Discovered work**: anything out of scope becomes `bd create "<title>" -l triage --deps discovered-from:<id>`. Don't do it.

**Stuck rule:** after 3 failed attempts on the same task, stop working on it.
- Record what you tried with `bd update <id> --append-notes`.
- Create a decision bead: "Decide: how to unblock <task>", with the options you see.
- Block the task on it and continue with other work.

## 2. When the loop ends
**Blocked on decisions** (open tasks remain and only human-labeled blockers are left):
1. Stop. Commit nothing half-done.
2. Report each pending decision in one block: question, options, your recommendation, what it blocks.
3. Tell the human: `/helm:decide`, then `/helm:run` again.

**Task limit reached:** report progress (`bd epic status`) and stop.

**All tasks closed:** go to section 3.

## 3. Milestone verification (QA preparation)
1. `.helm/check.sh full`. It must pass.
2. Use `superpowers:requesting-code-review` on `git diff <main>...HEAD`, with the milestone doc's acceptance criteria as the review brief.
   - Each real finding becomes a task under EPIC. Return to the loop for those, then come back here.
3. Run the demo script yourself and capture the output.
4. Fill the milestone doc's **QA report**:
   - **Criteria:** one row per acceptance criterion: met or not met, with evidence (test names, demo output).
   - **Decisions made without escalation:** collected from the close reasons. This is what lets the human veto local choices.
   - **Deviations from plan**, **New work discovered** (triage bead ids), **Known limitations**.
5. Set `Status: QA`. Then `.helm/check.sh fast` and `git commit -m "docs(milestone): QA report MNN"`.
6. `bd create "QA: accept MNN" -t decision -l human,qa --parent EPIC -d "See <doc>#qa-report"`.
7. Final message: a 5-line summary of what was built, criteria met (X/Y), anything not met or deviated, and `/helm:decide` to run QA.
