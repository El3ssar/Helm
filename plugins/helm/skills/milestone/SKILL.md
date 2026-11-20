---
name: milestone
description: Plan the next milestone with the human — goal, scope, acceptance criteria, demo script — and turn it into a beads epic with a dependency graph of test-first tasks and explicit human decisions.
disable-model-invocation: true
argument-hint: "[what you want this milestone to achieve]"
---

# /helm:milestone

You and the human agree on **what** the next milestone delivers and **how it will be judged**.
Then you decompose it into a task graph the agents can execute without coming back,
except at the decision points you list explicitly. This is where the human spends
their attention, so make it count: be concrete, challenge vague goals, and surface risks now.

Requested focus: $ARGUMENTS

## 0. Preconditions
- `.helm/state.json` exists (otherwise: run `/helm:init`).
- If `active_milestone` is set and its epic still has open children: stop, show `bd epic status`, and ask whether to finish it (`/helm:run`) or abandon it. Abandoning closes the open children with reason `abandoned: <why>`, after the human confirms.
- The working tree is clean, on the main branch.

## 1. Load context (read, don't summarize back)
`docs/INTENT.md`, `docs/ARCHITECTURE.md`, accepted ADRs, the last milestone's QA report,
`bd ready -l triage --plain`, `bd ready -l baseline --plain`, `bd human list -s open`.

## 2. Shape the milestone with the human
Use `superpowers:brainstorming`, scoped to one milestone:
- **Goal**: one sentence stating what becomes true. Reject goals that can't be observed.
- **Scope in / out**: pull in relevant triage or baseline beads, or explicitly defer them.
- **Acceptance criteria**: numbered, each verifiable by an automated test or a demo step. These are the QA contract.
- **Demo script**: exact commands the human will run at QA and what they should see.
- **Open decisions and risks**: anything that depends on an INTENT open question, a new dependency, or a stable-surface change.

Size: one milestone = something the human can QA in under an hour. If it's bigger, split it and plan only the first part.

Write `docs/milestones/MNN-<slug>.md` from `docs/milestones/TEMPLATE.md`. NN is the next number, zero-padded. Show it to the human and revise it until they approve.

## 3. Decompose into the graph
Each task is one test-first increment, committable on its own, typically under ~300 changed lines. Each one gets:
- a title in the imperative;
- `--acceptance`: the specific tests that will exist and pass;
- `--design`: files or modules touched, approach, and the criterion number(s) it serves.

Create, in this order:
```
bd create "MNN: <title>" -t epic -p 1 --spec-id docs/milestones/MNN-<slug>.md -d "<goal>" --silent   # -> EPIC
bd create "<task>" -t task --parent EPIC --acceptance "..." --design "..." --silent                # per task
bd create "Decide: <q>" -t decision -l human --parent EPIC -d "<Question/Context/Options/Recommendation/Blocks>"   # per open decision
bd dep add <task> <prerequisite>          # task ordering
bd dep add <task> <decision>              # tasks that need the answer
```
Add a final task "Update ARCHITECTURE.md and docs for MNN" that depends on every other task.
For each architectural decision bead, put the full ADR draft (`docs/adr/TEMPLATE.md` format) in its `--design` field. `/helm:decide` writes the file once the human answers.

## 4. Review the graph with the human
Show:
1. `bd dep tree EPIC --direction both`
2. A table: id | task | criteria served | depends on.
3. The decisions that will pause the run, and what each one blocks.

Ask with AskUserQuestion: Approve / Revise. Iterate until approved. If decisions are open, offer to answer them now with `/helm:decide`, so the run won't stall.

## 5. Activate
1. `git switch -c mNN-<slug>`.
2. Set `active_milestone` in `.helm/state.json`, pretty-printed:
   `{"id": "EPIC", "doc": "docs/milestones/MNN-<slug>.md", "branch": "mNN-<slug>"}`.
3. Set the milestone doc's `Epic:` and `Branch:` fields and change `Status: Planned` to `Status: Active`.
4. `.helm/check.sh fast`, then `git add -A && git commit -m "docs(milestone): plan MNN <title>"`.
5. Tell the human: `/helm:run` executes it, and you'll stop at decisions and at QA.
