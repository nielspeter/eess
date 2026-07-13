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
