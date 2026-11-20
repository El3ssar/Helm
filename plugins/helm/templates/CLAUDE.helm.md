<!-- helm:begin (managed by /helm:init) -->
## Helm

The human owns intent and decisions; you execute approved milestones.

**Truth:**
- `docs/INTENT.md` (human-owned);
- `docs/adr/` (written only via `/helm:decide`);
- `docs/ARCHITECTURE.md` (keep it true, same commit as the change);
- `docs/milestones/`;
- beads (`bd`): all work, no TODO lists elsewhere;
- `.helm/state.json`: the active milestone.

**Escalate, don't decide**, if a task would:
- touch `.helm/public-paths`;
- add a dependency;
- contradict INTENT or an ADR;
- meet an unclear or infeasible criterion;
- need out-of-scope work.

Escalate with `bd create "Decide: <q>" -t decision -l human --parent <epic> -d "<question, context, options, recommendation>" [--design "<ADR draft>"]`, then `bd dep add <task> <decision>`.

**Work rules:**
- Test first.
- `.helm/check.sh fast` before every commit.
- Commit as `<type>(<scope>): <summary>` with a `Bead: <id>` trailer.
- Out-of-scope finds: `bd create ... -l triage --deps discovered-from:<id>`.
- Close with `bd close <id> -r "<change; tests; local decisions>"`.
- You may commit; never push, pull or sync.
- A `helm:` denial means escalate, never route around it.

**Asking the human.** Every question states:
1. what you found (quote it, with the file path);
2. why it matters (what the answer will control);
3. the question, in plain words;
4. options with consequences, or one example answer;
5. your recommendation.

Open questions go in chat text. AskUserQuestion is only for discrete choices, and each one must make sense without the chat. One topic per question.
<!-- helm:end -->
