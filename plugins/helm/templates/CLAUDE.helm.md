<!-- helm:begin (managed by /helm:init; edit the template, not this block) -->
## Helm workflow

The human owns intent and high-level decisions. You own execution inside an approved milestone.

### Sources of truth
- `docs/INTENT.md`: purpose, non-goals, invariants. Human-owned; never edit unless told to.
- `docs/adr/`: decisions. You may draft one with `Status: Proposed`; only the human accepts.
- `docs/ARCHITECTURE.md`: how the system is built now. Keep it true in the same commit as the change.
- `docs/milestones/`: one brief + QA report per milestone.
- beads (`bd`): every unit of work. No TODO lists in markdown or code comments.
- `.helm/state.json`: the active milestone (epic id, doc, branch).

### Escalate, don't decide
Create a decision bead and stop working on what it blocks when a task would:
1. change anything matched by `.helm/public-paths` (stable surface);
2. add a third-party dependency, service, or toolchain;
3. contradict `docs/INTENT.md` or an accepted ADR, or depend on one of its open questions;
4. find an acceptance criterion ambiguous, wrong, or infeasible;
5. need work outside the milestone scope to finish.

```
bd create "Decide: <question>" -t decision -l human --parent <epic> -d "<body>"
bd dep add <blocked-task> <decision-id>
```
Body: Question / Context / Options (with consequences) / Recommendation / Blocks / ADR (if architectural: draft `docs/adr/NNNN-*.md`, Status: Proposed).
Everything else you decide yourself, and record it in the task's close reason.

### Execution rules
- Work only on the active milestone: `bd ready --parent <epic> --exclude-label human`.
- Test first, always: failing test, minimal code, refactor. Probity blocks code written without a failing test.
- Run `.helm/check.sh fast` right before every commit. Never `--no-verify`.
- Every commit is `<type>(<scope>): <summary>` with trailer `Bead: <id>`. A task may take several commits; each one must pass the gate.
- Out-of-scope work you notice: `bd create "<title>" -l triage --deps discovered-from:<id>`; do not do it now.
- Close with `bd close <id> -r "<what changed; how verified; local decisions taken>"`.
- Never push, merge, tag, close milestone epics, or answer human decisions. Those prompt the human by design.
<!-- helm:end -->
