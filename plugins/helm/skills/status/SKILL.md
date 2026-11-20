---
name: status
description: One-screen picture of the project — intent, milestone progress, what agents can do next, what is waiting on the human, recent decisions and health.
disable-model-invocation: true
---

# /helm:status

Read-only. Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/status.sh"` and render its output as
one screen, in this order and with no other commentary:

1. **Intent**: the purpose in one line.
2. **Milestones**: one line each: id, status, goal. Mark the active one.
3. **Active milestone**:
   - progress as done/total tasks;
   - a mermaid graph of the epic, built from `bd dep tree <epic> --direction both --format mermaid`. Colour nodes by status (closed, in progress, ready, blocked, human).
4. **Waiting on you**: each open human decision in one line, with what it blocks. If any exist, end with `→ /helm:decide`.
5. **Agents can do next**: up to 5 ready tasks.
6. **Triage**: count, plus the 3 oldest titles.
7. **Decisions**: the ADRs with their status. Flag any that are still Proposed.
8. **Health**:
   - the branch, and whether the tree is clean;
   - the last commit;
   - whether the active branch is ahead of main.

If `.helm/state.json` is missing, say so and point to `/helm:init`.
