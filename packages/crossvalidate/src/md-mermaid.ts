import {
  finishPreset,
  type ArchViolation,
  type Direction,
  type PresetReportOptions,
} from '@nielspeter/eess'
import { correspondence } from '@nielspeter/eess'
import type { Corpus, MdDocument } from '@nielspeter/eess-md'
import { diagram, classes as mmdClasses } from '@nielspeter/eess-mermaid'
import { classes as tsClasses, type ArchProject } from '@nielspeter/eess-ts'

// Kernel re-exports (plan 0089 — standalone sufficiency): see mermaid-ts.ts.
export { finishPreset } from '@nielspeter/eess'
export { correspondence } from '@nielspeter/eess'
export type { ArchViolation, Direction, PresetReportOptions } from '@nielspeter/eess'

// A fence's language tag says it is Mermaid; it does not say which DIAGRAM it
// is, and `diagram()` only ever parses a class diagram. Selecting on the tag
// alone fed sequence/flow/state/gantt fences to the class-diagram parser, which
// threw out of the preset and abandoned every diagram in the corpus (bug 0209).
//
// So we select on content — but by EXCLUDING the diagram kinds we know are
// something else, never by requiring the `classDiagram` keyword. An allowlist
// is fail-open: it drops anything it fails to recognise, silently, and review
// measured exactly that (a `%%{init}%%` theme directive ahead of the keyword
// parses fine and was skipped). A denylist is fail-closed: an unrecognised
// header reaches `diagram()`, which either parses it or produces an attributed
// finding. A future Mermaid diagram kind therefore costs a false positive that
// is loud, not coverage that vanishes.
// Kinds we know eess-mermaid cannot parse but which ARE legal Mermaid. Used only
// to phrase the finding honestly — they still reach the parser (fail-closed), and
// blaming the author's syntax for a grammar gap is the wrong attribution.
const KNOWN_UNMODELLED = /^(?:classDiagram-v2)\b/

const FOREIGN_HEADER =
  /^(?:sequenceDiagram|flowchart|graph|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|kanban|architecture(?:-beta)?|radar(?:-beta)?|treemap(?:-beta)?|zenuml|info|C4(?:Context|Container|Component|Dynamic|Deployment))\b/

// Mermaid's grammar treats `%%…` lines as hidden terminals and permits a
// `---` frontmatter block, so the diagram keyword is not necessarily the first
// thing in the fence. Find the first line that actually declares the kind.
function declaredKind(body: string): string {
  const lines = body.split(/\r?\n/)
  let i = 0
  if (lines[0]?.trim() === '---') {
    i = 1
    while (i < lines.length && lines[i]?.trim() !== '---') i += 1
    i += 1
  }
  let inDirective = false
  for (; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? ''
    if (line === '') continue
    // `%%{ … }%%` may span lines. Track it, or the continuation line gets read
    // as the declared kind — measured: a multi-line init block ahead of a
    // sequenceDiagram made it selected, and `skipped` reported 0 (review).
    if (inDirective) {
      if (line.endsWith('}%%')) inDirective = false
      continue
    }
    if (line.startsWith('%%{') && !line.endsWith('}%%')) {
      inDirective = true
      continue
    }
    if (line.startsWith('%%')) continue
    return line
  }
  return ''
}

export interface EmbeddedDiagramsMatchCodeOptions extends PresetReportOptions {
  /** Glob (matched against a class's directory) restricting which TS classes participate. */
  readonly scope?: string
  /**
   * Completeness direction. Default `left-to-right` — every class named in an
   * embedded diagram must exist in code (a diagram fragment in an ADR need not
   * list every code class).
   */
  readonly completeness?: Direction
}

/**
 * Cross-validate Mermaid **class diagrams** embedded as fenced ```mermaid blocks
 * in the markdown corpus against TypeScript code, with violations pointing at the
 * markdown file and the fence line. Composed from the kernel `correspondence()`.
 *
 * **Scope.** Only class diagrams are compared. A fence declaring another kind
 * (`sequenceDiagram`, `flowchart`, `gantt`, …) is skipped as a different
 * artifact — see {@link embeddedDiagramStats}'s `skipped` for how many. A fence
 * whose kind is unrecognised is still parsed, so an unknown diagram costs a loud
 * finding rather than silent coverage loss.
 *
 * **This preset does not fail on an empty selection.** A corpus with no class
 * diagrams returns no violations. Gate on {@link embeddedDiagramStats} if a
 * non-empty run is what you mean to assert.
 */
