#!/usr/bin/env node
// Helm's human-authority gate. Works in every permission mode, bypass included,
// because it is a hook, not a permission rule.
//
// Model: authority comes from what the human typed to start the current turn.
//   UserPromptSubmit  -> `record`: classify the prompt, store it per session.
//   PreToolUse        -> `check`:  deny protected actions the session's mode doesn't grant.
// No record (e.g. the hook didn't fire) means mode "none": fail closed.
//
//   node authority.mjs record|check            (hook input JSON on stdin)
//   node authority.mjs protected-diff <base>   (protected files changed since <base>)
//
// Enforcement is only active in helm projects (a .helm/state.json at or above cwd).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { execFileSync } from 'node:child_process'

// Files only the human (through /helm:init, /helm:decide or helm:override) may change.
export const PROTECTED = [
  'docs/INTENT.md',
  'docs/adr/**',
  '.helm/check.sh',
  '.helm/docs-sync.sh',
  '.helm/git-hooks/**',
  '.helm/public-paths',
  '.helm/loop.sh',
  'probity.config.mjs',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.github/workflows/**',
]

// Bash actions only the human may authorise.
const DECISION_CMDS = [/\bbd\s+human\s+(respond|dismiss)\b/, /\bbd\s+epic\s+close-eligible\b/]
const PUBLISH_CMDS = [/\bgit\s+(push|merge|tag)\b/, /\bgh\s+pr\s+(merge|create|close)\b/, /\bgh\s+api\b[^|;&]*\/pulls\b/]
// A Bash command that names a protected path and contains one of these is treated as writing it.
const WRITE_HINT = /\btee\b|\bsed\s+(-\w*i|--in-place)|\bperl\s+-\w*i|\b(mv|cp|rm|ln|install|truncate|dd|chmod|touch)\b|\bgit\s+(checkout|restore|rm|mv)\b|\b(python3?|node|ruby)\b/

// What each mode may do. `free` = the human typed something that isn't a helm command.
const GRANTS = {
  init: { edit: true, decide: false, publish: false },
  decide: { edit: true, decide: true, publish: true },
  override: { edit: true, decide: true, publish: true },
  milestone: { edit: false, decide: false, publish: false },
  run: { edit: false, decide: false, publish: false },
  status: { edit: false, decide: false, publish: false },
  free: { edit: false, decide: false, publish: false },
  none: { edit: false, decide: false, publish: false },
}

const globRe = (g) =>
  new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$')
const PROTECTED_RE = PROTECTED.map(globRe)
export const isProtected = (rel) => PROTECTED_RE.some((r) => r.test(rel))

function helmRoot(from) {
  let d = resolve(from)
  for (;;) {
    if (existsSync(join(d, '.helm', 'state.json'))) return d
    const up = dirname(d)
    if (up === d) return null
    d = up
  }
}

export function classifyPrompt(prompt) {
  const p = (prompt ?? '').trim()
  const m = p.match(/^\/(?:helm:)?(init|milestone|run|decide|status)\b/)
  if (m) return m[1]
  if (/\bhelm:override\b/.test(p)) return 'override'
  return 'free'
}

// Returns null (allowed) or a reason string.
export function judge(mode, tool, input, root) {
  const g = GRANTS[mode] ?? GRANTS.none
  const how = 'Only the human grants this: run /helm:decide, or include "helm:override" in your own message.'

  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const f = input.file_path ?? input.notebook_path
    if (!f) return null
    const rel = relative(root, isAbsolute(f) ? f : resolve(root, f))
    if (!rel.startsWith('..') && isProtected(rel) && !g.edit)
      return `helm: ${rel} is protected (intent, decisions, gates, CI). Propose the change as a decision bead instead. ${how}`
    return null
  }

  if (tool === 'Bash') {
    const cmd = input.command ?? ''
    if (DECISION_CMDS.some((r) => r.test(cmd)) && !g.decide)
      return `helm: answering decisions and closing milestones is the human's. ${how}`
    if (PUBLISH_CMDS.some((r) => r.test(cmd)) && !g.publish)
      return `helm: push, merge, tag and PR changes are the human's. ${how}`
    if (!g.edit) {
      // Running the gates is fine; only writing them is protected.
      const c = cmd.replace(/(^|[;&|(])(\s*)((ba)?sh\s+)?(\.\/)?\.helm\/(check|loop|docs-sync)\.sh\b/g, '$1$2')
      const hit = PROTECTED.map((p) => p.replace(/\/\*\*$/, '/')).find((p) => c.includes(p))
      if (hit) {
        const esc = hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const redirected = new RegExp(`>>?\\s*['"]?\\S*${esc}`).test(c)
        const otherWrite = WRITE_HINT.test(c.replace(/(^|[^<2&])>>?\s*\S+/g, '$1'))
        if (redirected || otherWrite) return `helm: this command appears to modify ${hit}, which is protected. ${how}`
      }
    }
  }
  return null
}

const sessionFile = (id) => join(process.env.CLAUDE_PLUGIN_DATA ?? join(process.env.HOME ?? '/tmp', '.helm-authority'), 'sessions', `${id}.json`)

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

const [cmd, arg] = process.argv.slice(2)

if (cmd === 'record') {
  const ev = readStdin()
  // Record in every project: /helm:init starts before .helm/state.json exists, and its grant
  // must already be on file when the scaffold creates it. Enforcement (`check`) stays helm-only.
  if (!ev.session_id) process.exit(0)
  const f = sessionFile(ev.session_id)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify({ mode: classifyPrompt(ev.prompt), at: new Date().toISOString() }))
  process.exit(0)
}

if (cmd === 'check') {
  const ev = readStdin()
  const root = helmRoot(ev.cwd ?? process.cwd())
  if (!root) process.exit(0)
  let mode = 'none'
  try {
    mode = JSON.parse(readFileSync(sessionFile(ev.session_id), 'utf8')).mode
  } catch {}
  const reason = judge(mode, ev.tool_name, ev.tool_input ?? {}, root)
  if (reason)
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
    )
  process.exit(0)
}

if (cmd === 'protected-diff') {
  const root = helmRoot(process.cwd())
  if (!root) process.exit(0)
  const base = arg ?? 'main'
  const out = execFileSync('git', ['-C', root, 'diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  const hits = out.split('\n').filter((f) => f && isProtected(f))
  process.stdout.write(hits.join('\n') + (hits.length ? '\n' : ''))
  process.exit(0)
}

if (cmd && cmd !== 'test') {
  console.error('usage: authority.mjs record|check|protected-diff [base]')
  process.exit(2)
}
