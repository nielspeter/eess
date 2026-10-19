/**
 * A rule limited to the documents the caller chooses (proposal 017, block 12): no open box in a live
 * page that has a `Verification` section. `inDocuments` lifts a document predicate onto the boxes;
 * `areLive()` leaves out the pages the corpus marks frozen. The ratchet is an absence rule, and an
 * absence rule whose scope matches nothing is green (ADR-010 §3), so a guard beside it reds when no
 * live page has the section: a renamed heading or a misspelt name.
 */
import {
  areLive,
  corpus,
  docs,
  predicateHaveSection,
  inDocuments,
  taskItems,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'in-documents'
const SECTION = 'Verification'
const load = (cwd: string) => corpus({ cwd, roots: ['**/*.md'], frozen: ['archive/**'] })

// The ratchet: no open box in a live document that has the section.
const ratchet = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .areOpen()
    .satisfy(inDocuments(areLive()))
    .satisfy(inDocuments(predicateHaveSection(SECTION)))
    .should()
    .notExist()

// The guard: its scope is not empty. notExist() does not check a section name; this does.
// The condition repeats the selection on purpose: the rule fails only when nothing is selected.
const guard = (cwd: string) =>
  docs(load(cwd))
    .that()
    .satisfy(areLive())
    .haveSection(SECTION)
    .should()
    .haveSection(SECTION)
    .rule({ id: 'in-documents/verification-guard' })

describe('a rule limited to the documents the caller chooses', () => {
  it('clean: the open boxes sit outside the scope, and the scope is not empty', () => {
    const cwd = fixture(NAME, 'clean')
    expect([...ratchet(cwd).violations()]).toEqual([])
    const guarded = guard(cwd).violations()
    expect([...guarded]).toEqual([])
    expect(guarded.examined).toBe(1)
    // An absence rule examines nothing when it holds, so its population is proven without the
    // scopes: two open boxes were there to be judged, one in a live page without the section and
    // one in an archived page with it.
    const open = taskItems(load(cwd))
      .that()
      .areOpen()
      .select({
        label: 'open box',
        identify: (t) => ({ name: `${t.doc.relPath}:${String(t.line)}` }),
      })
    expect(open.elements.map((t) => t.doc.relPath).sort()).toEqual(['archive/old.md', 'notes.md'])
  })

  it('violating-open-box-in-scope: an open box in a live page with the section is reported', () => {
    const cwd = fixture(NAME, 'violating-open-box-in-scope')
    const v = ratchet(cwd).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    // The section is a setext heading here: the scope reads it as any other.
    expect(finding?.element).toBe('login.md:8')
    expect(finding?.file).toContain('violating-open-box-in-scope')
    expect(finding?.line).toBe(8)
    expect(finding?.message).toBe('login.md:8 should not exist')
    expect(finding?.bypassFilters).toBeUndefined()
    expect([...guard(cwd).violations()]).toEqual([])
  })

  it('violating-scope-matches-nothing: the ratchet stays green, and the guard reds', () => {
    const cwd = fixture(NAME, 'violating-scope-matches-nothing')
    // Every heading renamed: the absence rule's scope matches no document, which it cannot tell
    // apart from the absence it asserts.
    expect([...ratchet(cwd).violations()]).toEqual([])
    const v = guard(cwd).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    // The kernel's zero-examined finding, whole: a corpus that failed to load says something else.
    expect(finding?.message).toBe(
      'this rule examined zero units. If this is expected (the corpus is legitimately empty right ' +
        'now), declare it explicitly with .expectEmpty() — otherwise this is a dead selector, an ' +
        'empty project, or a rule that never reaches its own examining seam, and the fix is to ' +
        'widen the selection, not to suppress this finding.',
    )
    expect(finding?.ruleId).toBe('in-documents/verification-guard')
    expect(finding?.bypassFilters).toBe(true)
  })
})
