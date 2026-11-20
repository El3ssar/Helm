---
name: decide
description: Walk the human through every pending decision — architectural choices, unblock requests, and milestone QA — and record their answers in beads, ADRs and the milestone doc.
disable-model-invocation: true
argument-hint: "[decision bead id]"
---

# /helm:decide

The human's inbox. Every item is a bead labeled `human`. Present each one so the human
can answer it in under a minute. They may answer differently from your recommendation:
record their answer faithfully, and if you think it's unsound, say so once, with the
reason, before recording it.

Only this command may run `bd human respond`, `bd human dismiss`, `bd epic close-eligible`,
`git merge`, `git tag` and `git push`. Each of them prompts the human, by design.

Target: $ARGUMENTS (default: all open items, oldest first, QA last).

## Ordinary decisions (`-t decision`, without the `qa` label)
For each item from `bd human list -s open`:
1. `bd show <id>`. Its design field holds the ADR draft, if one exists.
2. Present the decision in four parts:
   - the question;
   - why it matters, in two lines;
   - the options with their consequences;
   - your recommendation and its reason.

   Then ask with AskUserQuestion. Put your recommendation first, marked Recommended. The human can always type their own answer.
3. Record the answer:
   - `bd human respond <id> -r "<answer, in the human's words where given>"`.
   - ADR (when the bead has a draft): write `docs/adr/NNNN-<slug>.md` from it, using the next free number. Set `Status: Accepted` (or `Rejected`, which is kept as a record) and fill **Decision** with the human's answer. Add a line to the Decisions index in ARCHITECTURE.md.
   - If the answer changes the stable surface, update `.helm/public-paths`.
   - If the answer changes scope: adjust the epic's tasks (create, close as `superseded: <decision id>`, or re-link deps) and tell the human what changed.
   - If it resolves an INTENT open question: propose the INTENT edit. The write prompts the human.
4. Commit the doc changes: `docs(adr): <decision>`.

## Milestone QA (`qa` label)
1. Open the milestone doc's QA report. Go through the acceptance criteria one at a time:
   - show the evidence;
   - for demo steps, give the exact command. The human runs it, or asks you to run it and show the output;
   - ask: pass / fail / pass-with-note.
2. Show "Decisions made without escalation" and ask whether any should be reverted.
3. Then:
   - **All pass, none reverted:**
     1. `bd human respond <qa-id> -r "accepted"`.
     2. Fill **Verdict** and set `Status: Accepted`. Commit.
     3. `bd epic close-eligible`.
     4. Merge to main: open a PR (`git push -u origin <branch>` and `gh pr create`) if the project uses GitHub, otherwise `git switch <main> && git merge --no-ff <branch>`.
     5. `git tag mNN`.
     6. Set `active_milestone` to null in `.helm/state.json` and commit.
     7. Tell the human: `/helm:milestone` for the next one.
   - **Any fail or revert:**
     1. Create one task per failure under the epic. Its acceptance field is the human's stated expectation, quoted.
     2. `bd human dismiss <qa-id> --reason "rejected: <summary>"`.
     3. Record the verdict as rejected, with the reasons. Commit.
     4. Tell the human: `/helm:run` fixes them and brings QA back.
