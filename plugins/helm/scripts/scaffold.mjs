#!/usr/bin/env node
// Deterministic part of /helm:init. Idempotent: re-running never clobbers human edits.
//
//   node scaffold.mjs --phase files --main <branch> --ci github|none
//     Copies missing templates, merges permission rules into .claude/settings.json,
//     (re)writes the helm block in CLAUDE.md. Leaves placeholders for the agent:
//     HELM_UNSET in .helm/check.sh, HELM_SOURCE_GLOBS in probity.config.mjs,
//     HELM_TOOLCHAIN_STEPS in the CI workflow.
//
//   node scaffold.mjs --phase gates
//     Refuses while placeholders remain or Probity is not installed. Then points git at
//     .helm/git-hooks and registers the Probity PreToolUse hook in .claude/settings.json.
//     Gates go live last because both fail closed on an unconfigured project.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, xs) => (a.startsWith('--') ? [...acc, [a.slice(2), xs[i + 1]]] : acc), []),
)
const root = args.root ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const phase = args.phase ?? 'files'
const main = args.main ?? 'main'
const ci = args.ci ?? 'none'
if (!['files', 'gates'].includes(phase)) throw new Error(`--phase must be files|gates, got ${phase}`)
if (!['github', 'none'].includes(ci)) throw new Error(`--ci must be github|none, got ${ci}`)

const T = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates')
const at = (p) => join(root, p)
const log = (verb, p) => console.log(`${verb.padEnd(9)} ${p}`)

const read = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8') : '')
const readSettings = () => (existsSync(at('.claude/settings.json')) ? JSON.parse(read('.claude/settings.json')) : {})
const writeSettings = (o) => {
  mkdirSync(at('.claude'), { recursive: true })
  writeFileSync(at('.claude/settings.json'), JSON.stringify(o, null, 2) + '\n')
}

function placeholders() {
  const todo = []
  if (/HELM_UNSET;/.test(read('.helm/check.sh'))) todo.push('.helm/check.sh: replace every HELM_UNSET')
  if (read('probity.config.mjs').includes('HELM_SOURCE_GLOBS')) todo.push('probity.config.mjs: HELM_SOURCE_GLOBS')
  if (read('.github/workflows/helm.yml').includes('HELM_TOOLCHAIN_STEPS')) todo.push('.github/workflows/helm.yml: HELM_TOOLCHAIN_STEPS')
  return todo
}

// Git runs hooks from one directory. If nothing claims it, use .helm/git-hooks.
// If another tool does (beads installs to .beads/hooks), add a marked section there that
// delegates to .helm/git-hooks, so both run and helm's hooks stay the versioned source.
function wireGitHooks() {
  let hp = ''
  try {
    hp = execFileSync('git', ['-C', root, 'config', 'core.hooksPath'], { encoding: 'utf8' }).trim()
  } catch {}
  const helmDir = at('.helm/git-hooks')
  const dir = hp ? (isAbsolute(hp) ? hp : join(root, hp)) : ''
  if (!dir || resolve(dir) === resolve(helmDir)) {
    execFileSync('git', ['-C', root, 'config', 'core.hooksPath', '.helm/git-hooks'])
    return log('set', 'git core.hooksPath=.helm/git-hooks')
  }
  const begin = '# --- BEGIN HELM ---'
  const end = '# --- END HELM ---'
  const section = (name) =>
    `${begin}\n"$(git rev-parse --show-toplevel)/.helm/git-hooks/${name}" "$@" || exit $?\n${end}\n`
  for (const name of ['pre-commit', 'commit-msg']) {
    const f = join(dir, name)
    let cur = existsSync(f) ? readFileSync(f, 'utf8') : '#!/usr/bin/env bash\n'
    cur = cur.replace(new RegExp(`${begin}[\\s\\S]*?${end}\\n?`), '')
    writeFileSync(f, cur.trimEnd() + '\n\n' + section(name))
    chmodSync(f, 0o755)
    log('chained', `${hp}/${name} -> .helm/git-hooks/${name}`)
  }
}

if (phase === 'gates') {
  const todo = placeholders()
  if (!existsSync(at('node_modules/@nizos/probity'))) todo.push('npm install -D @nizos/probity')
  if (todo.length) {
    console.error(`gates not enabled; finish first:\n${todo.map((t) => `  ${t}`).join('\n')}`)
    process.exit(1)
  }
  wireGitHooks()
  const s = readSettings()
  const cmd = 'npx --no-install @nizos/probity --agent claude-code'
  s.hooks ??= {}
  s.hooks.PreToolUse ??= []
  const present = s.hooks.PreToolUse.some((m) => (m.hooks ?? []).some((h) => h.command === cmd))
  if (!present) {
    s.hooks.PreToolUse.push({ matcher: 'Bash|Write|Edit|NotebookEdit', hooks: [{ type: 'command', command: cmd }] })
    writeSettings(s)
  }
  log(present ? 'kept' : 'merged', '.claude/settings.json (Probity hook)')
  console.log('\ngates live')
  process.exit(0)
}

