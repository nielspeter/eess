#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — plan 0406's `links().…should().beLinkedBack()`. Each
 * scenario runs a rule over one folder of scripts/nonvacuity/bad-linked-back/
 * (each folder is its own repo root) and asserts the EXACT set of findings it
 * must produce — `element | message` — so a finding that goes missing and a
 * finding that appears both fail the row. All findings share the rule's id, so
 * an id match would let any one answer for another (bug 0110's class).
 *
 * One scenario per row of the plan's finding table, plus:
 *   all-frozen      every declared target frozen, with haveLiveTargets(): the
 *                   zero-examined finding, not a pass;
 *   mixed-frozen    a frozen target that does not link back: green with the
 *                   selector, the frozen finding without it;
 *   green-control   back-links in every spelling, twice, with a fragment: no
 *                   finding, and six links examined;
 *   selector-pin    the selection itself (deferred here from plan 0405): an
 *                   annotated item (`- [b](b.md): why`) is declared, a link
 *                   outside the label is not — under- and over-selection both
 *                   change the set.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the scenario produced exactly its expected findings — OK
 *   0 = it did not (the check is vacuous or wrong — the harness treats this as fail)
 *   2 = unexpected error, or an unknown scenario — the harness treats this as fail
 */
import { join } from 'node:path'
import { corpus, links } from '@nielspeter/eess-md'

const ROOT = join('scripts', 'nonvacuity', 'bad-linked-back')
const ZERO = 'this rule examined zero units'

function run(dir, o = {}) {
  const c = corpus({ roots: o.roots ?? ['**/*.md'], cwd: join(ROOT, dir), ...(o.ignore ? { ignore: o.ignore } : {}) })
  const declared = links(c).that().areLabelled('Related to')
  const selected = o.live ? declared.and().haveLiveTargets(o.resolve) : declared
  const v = selected.should().beLinkedBack(o.resolve).rule({ id: 'nonvacuity/linked-back' }).violations()
  const found = v
    .map((x) => {
      const first = x.message.split('\n')[0] ?? ''
      return first.startsWith(ZERO) ? ZERO : `${x.element} | ${first}`
    })
    .sort()
  return { found, examined: v.examined }
}

const one = (element, message) => [`${element} | ${message}`]

const SCENARIOS = {
  'live-no-link-back': () => [run('oneway'), one('a.md → b.md', 'a.md declares b.md, and b.md does not link back')],
  'frozen-target': () => [run('frozen'), one('a.md → archived/f.md', 'archived/f.md is frozen and cannot answer')],
  'outside-roots': () => [
    run('outside', { roots: ['in/**'] }),
    one('in/a.md → out/o.md', 'out/o.md is outside the corpus, so its links are not read'),
  ],
  'not-markdown': () => [run('not-markdown'), one('a.md → p.png', 'p.png is not a Markdown record')],
  ignored: () => [
    run('ignored', { ignore: ['ig/**'] }),
    one('a.md → ig/x.md', 'ig/x.md matches the corpus ignore option, so its links are not read'),
  ],
  missing: () => [run('missing'), one('a.md → gone.md', 'gone.md does not exist')],
  directory: () => [run('directory'), one('a.md → sub', 'the link names a directory, sub, not a record')],
  self: () => [run('self'), one('a.md → a.md', 'the link points at this record')],
  external: () => [
    run('external'),
    one('a.md → https://example.com/e', 'the declaration links outside the repository, to https://example.com/e'),
  ],
  'all-frozen': () => [run('all-frozen', { live: true }), [ZERO]],
  'mixed-frozen': () => {
    const withSelector = run('frozen', { live: true })
    const without = run('frozen')
    const ok =
      withSelector.found.length === 0 &&
      withSelector.examined === 1 &&
      JSON.stringify(without.found) ===
        JSON.stringify(one('a.md → archived/f.md', 'archived/f.md is frozen and cannot answer'))
    return [{ found: ok ? ['mixed'] : [...withSelector.found, '||', ...without.found], examined: 1 }, ['mixed']]
  },
  'green-control': () => {
    const r = run('spellings', { resolve: { tryExtensions: ['.md'] } })
    return [{ found: r.examined === 6 ? r.found : [`examined ${r.examined}`], examined: r.examined }, []]
  },
  'selector-pin': () => [run('selector'), one('a.md → b.md', 'a.md declares b.md, and b.md does not link back')],
}

const name = process.argv[2]
const scenario = SCENARIOS[name]
if (scenario === undefined) {
  console.error(`bad-linked-back: unknown scenario "${name}" — expected one of ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(2)
}

let result
let expected
try {
  ;[result, expected] = scenario()
} catch (err) {
  console.error(`bad-linked-back: unexpected error — ${String(err)}`)
  process.exit(2)
}

if (JSON.stringify(result.found) === JSON.stringify(expected)) {
  console.error(`bad-linked-back: ${name}: exactly as expected (${expected.length} finding(s))`)
  process.exit(1)
}
console.error(
  `bad-linked-back: ${name}: NOT as expected — the check is vacuous or wrong\n` +
    `  expected: ${JSON.stringify(expected)}\n  found:    ${JSON.stringify(result.found)}`,
)
process.exit(0)
