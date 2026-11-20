// Agent discipline, enforced on every write and shell command (Probity).
// Managed by /helm:init. HELM_SOURCE_GLOBS is replaced with this project's
// source + test globs; TDD is judged across both, so tests must be included.
import {
  defineConfig,
  enforceTdd,
  requireCommand,
  forbidCommandPattern,
} from '@nizos/probity'

export default defineConfig({
  rules: [
    { files: HELM_SOURCE_GLOBS, rules: [enforceTdd()] },

    requireCommand({
      before: { kind: 'command', match: /\bgit\s+commit\b/ },
      command: /\.helm\/check\.sh\s+(fast|full)\b/,
      after: { kind: 'write' },
      reason: 'Run `.helm/check.sh fast` after your last edit and before committing.',
    }),

    forbidCommandPattern({
      match: /--no-verify\b|\bcore\.hooksPath\b/,
      reason: 'Git hooks are the quality gate; never bypass or repoint them.',
    }),

    forbidCommandPattern({
      match: /\bgit\s+(push\b.*\s(--force\b|-f\b|--force-with-lease\b)|reset\s+--hard\b|clean\s+-\w*f)/,
      reason: 'Destructive git operations are reserved for the human.',
    }),
  ],
})
