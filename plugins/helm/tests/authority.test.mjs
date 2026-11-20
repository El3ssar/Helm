// node --test plugins/helm/tests
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { classifyPrompt, judge, isProtected } from '../scripts/authority.mjs'

const root = '/repo'
const edit = (f) => ['Edit', { file_path: join(root, f) }]
const bash = (c) => ['Bash', { command: c }]
const allowed = (mode, [tool, input]) => judge(mode, tool, input, root) === null

test('prompt classification', () => {
  assert.equal(classifyPrompt('/helm:decide'), 'decide')
  assert.equal(classifyPrompt('  /helm:run 1'), 'run')
  assert.equal(classifyPrompt('/decide bd-12'), 'decide')
  assert.equal(classifyPrompt('/helm:init a lean project'), 'init')
  assert.equal(classifyPrompt('please push it, helm:override'), 'override')
  assert.equal(classifyPrompt('fix the parser'), 'free')
  assert.equal(classifyPrompt('run /helm:decide later'), 'free')
  assert.equal(classifyPrompt(undefined), 'free')
})

test('protected paths', () => {
  for (const p of ['docs/INTENT.md', 'docs/adr/0002-x.md', '.helm/check.sh', '.helm/git-hooks/pre-commit',
    '.github/workflows/helm.yml', '.claude/settings.json', 'probity.config.mjs'])
    assert.ok(isProtected(p), p)
  for (const p of ['docs/ARCHITECTURE.md', 'docs/milestones/M01-x.md', '.helm/state.json', 'src/adr.rs', 'CLAUDE.md'])
    assert.ok(!isProtected(p), p)
})

test('run (and loop, and no record) cannot touch human-owned things', () => {
  for (const mode of ['run', 'none', 'free', 'milestone']) {
    assert.ok(!allowed(mode, edit('docs/INTENT.md')), mode)
    assert.ok(!allowed(mode, edit('docs/adr/0003-y.md')), mode)
    assert.ok(!allowed(mode, edit('.helm/check.sh')), mode)
    assert.ok(!allowed(mode, bash('bd human respond bd-1 -r yes')), mode)
    assert.ok(!allowed(mode, bash('bd epic close-eligible')), mode)
    assert.ok(!allowed(mode, bash('git push -u origin m01')), mode)
    assert.ok(!allowed(mode, bash('git tag m01')), mode)
    assert.ok(!allowed(mode, bash('gh pr create -t x')), mode)
    assert.ok(!allowed(mode, bash("sed -i 's/a/b/' docs/INTENT.md")), mode)
    assert.ok(!allowed(mode, bash('echo x > .helm/check.sh')), mode)
    assert.ok(!allowed(mode, bash('cat x >> .github/workflows/helm.yml')), mode)
    assert.ok(!allowed(mode, bash('rm docs/adr/0001-toolchain.md')), mode)
  }
})

test('run can do the actual work', () => {
  for (const a of [edit('src/lib.rs'), edit('docs/ARCHITECTURE.md'), edit('docs/milestones/M01-x.md'), edit('.helm/state.json'),
    bash('.helm/check.sh fast'), bash('bash .helm/check.sh full > /tmp/log 2>&1'), bash('./.helm/check.sh fast && git commit -m "feat: x"'),
    bash('cat docs/INTENT.md'), bash('git diff main...HEAD -- docs/adr/'), bash('bd close bd-3 -r done'), bash('bd create "Decide: q" -t decision -l human'),
    bash('cargo test'), bash('git commit -m "fix: y"'), bash('echo ok > .helm/run-status')])
    assert.ok(allowed('run', a), JSON.stringify(a))
})

test('decide and override grant everything; init edits but does not publish or answer', () => {
  for (const mode of ['decide', 'override']) {
    assert.ok(allowed(mode, edit('docs/adr/0004-z.md')))
    assert.ok(allowed(mode, bash('bd human respond bd-1 -r accepted')))
    assert.ok(allowed(mode, bash('git push -u origin m01')))
  }
  assert.ok(allowed('init', edit('docs/INTENT.md')))
  assert.ok(allowed('init', edit('.helm/check.sh')))
  assert.ok(!allowed('init', bash('git push')))
  assert.ok(!allowed('init', bash('bd human respond bd-1 -r x')))
})

test('hook end to end: record then check, fail closed without record', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helm-auth-'))
  mkdirSync(join(dir, '.helm'))
  writeFileSync(join(dir, '.helm/state.json'), '{}')
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: join(dir, 'data') }
  const script = new URL('../scripts/authority.mjs', import.meta.url).pathname
  const hook = (sub, ev) => execFileSync('node', [script, sub], { input: JSON.stringify({ cwd: dir, ...ev }), env, encoding: 'utf8' })
  const push = { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push' } }

  assert.match(hook('check', push), /"deny"/) // no record yet
  hook('record', { session_id: 's1', prompt: '/helm:decide' })
  assert.equal(hook('check', push), '')
  hook('record', { session_id: 's1', prompt: '/helm:run 1' })
  assert.match(hook('check', push), /"deny"/)
  assert.match(readFileSync(join(dir, 'data/sessions/s1.json'), 'utf8'), /"run"/)

  // Outside a helm project the hook is inert.
  const other = mkdtempSync(join(tmpdir(), 'plain-'))
  assert.equal(execFileSync('node', [script, 'check'], { input: JSON.stringify({ cwd: other, ...push }), env, encoding: 'utf8' }), '')
})