export function embeddedDiagramsMatchCode(
  corpus: Corpus,
  project: ArchProject,
  options: EmbeddedDiagramsMatchCodeOptions = {},
): ArchViolation[] {
  const scope = options.scope ?? '**/src/**'
  const direction = options.completeness ?? 'left-to-right'

  const right = tsClasses(project)
    .that()
    .resideInFolder(scope)
    .select({
      label: 'TS class',
      identify: (c) => ({
        name: c.getName() ?? '<anonymous>',
        file: c.getSourceFile().getFilePath(),
        line: c.getStartLineNumber(),
      }),
    })

  const violations: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    for (const block of classDiagramBlocks(doc)) {
      let d
      try {
        d = diagram(block.value)
      } catch (e) {
        // A fence that DECLARES classDiagram and still will not parse is a real
        // finding about this document — report it against the markdown file and
        // fence line rather than throwing out of the preset (bug 0209).
        violations.push({
          rule: 'embedded diagrams should parse as Mermaid',
          ruleId: 'crossval/embedded-diagram',
          element: doc.relPath,
          file: doc.file,
          line: block.line,
          message:
            `embedded ${kindOf(block.value)} does not parse as a Mermaid class diagram: ${detailOf(e)}` +
            (KNOWN_UNMODELLED.test(kindOf(block.value))
              ? ' — this is legal Mermaid that eess-mermaid does not model yet, not a syntax error in your document'
              : ''),
          because:
            'A diagram that cannot be parsed cannot be compared against code, so it silently stops constraining it.',
          // Deliberately offers ONE remedy. The earlier text ended "or remove the
          // fence if it is not a class diagram" — review measured that an agent
          // taking that branch turns red into green over a document whose drift
          // is still there. A remedy that remediates by deleting the evidence is
          // not a remedy (ADR-009 rule 2).
          suggestion:
            'Fix the diagram syntax so it parses as a Mermaid class diagram. If this fence is a diagram kind eess-mermaid does not model, report it rather than deleting the fence.',
        })
        continue
      }
      const left = mmdClasses(d).select({
        label: `diagram class (in ${doc.relPath})`,
        // point violations at the markdown file + fence line, not the parsed diagram
        identify: (c) => ({ name: c.name, file: doc.file, line: block.line }),
      })
      violations.push(
        ...correspondence({ left, right })
          .should()
          .beComplete({ direction })
          .rule({ id: 'crossval/embedded-diagram' })
          .violations(),
      )
    }
  }
  return finishPreset(violations, options)
}

/** The declared kind of a fence, for phrasing a finding. */
function kindOf(body: string): string {
  const kind = declaredKind(body).split(/[\s{]/)[0] ?? ''
  return kind === '' ? 'diagram' : kind
}

/**
 * The informative line of a parse failure. `MermaidUnitParseError`'s message is
 * a constant prefix followed by the real lexer/parser errors, so taking line 0
 * yields `MermaidUnit parse failed:` and no diagnosis at all — measured. The ER
 * sibling takes line 1 for the same reason.
 */
function detailOf(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const lines = e.message.split('\n')
  return lines[1] ?? lines[0] ?? e.message
}

/** The class-diagram fences of one document — the blocks this binding models. */
function classDiagramBlocks(doc: MdDocument) {
  return doc.codeBlocks.filter(
    (b) => b.lang === 'mermaid' && !FOREIGN_HEADER.test(declaredKind(b.value)),
  )
}

/** What a run examined — a caller's non-vacuity evidence (ADR-010). */
export interface EmbeddedDiagramStats {
  /** Documents holding at least one fence this binding selects. */
  readonly documents: number
  /**
   * Fences selected for comparison. A fence that turns out not to parse is
   * selected and then reported, not compared — so this is the size of the
   * attempted set, not of the succeeded one.
   */
  readonly diagrams: number
  /**
   * Mermaid fences skipped as another diagram kind. A selector that silently
   * drops units is the failure this binding already shipped once, so the count
   * is reported rather than left implicit (bug 0209).
   */
  readonly skipped: number
}

/**
 * Count what {@link embeddedDiagramsMatchCode} would compare, so a caller can
 * tell "no drift" from "nothing looked at". A green run over zero diagrams is
 * not evidence, and this binding is otherwise unable to say which it produced
 * (bug 0209). Mirrors md-mermaid-er's stats export.
 */
export function embeddedDiagramStats(corpus: Corpus): EmbeddedDiagramStats {
  let documents = 0
  let diagrams = 0
  let skipped = 0
  for (const doc of corpus.documents()) {
    const mermaid = doc.codeBlocks.filter((b) => b.lang === 'mermaid')
    const blocks = classDiagramBlocks(doc)
    skipped += mermaid.length - blocks.length
    if (blocks.length === 0) continue
    documents += 1
    diagrams += blocks.length
  }
  return { documents, diagrams, skipped }
}
