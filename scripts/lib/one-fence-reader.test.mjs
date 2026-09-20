import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Bug 0287 — one markdown fence reader, not four.
 *
 * The same fence-stripping regex was hand-rolled in `eess-md`'s ledger and `terms()`, in
 * `eess-crossvalidate`'s scenario citations and in this repo's proposal-ruling script. It read a
 * triple-backtick run inside a longer fence as a closer and blanked the real text after it: a
 * proposal's ruling, in CI (bug 0288). All four now read prose through `proseText`, which pairs fences
 * with the markdown parser; this is what stops a fifth copy appearing silently.
 *
 * **A source scan, not an eess-ts rule.** `arch.rules.ts` sees the packages' TypeScript and nothing
 * else, and one of the four copies was a script; a rule that cannot see where the last copy lived
 * cannot guard against the next one there.
 *
 * **What it cannot see** (stated in bug 0287): a fence reader that is not a regex alternating a backtick
 * run and a tilde run in one of the three forms below — a character loop, one fence kind only, or a
 * pattern built as a string and passed to `new RegExp`. Nor does it read the packages' tests.
 */

/**
 * A regex that reads a markdown fence: a backtick run and a tilde run, alternated in either order, or
 * both in one character class — the three ways the four copies and the two homes write it.
 */
const FENCE_READER = [
  /(?:```|`\{3,?\})[^\n]{0,60}\|[^\n]{0,60}(?:~~~|~\{3,?\})/,
  /(?:~~~|~\{3,?\})[^\n]{0,60}\|[^\n]{0,60}(?:```|`\{3,?\})/,
  /\[(?:`~|~`)\][*+]|\[(?:`~|~`)\]\{[0-9]/,
]

/**
 * The closed set of homes, each with its reason. A new one is a decision, recorded in bug 0287's
 * successor, not a line added here to turn a red green.
 */
const HOMES = {
  // The owner: every reader of a document's prose in the family goes through it.
  'packages/md/src/model/prose.ts': 'the owner, proseText (bug 0287)',
  // The kernel masks code spans before it reads an exclusion comment. It cannot depend on the
  // markdown dialect's parser, so it keeps a conservative line loop of its own (ADR-012).
  'packages/core/src/mask-non-comment.ts': 'the kernel borrows a lexer it cannot own (ADR-012)',
}

/**
 * Code this repo ships or runs: every package's source, the scripts that gate it, the kit, the workflow
 * scripts — and the repo-root rule files, which are code too and sit in no directory of their own.
 */
const ROOTS = ['packages', 'scripts', 'kit', '.claude/workflows', '.']
const CODE = /\.(?:[cm]?[jt]s|tsx)$/
const SKIP = new Set(['node_modules', 'dist', 'tests', 'fixtures'])
// This file spells out the patterns and the copy it replaced, so it matches itself.
const SELF = join('scripts', 'lib', 'one-fence-reader.test.mjs')

/**
 * Every code file under a root, walked on disk rather than listed by git: a non-vacuity probe is
 * `.gitignore`d by design (bug 0231), and a check that cannot see the probe planted in its own
 * population cannot be falsified.
 */
function codeFiles(root) {
  const out = []
  // '.' means the repo-root files themselves, not the whole tree: every directory under it is either
  // another root or none of this check's business (node_modules, docs, work, .git).
  const walk = (dir, depth = 0) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // a root that does not exist here is reported by the floor test below
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (root !== '.' && !SKIP.has(entry.name)) walk(path, depth + 1)
      } else if (CODE.test(entry.name) && path !== SELF) out.push(path)
    }
  }
  walk(root)
  return out
}

const readsAFence = (text) =>
  text.split('\n').some((line) => FENCE_READER.some((re) => re.test(line)))

const scanned = new Map(ROOTS.map((root) => [root, codeFiles(root)]))
const allScanned = [...scanned.values()].flat()

test('only its homes read a markdown fence with a regex', (t) => {
  t.diagnostic(
    `scanned ${allScanned.length} files: ` +
      ROOTS.map((r) => `${r} ${(scanned.get(r) ?? []).length}`).join(' · '),
  )
  const offenders = allScanned.filter((f) => !(f in HOMES) && readsAFence(readFileSync(f, 'utf8')))
  assert.deepEqual(
    offenders,
    [],
    `a markdown fence is read by a regex outside its homes: ${offenders.join(', ')}. ` +
      `Read prose through proseText — \`../model/prose.js\` inside eess-md, ` +
      `\`@nielspeter/eess-md/internal\` outside it — instead; a hand-rolled fence regex is how four copies ` +
      `came to lose a real line (bug 0287). The kernel cannot reach the dialect's parser (ADR-012), so a ` +
      `reader there is a new home, and a decision to record beside the change that adds it`,
  )
})

test('every home is scanned and still matched — either half emptied would pass on nothing', () => {
  const unscanned = Object.keys(HOMES).filter((f) => !allScanned.includes(f))
  assert.deepEqual(
    unscanned,
    [],
    `a home is not in the scanned set: ${unscanned.join(', ')} — the roots no longer reach it, so ` +
      `nothing under them is checked either`,
  )
  const unmatched = Object.keys(HOMES).filter((f) => !readsAFence(readFileSync(f, 'utf8')))
  assert.deepEqual(
    unmatched,
    [],
    `the fence patterns no longer match: ${unmatched.join(', ')} — either a pattern broke, or that home ` +
      `stopped reading fences with a regex and should leave HOMES`,
  )
})

test('the pattern matches the copy it replaced', () => {
  // The regex all four copies carried, verbatim.
  assert.ok(readsAFence('const FENCE_RE = /(```|~~~)[\\s\\S]*?\\1/g'))
})

test('every root contributed files — an emptied root is a check of nothing', () => {
  const empty = ROOTS.filter((root) => (scanned.get(root) ?? []).length === 0)
  assert.deepEqual(empty, [], `no code files under ${empty.join(', ')}`)
  assert.ok(ROOTS.length >= 4, `ROOTS collapsed to ${ROOTS.length}`)
  assert.ok(Object.keys(HOMES).length >= 2, 'HOMES collapsed')
})
