import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { embeddedDiagramsMatchCode, embeddedDiagramStats } from '../src/md-mermaid.js'

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const proj = () => project(join(calc, 'tsconfig.json'))
const c = (roots: string[]) => corpus({ roots, cwd: calc })

describe('embeddedDiagramsMatchCode() — embedded ```mermaid in markdown', () => {
  it('passes when every class in an embedded diagram exists in code', () => {
    expect(() => embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj())).not.toThrow()
  })

  it('fails when an embedded diagram names a class missing from code, pointing at the md file', () => {
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-bad.md']), proj())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const v = (err as ArchRuleError).violations
    expect(v.some((x) => x.message.includes('GhostClass'))).toBe(true)
    // violation points at the markdown file, not the parsed diagram
    expect(v.some((x) => x.file.endsWith('embedded-bad.md'))).toBe(true)
  })

  it("completeness: 'both' passes when the embedded diagram and code fully agree", () => {
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-complete.md']), proj(), {
        completeness: 'both',
      }),
    ).not.toThrow()
  })

  it("completeness: 'both' fails when code has a class missing from the embedded diagram", () => {
    // ModuloOperation exists in src/ but not in embedded-good.md — plan 0096
    // makes this the load-bearing check that closes an emptied-diagram hole:
    // left-to-right alone only checks every DIAGRAM class exists in code,
    // which passes trivially even for an empty diagram (see the test below).
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj(), { completeness: 'both' })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/TS class "ModuloOperation" has no matching diagram class/)
  })

  it("left-to-right only: ignores extra code classes embedded-good.md doesn't name", () => {
    // The default. embedded-good.md is missing ModuloOperation, but
    // left-to-right only checks that every DIAGRAM class exists in code.
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj(), {
        completeness: 'left-to-right',
      }),
    ).not.toThrow()
  })

  // Bug 0209 — a document may hold more than one diagram type. This binding
  // models classDiagram only; a sibling sequenceDiagram is not a failed
  // classDiagram, it is a different artifact and must be skipped, exactly as
  // md-mermaid-er skips non-ER fences by matching on fence CONTENT.
  it('skips a non-classDiagram mermaid fence instead of crashing on it', () => {
    expect(() => embeddedDiagramsMatchCode(c(['docs/embedded-mixed.md']), proj())).not.toThrow()
  })

  it('still checks the classDiagram that sits beside a skipped sequenceDiagram', () => {
    // The load-bearing half of bug 0209's fix: skipping the foreign fence must
    // not skip the document. GhostClass is absent from code and must still red.
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-mixed-bad.md']), proj())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const v = (err as ArchRuleError).violations
    expect(v.some((x) => x.message.includes('GhostClass'))).toBe(true)
    expect(v.some((x) => x.file.endsWith('embedded-mixed-bad.md'))).toBe(true)
  })

  it('reports an unparseable classDiagram against the markdown file', () => {
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-malformed.md']), proj())
    } catch (e) {
      err = e
    }
    // not an uncaught MermaidUnitParseError — a violation with attribution
    expect(err).toBeInstanceOf(ArchRuleError)
    const v = (err as ArchRuleError).violations
    expect(v.some((x) => x.message.includes('does not parse'))).toBe(true)
    expect(v.some((x) => x.file.endsWith('embedded-malformed.md'))).toBe(true)
  })

  it('examines a class diagram behind a %%{init}%% directive (bug 0209 review)', () => {
    // Mermaid treats %% lines as hidden terminals, so the keyword is not always
    // first. An allowlist selector dropped these silently while the parser
    // handled them fine — the fail-open regression review measured.
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-directive-bad.md']), proj())
    } catch (e) {
      err = e
    }
    if (!(err instanceof ArchRuleError)) throw new Error('expected the drift to be reported')
    expect(err.violations.some((x) => x.message.includes('GhostClass'))).toBe(true)
  })

  it('passes a valid class diagram behind a leading %% comment', () => {
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-directive-good.md']), proj()),
    ).not.toThrow()
    expect(embeddedDiagramStats(c(['docs/embedded-directive-good.md'])).diagrams).toBe(1)
  })

  it('attributes an unparseable diagram: ruleId, line, because and suggestion', () => {
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-malformed.md']), proj())
    } catch (e) {
      err = e
    }
    if (!(err instanceof ArchRuleError)) throw new Error('expected a parse finding')
    const v = err.violations.find((x) => x.message.includes('does not parse'))
    expect(v).toBeDefined()
    // the machine key lives in ruleId; `rule` is the human sentence, as the sibling does it
    expect(v?.ruleId).toBe('crossval/embedded-diagram')
    expect(v?.file.endsWith('embedded-malformed.md')).toBe(true)
    expect(v?.line).toBe(5)
    expect(v?.because).toBeTruthy()
    expect(v?.suggestion).toBeTruthy()
    // and it carries the actual diagnosis, not the constant prefix
    expect(v?.message).not.toMatch(/parse failed:$/)
    expect(v?.message).toMatch(/Expecting|token|line/i)
  })

  it('counts documents and diagrams independently, and reports what it skipped', () => {
    // one document, TWO class diagrams — the only shape that can tell the two
    // counters apart. With one-of-each fixtures both mutations were invisible.
    expect(embeddedDiagramStats(c(['docs/embedded-two-diagrams.md']))).toEqual({
      documents: 1,
      diagrams: 2,
      skipped: 0,
    })
    // a document whose only mermaid fence is foreign: nothing examined, and it says so
    expect(embeddedDiagramStats(c(['docs/embedded-foreign-only.md']))).toEqual({
      documents: 0,
      diagrams: 0,
      skipped: 1,
    })
    // Declared: this document's only fence is a foreign diagram, so there is
    // genuinely nothing for this preset to examine. Expires if one is added.
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-foreign-only.md']), proj(), {
        expectEmpty: true,
      }),
    ).not.toThrow()
    // the mixed document contributes its one class diagram and skips one fence
    expect(embeddedDiagramStats(c(['docs/embedded-mixed.md']))).toEqual({
      documents: 1,
      diagrams: 1,
      skipped: 1,
    })
  })

  it('skips a FOREIGN fence that carries a %%{init}%% directive', () => {
    // The break class for declaredKind()'s comment skip. The directive fixtures
    // above pin the DENYLIST, not this — a %% line fails FOREIGN_HEADER either
    // way, so only a themed FOREIGN fence can detect the skip going missing.
    expect(embeddedDiagramStats(c(['docs/embedded-themed-foreign.md']))).toEqual({
      documents: 1,
      diagrams: 1,
      skipped: 1,
    })
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-themed-foreign.md']), proj()),
    ).not.toThrow()
  })

  it('skips a FOREIGN fence behind a --- frontmatter block', () => {
    expect(embeddedDiagramStats(c(['docs/embedded-frontmatter-foreign.md']))).toEqual({
      documents: 0,
      diagrams: 0,
      skipped: 1,
    })
  })

  it('skips a FOREIGN fence behind a multi-line %%{init}%% block', () => {
    expect(embeddedDiagramStats(c(['docs/embedded-multiline-directive.md']))).toEqual({
      documents: 0,
      diagrams: 0,
      skipped: 1,
    })
  })

  it('reports nothing examined for a document with no mermaid fence at all', () => {
    // embedded-none.md was committed unreferenced by the first pass — five of six
    // reviewers flagged the orphan. This is the assertion it was added for.
    expect(embeddedDiagramStats(c(['docs/embedded-none.md']))).toEqual({
      documents: 0,
      diagrams: 0,
      skipped: 0,
    })
  })

  it('accumulates across documents, not just within one', () => {
    expect(
      embeddedDiagramStats(c(['docs/embedded-two-diagrams.md', 'docs/embedded-mixed.md'])),
    ).toEqual({ documents: 2, diagrams: 3, skipped: 1 })
  })
})

