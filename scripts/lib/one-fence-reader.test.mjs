import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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
 * **What it cannot see** (stated in bug 0287): a fence reader that is not a regex alternating a
 * backtick run and a tilde run — a character loop, or one fence kind only.
 */

/** A regex that reads a markdown fence: a backtick run and a tilde run, alternated, either order. */
const FENCE_READER = [
  /(?:```|`\{3,?\})[^\n]{0,60}\|[^\n]{0,60}(?:~~~|~\{3,?\})/,
  /(?:~~~|~\{3,?\})[^\n]{0,60}\|[^\n]{0,60}(?:```|`\{3,?\})/,
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

/** Code this repo ships or runs: every package's source, and the scripts that gate it. */
const ROOTS = ['packages/*/src/**', 'scripts/**', 'kit/**']
const CODE = /\.(?:[cm]?[jt]s|tsx)$/
// This file spells out the pattern and the copy it replaced, so it matches itself.
const SELF = 'scripts/lib/one-fence-reader.test.mjs'

// Tracked and untracked-but-not-ignored: a copy added in a working tree is seen before it is committed.
function codeFiles(root) {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', root],
    {
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter((f) => CODE.test(f) && f !== SELF)
}

const readsAFence = (text) =>
  text.split('\n').some((line) => FENCE_READER.some((re) => re.test(line)))

const scanned = new Map(ROOTS.map((root) => [root, codeFiles(root)]))

test('only its homes read a markdown fence with a regex', () => {
  const offenders = [...scanned.values()]
    .flat()
    .filter((f) => !(f in HOMES) && readsAFence(readFileSync(f, 'utf8')))
  assert.deepEqual(
    offenders,
    [],
    `a markdown fence is read by a regex outside its homes: ${offenders.join(', ')}. ` +
      `Read prose through proseText from @nielspeter/eess-md/internal (or ../model/prose.js inside ` +
      `eess-md) instead — a hand-rolled fence regex is how four copies came to lose a real line (bug 0287)`,
  )
})

test('every home is still matched — a pattern that stopped matching would pass on nothing', () => {
  const unmatched = Object.keys(HOMES).filter((f) => !readsAFence(readFileSync(f, 'utf8')))
  assert.deepEqual(unmatched, [], `the fence pattern no longer matches: ${unmatched.join(', ')}`)
})

test('the pattern matches the copy it replaced', () => {
  // The regex all four copies carried, verbatim.
  assert.ok(readsAFence('const FENCE_RE = /(```|~~~)[\\s\\S]*?\\1/g'))
})

test('every root contributed files — an emptied root is a check of nothing', () => {
  const empty = ROOTS.filter((root) => (scanned.get(root) ?? []).length === 0)
  assert.deepEqual(empty, [], `no code files under ${empty.join(', ')}`)
  assert.ok(Object.keys(HOMES).length >= 2, 'HOMES collapsed')
})
