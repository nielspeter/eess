import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { corpus, pointers, presentExternalRoots } from '../../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'external-root')
const REPO = join(FIXTURES, 'repo')
const LEGACY = join(FIXTURES, 'legacy')
const ABSENT = join(FIXTURES, 'not-cloned')

const c = () => corpus({ cwd: REPO, roots: ['docs/**'] })

describe('pointers().resolve({ externalRoots }) — plan 0069 Phase 5', () => {
  // Bug 0254, round 2. The ambiguous class was added with a stated precedence —
  // "externalRoots get a chance first" — that nothing exercised: review inverted
  // the precedence and all 116 md tests still passed, and the two non-resolving
  // exits were measurably wrong. The pointer is `shared.ts:1`, which two in-repo
  // packages both have, so it is ambiguous by construction.
  const AMBIG_REPO = join(FIXTURES, 'repo-ambiguous')
  const ambiguous = () => corpus({ cwd: AMBIG_REPO, roots: ['docs/**', 'pkg-*/**'] })
  const resolveWith = (externalRoots: string[]) =>
    pointers(ambiguous())
      .should()
      .resolve({ externalRoots })
      .rule({ id: 'corpus/external-pointers' })
      .violations()

  it('reports the ambiguity when no external root is present on disk', () => {
    // Was `return []` — the same silent skip bug 0254 exists to close, reached
    // through the door the first fix left open. The documented plan-0069 skip is
    // for a pointer whose only hope was the absent checkout; this one already
    // failed in-repo, which the missing root has nothing to do with.
    const v = resolveWith([ABSENT])
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/^ambiguous code pointer/)
    expect(v[0]?.message).toMatch(/pkg-a\/lib\/shared\.ts/)
    expect(v[0]?.message).toMatch(/pkg-b\/lib\/shared\.ts/)
  })

  it('reports the ambiguity, not a false "not in the repo", when a present root has no match', () => {
    // Was `broken code pointer: … not in the repo` — false, the pointer is in
    // the repo twice, and it discarded both the candidates and the remedy.
    const v = resolveWith([LEGACY])
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/^ambiguous code pointer/)
    expect(v[0]?.message).not.toMatch(/not in the repo/)
    // The roots searched are still named, so the reader can see it was examined
    // rather than merely unresolved.
    expect(v[0]?.message).toMatch(/also not under external root/)
  })

  it('CONTROL — an external root that DOES resolve still wins over the ambiguity', () => {
    // The precedence the docstring claims, finally asserted. Without this, a
    // change that reported ambiguity before consulting external roots at all
    // would pass both tests above.
    const v = pointers(ambiguous())
      .should()
      .resolve({ externalRoots: [join(FIXTURES, 'legacy-with-shared')] })
      .rule({ id: 'corpus/external-pointers' })
      .violations()
    expect(v).toHaveLength(0)
  })

  it('grounds a pointer in the external root (green) and flags stale + missing (red)', () => {
    const violations = pointers(c())
      .should()
      .resolve({ externalRoots: [LEGACY] })
      .rule({ id: 'corpus/external-pointers' })
      .violations()
    // Thing.groovy:3 grounds (5 lines); :99 is stale; Gone.groovy is broken.
    expect(violations).toHaveLength(2)
    const messages = violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/stale code pointer: .*Thing\.groovy has 6 lines.*references line 99/)
    expect(messages).toMatch(/broken code pointer: .*Gone\.groovy.*not under external root/)
  })

  it('is non-vacuous — the three legacy pointers are real elements', () => {
    const seen = pointers(c()).select({
      label: 'pointer',
      identify: (p) => ({ name: p.raw }),
    }).elements
    expect(seen).toHaveLength(3)
  })

  it('skips (never fails, never silently passes as checked) when no external root exists', () => {
    const violations = pointers(c())
      .should()
      .resolve({ externalRoots: [ABSENT] })
      .violations()
    expect(violations).toHaveLength(0) // skipped — the GATE must report this via presentExternalRoots
    expect(presentExternalRoots([ABSENT])).toEqual([])
  })

  it('presentExternalRoots reports which roots are actually available', () => {
    expect(presentExternalRoots([LEGACY, ABSENT])).toEqual([LEGACY])
  })

  it('without externalRoots the legacy pointers are plainly broken (unchanged default)', () => {
    const violations = pointers(c()).should().resolve().violations()
    expect(violations).toHaveLength(3)
  })
})
