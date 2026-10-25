import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  BaseResolutionError,
  countAtBase,
  resolveRecordMentionBase,
} from './record-mention-base.mjs'
import { censusKeyOfPath, recordKeyOfPath } from './record-key.mjs'

const ROOTS = ['work', 'adr', 'docs']
const NO_ENV = {}

/** A throwaway repository; `run` takes git's arguments, `put` writes a file, `commit` commits all. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'record-mention-base-test-'))
  const run = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  const commit = (message) => {
    run('add', '-A')
    run('commit', '-q', '--allow-empty', '-m', message)
    return run('rev-parse', 'HEAD')
  }
  run('init', '-q', '-b', 'main')
  return { dir, run, put, commit, done: () => rmSync(dir, { recursive: true, force: true }) }
}

// The merge is made on a target branch while `main` stays behind, so the merge-base rule would
// answer the fork point: only the two-parent rule answers the target's tip.
test('a HEAD with two parents is judged against its first', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    const forked = r.commit('fork point')
    r.run('switch', '-q', '-c', 'pr')
    r.put('work/b.md', 'b\n')
    r.commit('pr')
    r.run('switch', '-q', '-c', 'target', 'main')
    r.put('work/c.md', 'c\n')
    const tip = r.commit('target moves')
    r.run('merge', '-q', '--no-ff', '-m', 'merge', 'pr')
    const base = resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV })
    assert.equal(base.commit, tip)
    assert.notEqual(base.commit, forked)
    assert.match(base.how, /first parent of the merge commit/)
  } finally {
    r.done()
  }
})

test('a branch is judged against its merge base with main', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    const forked = r.commit('fork point')
    r.run('switch', '-q', '-c', 'topic')
    r.put('work/b.md', 'b\n')
    r.commit('topic')
    const base = resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV })
    assert.equal(base.commit, forked)
    assert.match(base.how, /merge base with main/)
  } finally {
    r.done()
  }
})

// Read as `check:release` reads them, and from the process's own environment as `check:corpus`
// calls it: `EESS_RELEASE_BASE` as the base, `GITHUB_BASE_REF` as the target `origin/<ref>`.
test('the release variables change nothing', () => {
  const r = repo()
  const saved = { ...process.env }
  try {
    r.put('work/a.md', 'a\n')
    const forked = r.commit('fork point')
    r.run('switch', '-q', '-c', 'topic')
    r.put('work/b.md', 'b\n')
    r.commit('topic one')
    r.put('work/c.md', 'c\n')
    const tip = r.commit('topic two')
    r.run('update-ref', 'refs/remotes/origin/topic', 'HEAD')
    for (const env of [{ EESS_RELEASE_BASE: tip }, { GITHUB_BASE_REF: 'topic' }]) {
      assert.equal(resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env }).commit, forked)
      Object.assign(process.env, env)
      assert.equal(resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS }).commit, forked)
      for (const k of Object.keys(env)) delete process.env[k]
    }
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    r.done()
  }
})

test('a branch with no merge base with main is a hard error', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    r.commit('main')
    r.run('switch', '-q', '--orphan', 'loose')
    r.put('work/b.md', 'b\n')
    r.commit('loose')
    assert.throws(
      () => resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV }),
      (e) => e instanceof BaseResolutionError && /no merge base/.test(e.message),
    )
  } finally {
    r.done()
  }
})

test('no main and no origin/main is a hard error, not a pass', () => {
  const r = repo()
  try {
    r.run('switch', '-q', '-c', 'elsewhere')
    r.put('work/a.md', 'a\n')
    r.commit('one')
    assert.throws(
      () => resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV }),
      (e) => e instanceof BaseResolutionError && /neither origin\/main nor main/.test(e.message),
    )
  } finally {
    r.done()
  }
})

test('main at HEAD with a clean tree is judged against its first parent', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    const parent = r.commit('one')
    r.put('work/b.md', 'b\n')
    r.commit('two')
    const base = resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV })
    assert.equal(base.commit, parent)
    assert.match(base.how, /first parent/)
  } finally {
    r.done()
  }
})

test('main at HEAD, dirty only outside the roots, is judged against its first parent', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    const parent = r.commit('one')
    r.put('work/b.md', 'b\n')
    r.commit('two')
    r.put('scripts/x.mjs', 'x\n')
    assert.equal(resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV }).commit, parent)
  } finally {
    r.done()
  }
})

test('main at HEAD with a dirty tree under the roots is judged against HEAD', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    r.commit('one')
    r.put('work/b.md', 'b\n')
    const head = r.commit('two')
    r.put('work/new.md', 'untracked\n')
    const base = resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV })
    assert.equal(base.commit, head)
    assert.match(base.how, /working tree differs/)
  } finally {
    r.done()
  }
})

test('main at HEAD with no parent and a clean tree is a hard error', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    r.commit('only')
    assert.throws(
      () => resolveRecordMentionBase({ cwd: r.dir, roots: ROOTS, env: NO_ENV }),
      (e) => e instanceof BaseResolutionError && /no parent/.test(e.message),
    )
  } finally {
    r.done()
  }
})

test('the seam names the base directly', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    r.commit('one')
    const base = resolveRecordMentionBase({
      cwd: r.dir,
      roots: ROOTS,
      env: { EESS_RECORD_MENTION_BASE: 'HEAD^{tree}' },
    })
    assert.equal(base.treeish, 'HEAD^{tree}')
    assert.equal(base.commit, undefined)
  } finally {
    r.done()
  }
})

test("the base's roots are counted as written, not through .gitattributes", () => {
  const r = repo()
  try {
    r.put('.gitattributes', 'work/** export-subst export-ignore\n')
    r.put('work/a.md', 'see $Format:%s$\n')
    r.put('packages/x.md', 'outside the roots\n')
    const head = r.commit('bug 0338')
    const seen = []
    const result = countAtBase({
      cwd: r.dir,
      treeish: head,
      roots: ROOTS,
      count: (dir, present) => {
        seen.push(...present)
        const text = readFileSync(join(dir, 'work', 'a.md'), 'utf8')
        return { counts: new Map([['text', text]]), examined: 1 }
      },
    })
    assert.deepEqual(seen, ['work'])
    assert.equal(result.counts.get('text'), 'see $Format:%s$\n')
  } finally {
    r.done()
  }
})

test('a base that cannot be counted is one failure naming its cause', () => {
  const r = repo()
  try {
    r.put('work/a.md', 'a\n')
    const head = r.commit('one')
    const count = () => ({ counts: new Map(), examined: 3 })
    const noTree = countAtBase({ cwd: r.dir, treeish: 'no-such-ref', roots: ROOTS, count })
    assert.match(noTree.failure, /no-such-ref does not name a tree/)
    const noRoot = countAtBase({ cwd: r.dir, treeish: head, roots: ['adr', 'docs'], count })
    assert.match(noRoot.failure, /none of adr, docs exists/)
    const throws = countAtBase({
      cwd: r.dir,
      treeish: head,
      roots: ROOTS,
      count: () => {
        throw new Error('the corpus refused')
      },
    })
    assert.equal(throws.failure, 'the corpus refused')
    const empty = countAtBase({
      cwd: r.dir,
      treeish: head,
      roots: ROOTS,
      count: () => ({ counts: new Map(), examined: 0 }),
    })
    assert.match(empty.failure, /examined no mention/)
  } finally {
    r.done()
  }
})

test('a record keeps its census key when it moves to a done folder', () => {
  assert.equal(censusKeyOfPath('work/plans/0541-x.md'), 'plan:541')
  assert.equal(censusKeyOfPath('work/plans/completed/0541-x.md'), 'plan:541')
  assert.equal(censusKeyOfPath('work/bugs/fixed/0338-y.md'), 'bug:338')
  assert.equal(censusKeyOfPath('work/bugs/338-z.md'), 'bug:338')
  assert.equal(censusKeyOfPath('adr/009-x.md'), 'adr:9')
  assert.equal(censusKeyOfPath('work/plans/ROADMAP.md'), 'work/plans/ROADMAP.md')
  assert.equal(censusKeyOfPath('docs/markdown.md'), 'docs/markdown.md')
  assert.equal(
    censusKeyOfPath('work/spikes/0001-eess-over-ts-archunit/README.md'),
    'work/spikes/0001-eess-over-ts-archunit/README.md',
  )
})

test('a file inside a record directory belongs to that record', () => {
  assert.equal(recordKeyOfPath('work/spikes/0001-eess-over-ts-archunit/README.md'), 'spike:1')
  assert.equal(recordKeyOfPath('work/proposals/019-x.md'), 'proposal:19')
  assert.equal(recordKeyOfPath('adr/021-x.md'), 'adr:21')
  assert.equal(recordKeyOfPath('work/plans/ROADMAP.md'), undefined)
  assert.equal(recordKeyOfPath('docs/markdown.md'), undefined)
})