function place(src, dst, transform = (s) => s, mode) {
  if (existsSync(at(dst))) return log('kept', dst)
  mkdirSync(dirname(at(dst)), { recursive: true })
  writeFileSync(at(dst), transform(readFileSync(join(T, src), 'utf8')))
  if (mode) chmodSync(at(dst), mode)
  log('created', dst)
}

// Gates and state
place('helm/check.sh', '.helm/check.sh', undefined, 0o755)
place('helm/docs-sync.sh', '.helm/docs-sync.sh', undefined, 0o755)
place('helm/git-hooks/pre-commit', '.helm/git-hooks/pre-commit', undefined, 0o755)
place('helm/git-hooks/commit-msg', '.helm/git-hooks/commit-msg', undefined, 0o755)
place('helm/loop.sh', '.helm/loop.sh', undefined, 0o755)
place('helm/public-paths', '.helm/public-paths')
place('helm/state.json', '.helm/state.json', (s) => s.replace('HELM_MAIN_BRANCH', main).replace('HELM_CI', ci))
place('probity.config.mjs', 'probity.config.mjs')
if (ci === 'github') {
  place('ci/github.yml', '.github/workflows/helm.yml', (s) => s.replace('HELM_MAIN_BRANCH', main))
}

// Docs
place('docs/INTENT.md', 'docs/INTENT.md')
place('docs/ARCHITECTURE.md', 'docs/ARCHITECTURE.md')
place('docs/adr/TEMPLATE.md', 'docs/adr/TEMPLATE.md')
place('docs/milestones/TEMPLATE.md', 'docs/milestones/TEMPLATE.md')

// Helm <= 0.2 used permission ask rules as the human gate; 0.3 uses the authority hook,
// which also holds in bypass mode. Remove the old rules so they don't double-prompt.
{
  const legacy = new Set([
    'Edit(/docs/INTENT.md)', 'Edit(/docs/adr/**)', 'Edit(/.helm/check.sh)', 'Edit(/.helm/docs-sync.sh)',
    'Edit(/.helm/git-hooks/**)', 'Edit(/.helm/public-paths)', 'Edit(/.helm/loop.sh)', 'Edit(/.helm/loop-settings.json)',
    'Edit(/probity.config.mjs)', 'Edit(/.claude/settings.json)', 'Edit(/.github/workflows/**)',
    'Bash(bd human respond *)', 'Bash(bd human dismiss *)', 'Bash(bd epic close-eligible)', 'Bash(bd epic close-eligible *)',
    'Bash(git push *)', 'Bash(git merge *)', 'Bash(git tag *)', 'Bash(gh pr merge *)',
  ])
  const cur = readSettings()
  const ask = cur.permissions?.ask
  if (ask?.some((r) => legacy.has(r))) {
    cur.permissions.ask = ask.filter((r) => !legacy.has(r))
    if (!cur.permissions.ask.length) delete cur.permissions.ask
    if (!Object.keys(cur.permissions).length) delete cur.permissions
    writeSettings(cur)
    log('migrated', '.claude/settings.json (removed helm <=0.2 ask rules)')
  }
}

// CLAUDE.md contract block: replace between markers, or append.
{
  const p = 'CLAUDE.md'
  const block = readFileSync(join(T, 'CLAUDE.helm.md'), 'utf8').trimEnd()
  const cur = existsSync(at(p)) ? readFileSync(at(p), 'utf8') : ''
  const re = /<!-- helm:begin[\s\S]*?<!-- helm:end -->/
  const next = re.test(cur) ? cur.replace(re, block) : (cur ? cur.trimEnd() + '\n\n' : '') + block
  writeFileSync(at(p), next.trimEnd() + '\n')
  log(re.test(cur) ? 'updated' : cur ? 'appended' : 'created', p)
}

// .gitignore entries
{
  const p = '.gitignore'
  const cur = existsSync(at(p)) ? readFileSync(at(p), 'utf8') : ''
  const need = ['node_modules/', '.helm/run-status', '.helm/logs/'].filter((l) => !cur.split('\n').includes(l))
  if (need.length) {
    writeFileSync(at(p), (cur && !cur.endsWith('\n') ? cur + '\n' : cur) + need.join('\n') + '\n')
    log('updated', p)
  }
}

const todo = placeholders()
console.log(todo.length ? `\nTODO, then run --phase gates\n${todo.map((t) => `  ${t}`).join('\n')}` : '\nfiles complete; run --phase gates')
