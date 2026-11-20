---
name: milestone
description: Plan the next milestone with the human and build its beads task graph.
disable-model-invocation: true
argument-hint: "[goal]"
---
Plan the next milestone with the human. Goal: $ARGUMENTS

1. **Preconditions.**
   - The tree is clean and on main.
   - If `.helm/state.json` has an active milestone with open tasks, ask whether to finish it or abandon it (abandoning closes the tasks with reason `abandoned: <why>`).

2. **Context.** Read INTENT, ARCHITECTURE, accepted ADRs, and the last QA report. Then run `bd ready -l triage --plain`, `bd ready -l baseline --plain`, and `bd human list -s open`.

3. **Shape** the milestone with the human, one item at a time:
   - goal (one observable sentence);
   - scope in and out (pull in or defer the triage and baseline beads);
   - numbered acceptance criteria, each one testable;
   - demo script;
   - open decisions.

   Keep it QA-able in under an hour; split if larger. Write `docs/milestones/MNN-<slug>.md` from its TEMPLATE, and get approval.

4. **Graph.** Each task is one test-first increment of about 300 lines or less.
   ```
   bd create "MNN: <title>" -t epic -p 1 --spec-id <doc> -d "<goal>" --silent
   bd create "<task>" -t task --parent EPIC --acceptance "<tests>" --design "<files; approach; criteria #>" --silent
   bd create "Decide: <q>" -t decision -l human --parent EPIC -d "..." [--design "<ADR draft>"]
   bd dep add <task> <prerequisite-or-decision>
   ```
   The last task is "Update ARCHITECTURE.md and docs", depending on all the others.

5. **Review.**
   - Show `bd dep tree EPIC --direction both`, a table (id | task | criteria | depends on), and the open decisions.
   - Ask Approve / Revise, and iterate until approved.
   - If decisions are open, offer `/helm:decide`.

6. **Activate.**
   1. `git switch -c mNN-<slug>`.
   2. Set `active_milestone` in `.helm/state.json` to `{"id","doc","branch"}`, pretty-printed.
   3. In the doc, set `Epic:` and `Branch:`, and change Status to Active.
   4. Run `.helm/check.sh fast`, then `git add -A && git commit -m "docs(milestone): plan MNN <title>"`.
   5. Point to `/helm:run` or `.helm/loop.sh`.
