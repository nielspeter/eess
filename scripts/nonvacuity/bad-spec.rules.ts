/**
 * Non-vacuity fixture for the `check:spec` gate (plan 0061). Binds a fixture
 * README package table to a hand-built "workspace" that deliberately disagrees,
 * so the spec correspondence MUST report drift. Run by the non-vacuity harness
 * via `eess-ts check`; asserted to exit 1.
 */
import { correspondence, type Selection } from '@nielspeter/eess'
import { corpus, rows } from '@nielspeter/eess-md'

const c = corpus({ roots: ['scripts/nonvacuity/bad-spec/README.md'] })

const bare = (s: string): string => s.replace(/`/g, '').trim()

const left = rows(c, { section: /^Packages$/, columns: { pkg: /^Package$/ } }).select({
  label: 'fixture README row',
  identify: (r) => ({ name: bare(r.get('pkg')), file: r.doc.relPath, line: r.line }),
})

// The fixture README lists `@x/ghost`; the "workspace" has only `@x/present`.
// Both completeness directions therefore fail — a guaranteed non-vacuous catch.
const right: Selection<{ name: string }> = {
  elements: [{ name: '@x/present' }],
  label: 'fixture workspace package',
  identify: (p) => ({ name: p.name }),
}

export default [
  correspondence({ left, right, keyBy: { left: (r) => bare(r.get('pkg')), right: (p) => p.name } })
    .should()
    .beComplete({ direction: 'both' })
    .rule({ id: 'spec/nonvacuity-probe' }),
]