// Bug 0290: `codeBlocks` held top-level blocks only, so a diagram in a list item or a
// blockquote was never compared and never counted — a fail-open.
describe('embeddedDiagramsMatchCode() — a diagram nested in a list item or blockquote (bug 0290)', () => {
  const violationsOf = (roots: string[]) => {
    try {
      embeddedDiagramsMatchCode(c(roots), proj())
    } catch (e) {
      if (e instanceof ArchRuleError) return e.violations
      throw e
    }
    return []
  }

  it('reports a missing class in a diagram inside a list item, at its fence line', () => {
    const v = violationsOf(['docs/embedded-list-bad.md'])
    expect(v.map((x) => [x.file.endsWith('embedded-list-bad.md'), x.line])).toEqual([[true, 5]])
    expect(v[0]?.message).toContain('GhostClass')
  })

  it('reports a missing class in a diagram inside a blockquote, at its fence line', () => {
    const v = violationsOf(['docs/embedded-quote-bad.md'])
    expect(v.map((x) => [x.file.endsWith('embedded-quote-bad.md'), x.line])).toEqual([[true, 3]])
    expect(v[0]?.message).toContain('GhostClass')
  })

  it('adds no finding for a valid nested diagram', () => {
    expect(violationsOf(['docs/embedded-list-good.md'])).toEqual([])
  })

  it('counts nested diagrams in the statistics', () => {
    expect(
      embeddedDiagramStats(
        c([
          'docs/embedded-list-bad.md',
          'docs/embedded-quote-bad.md',
          'docs/embedded-list-good.md',
        ]),
      ),
    ).toEqual({ documents: 3, diagrams: 3, skipped: 0 })
  })

  // Bug 0409: eess-mermaid's grammar covers part of Mermaid. A fence it rejects is a syntax error OR
  // valid Mermaid it does not model, and without Mermaid's own parser eess cannot tell which. The
  // finding said the first, and its remedy led to deleting a correct construct.
  const parseFinding = (doc: string) => {
    try {
      embeddedDiagramsMatchCode(c([doc]), proj())
    } catch (e) {
      if (e instanceof ArchRuleError)
        return e.violations.find((x) => x.message.includes('does not parse'))
    }
    return undefined
  }
  const SUGGESTION =
    'Check this fence in the Mermaid Live Editor (https://mermaid.live); in Node, mermaid.parse ' +
    'needs a DOM such as jsdom and fails without one. If Mermaid reports a parse error, fix the ' +
    'syntax. If Mermaid accepts it, keep the fence and report the construct at ' +
    'https://github.com/nielspeter/eess/issues; this finding stays until eess-mermaid models it, and ' +
    'no eess-exclude comment silences it yet. To be green meanwhile, move only this fence into a ' +
    `document of its own and leave that document out (ignore it in the corpus you pass to embeddedDiagramsMatchCode), so the document's other ` +
    'diagrams are still checked; put it back once the construct is modelled.'

  it('does not call valid Mermaid it cannot read a syntax error (bug 0409)', () => {
    const v = parseFinding('docs/embedded-grammar-gap.md')
    expect(
      v?.message.startsWith(
        "embedded classDiagram does not parse with eess-mermaid's class-diagram grammar: ",
      ),
    ).toBe(true)
    expect(v?.message).toContain(
      "This is either a syntax error in the document or valid Mermaid that eess-mermaid does not model yet; eess cannot tell which without Mermaid's own parser.",
    )
    expect(v?.message).not.toMatch(/syntax error in your document/)
    expect(v?.suggestion).toBe(SUGGESTION)
    expect(v?.suggestion).not.toMatch(/remove|delete/i)
  })

  it('still reports a fence both parsers reject (bug 0409)', () => {
    const v = parseFinding('docs/embedded-both-reject.md')
    expect(v?.ruleId).toBe('crossval/embedded-diagram')
    expect(v?.suggestion).toBe(SUGGESTION)
  })

  it('gives classDiagram-v2, a known gap, its concrete fix (bug 0409)', () => {
    const v = parseFinding('docs/embedded-classdiagram-v2.md')
    expect(v?.message).toContain('This is legal Mermaid that eess-mermaid does not model yet')
    expect(v?.suggestion).toBe(
      'Change the header to `classDiagram`: it is the same language, and eess-mermaid reads it.',
    )
  })

  // Bug 0423: the selector compared the tag to exactly `mermaid`, so a ```Mermaid fence was neither
  // compared nor counted, and a drifted diagram written with that tag passed in any corpus that held
  // another class diagram.
  it('reads a ```Mermaid fence like a ```mermaid one (bug 0423)', () => {
    const docs = c(['docs/embedded-capitalised.md', 'docs/embedded-good.md'])
    let err: unknown
    try {
      embeddedDiagramsMatchCode(docs, proj())
    } catch (e) {
      err = e
    }
    if (!(err instanceof ArchRuleError)) throw new Error('expected the ghost class to be reported')
    const v = err.violations.find((x) => x.message.includes('GhostClassInACapitalisedFence'))
    expect(v?.file.endsWith('embedded-capitalised.md')).toBe(true)
    expect(embeddedDiagramStats(docs)).toMatchObject({ documents: 2, diagrams: 2, skipped: 0 })
  })
})
