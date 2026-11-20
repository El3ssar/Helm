---
name: decide
description: Walk the human through pending decisions and milestone QA; record the answers.
disable-model-invocation: true
argument-hint: "[bead id]"
---
The human's inbox. Only here may decisions be answered, milestones closed, ADRs/INTENT/gates/CI edited, and branches pushed, merged or tagged. The session may be in bypass mode, so act only on the human's answer in chat, never on the fact that a write succeeded. If you think an answer is unsound, say so once, then record it as given.

Items: $ARGUMENTS, or else `bd human list -s open` (oldest first, QA last).

**Decision items.**
1. `bd show <id>`. Ask following the "Asking the human" rule in CLAUDE.md; the evidence comes from the bead and the code.
2. Record the answer with `bd human respond <id> -r "<answer>"`.
3. If the bead's design field holds an ADR draft: write it to `docs/adr/NNNN-<slug>.md` (Accepted or Rejected, with the Decision filled in) and index it in ARCHITECTURE.
4. Then, as needed: update `.helm/public-paths`; adjust the tasks (create them, or close as `superseded: <id>`, or re-link); propose INTENT edits and apply them only once confirmed.
5. Commit `docs(adr): ...`.

**QA items** (label `qa`).
1. Go through each acceptance criterion with its evidence. For demo steps, give the exact command; the human runs it, or you run it and show the output. The verdict for each is pass, fail, or pass-with-note.
2. Show the "decisions made without escalation", and ask whether to revert any.
3. Show a fresh `node ${CLAUDE_PLUGIN_ROOT}/scripts/authority.mjs protected-diff <main>`. Each file it lists must be explained by an accepted decision; one that isn't counts as a failed criterion.
4. **All pass and nothing reverted:**
   1. `bd human respond <qa> -r accepted`.
   2. In the doc, fill the Verdict and set Status to Accepted. Commit.
   3. `bd epic close-eligible`.
   4. If the project is on GitHub: `git push -u origin <branch>` and `gh pr create`. Otherwise: `git switch <main> && git merge --no-ff <branch>`.
   5. `git tag mNN`.
   6. Set `active_milestone` to null and commit.
   7. Point to `/helm:milestone`.
5. **Otherwise:**
   1. Create one task per failure or requested revert, with the human's words as its acceptance.
   2. `bd human dismiss <qa> --reason "rejected: ..."`.
   3. Record the verdict and commit.
   4. Point to `/helm:run`.
