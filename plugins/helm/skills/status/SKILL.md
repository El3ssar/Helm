---
name: status
description: One-screen project picture — intent, milestone progress, waiting-on-you, next work, health.
disable-model-invocation: true
---
Read-only. Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/status.sh` and render one screen with no extra commentary:
1. intent, in one line;
2. milestones (id, status, goal), marking the active one;
3. active progress as done/total, plus a mermaid graph from `bd dep tree <epic> --direction both --format mermaid`, coloured by status;
4. waiting on you (decision, and what it blocks), then `→ /helm:decide`;
5. up to 5 ready tasks;
6. the triage count;
7. ADRs, flagging Proposed;
8. branch, clean or dirty, last commit, and how far ahead of main.

No state file means: point to `/helm:init`.
