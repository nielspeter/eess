import { ArchConfigError, type Condition, type ConditionContext } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import { stateless } from '../model/name-match.js'
import { sectionsOf, titleFault, titleOf } from '../model/sections.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import { declarationViolation, type Agreement } from './agreement.js'

/** What `agreeWithPath` asks of a document (plan 0556, proposal 017 block 16). */
export interface AgreeWithPathOptions {
  /**
   * Matched against the document's path relative to the corpus's `cwd`; its named group `value` is
   * the path's value, as `mentions()` reads its pattern's named groups.
   */
  readonly path: RegExp
  /** Matched against the title as `haveTitle()` reads it; its named group `value` is the title's value. */
  readonly title: RegExp
  /** Applied to both values before they are compared. Default: none (exact strings). */
  readonly normalize?: (value: string) => string
}

/** True when `re` declares a named group `value`, in any branch. */
function hasValueGroup(re: RegExp): boolean {
  // An empty alternative makes the pattern match `''`, so `exec` reports every named group it has.
  const probe = new RegExp(`(?:${re.source})|`, re.flags.replace(/[gy]/g, ''))
  const groups = probe.exec('')?.groups
  return groups !== undefined && Object.hasOwn(groups, 'value')
}

/** The configuration refusals, at the call (an `ArchConfigError` naming the option, ADR-009). */
function refuse(o: AgreeWithPathOptions): void {
  const patterns: readonly (readonly [string, RegExp])[] = [
    ['path', o.path],
    ['title', o.title],
  ]
  for (const [option, re] of patterns) {
    if (!hasValueGroup(re)) {
      throw new ArchConfigError(
        'agreeWithPath',
        `agreeWithPath: ${option} ${String(re)} has no named group \`value\`; write the part to compare as (?<value>…)`,
      )
    }
  }
}

/** A value read from one side: as written, and as compared. */
interface Read {
  readonly raw: string
  readonly value: string
}

/**
 * The `value` group of `re` in `text`, or `undefined` when it holds no value: no match, a `value`
 * group that took no part in the match, an empty capture, or one `normalize` makes empty. Two sides
 * that read nothing never agree.
 */
function readValue(
  re: RegExp,
  text: string,
  normalize: ((v: string) => string) | undefined,
): Read | undefined {
  const raw = stateless(re).exec(text)?.groups?.['value']
  if (raw === undefined || raw === '') return undefined
  const value = normalize === undefined ? raw : normalize(raw)
  return value === '' ? undefined : { raw, value }
}

/** One document's finding, before the rule's context; `side` says which pattern it is about. */
interface DocFinding {
  readonly doc: MdDocument
  readonly line: number
  readonly message: string
  readonly side: 'path' | 'title' | 'both'
}

/** One document's two sides, read, and its own findings (P1 to P4). */
interface DocReading {
  readonly pathRead: boolean
  readonly titled: boolean
  readonly titleRead: boolean
  readonly judged: boolean
  readonly findings: readonly DocFinding[]
}

/** The line a title finding sits at: the first heading's, or 1. */
const headingLine = (d: MdDocument): number => sectionsOf(d)[0]?.line ?? 1

/** P1: the path holds no value. */
const noPathValue = (d: MdDocument, path: RegExp): DocFinding => ({
  doc: d,
  line: 1,
  side: 'path',
  message: `${d.relPath} holds no value the path pattern reads (${String(path)}): name the file as the pattern expects, or widen the pattern`,
})

/** P2: no title, in `titleFault`'s own words, called without a name so a title the pattern misses stays P3. */
const noTitle = (d: MdDocument): DocFinding => ({
  doc: d,
  line: headingLine(d),
  side: 'both',
  message: titleFault(d) ?? 'no title',
})

/** P3: the title holds no value. */
const noTitleValue = (d: MdDocument, text: string, title: RegExp): DocFinding => ({
  doc: d,
  line: headingLine(d),
  side: 'title',
  message: `its title "${text}" holds no value the title pattern reads (${String(title)})`,
})

/** P4: both sides read, and they differ. */
const differ = (
  d: MdDocument,
  fromPath: Read,
  fromTitle: Read,
  normalized: boolean,
): DocFinding => ({
  doc: d,
  line: headingLine(d),
  side: 'both',
  message: `the path says ${fromPath.raw} and the title says ${fromTitle.raw}${normalized ? ` (compared as ${fromPath.value} and ${fromTitle.value} after normalize)` : ''}: correct the one that is wrong, by renaming the file or editing the title`,
})

/** Read one document's path and title, and give its findings. */
function readDocument(d: MdDocument, o: AgreeWithPathOptions): DocReading {
  const fromPath = readValue(o.path, d.relPath, o.normalize)
  const findings: DocFinding[] = fromPath === undefined ? [noPathValue(d, o.path)] : []
  const pathRead = fromPath !== undefined
  const text = titleOf(d)
  if (text === undefined) {
    return {
      pathRead,
      titled: false,
      titleRead: false,
      judged: false,
      findings: [...findings, noTitle(d)],
    }
  }
  const fromTitle = readValue(o.title, text, o.normalize)
  if (fromTitle === undefined) findings.push(noTitleValue(d, text, o.title))
  if (fromPath === undefined || fromTitle === undefined) {
    return { pathRead, titled: true, titleRead: fromTitle !== undefined, judged: false, findings }
  }
  if (fromPath.value !== fromTitle.value) {
    findings.push(differ(d, fromPath, fromTitle, o.normalize !== undefined))
  }
  return { pathRead, titled: true, titleRead: true, judged: true, findings }
}

/**
 * One mistake, one finding: when nothing was judged, a side that read nothing is P5's, so its
 * per-document findings go.
 */
function deadSides(last: LastRun): ReadonlySet<DocFinding['side']> {
  const dead = new Set<DocFinding['side']>()
  if (last.judged === 0 && last.selected > 0) {
    if (last.pathRead === 0) dead.add('path')
    if (last.titled > 0 && last.titleRead === 0) dead.add('title')
  }
  return dead
}

/** What the last evaluation saw, for P5. */
interface LastRun {
  readonly selected: number
  readonly first: MdDocument | undefined
  readonly pathRead: number
  readonly titled: number
  readonly titleRead: number
  readonly judged: number
}

/**
 * `docs().should().agreeWithPath()` (plan 0556): a value read out of the document's own path and the
 * same value read out of its title agree. P1 to P4 are the document's own findings; P5, when a
 * non-empty selection gave no document a verdict, is this agreement's, through `findings`.
 */
export class PathAgreement implements Agreement {
  readonly condition: Condition<MdDocument>
  private last: LastRun | undefined

  constructor(private readonly options: AgreeWithPathOptions) {
    refuse(options)
    this.condition = {
      description: `agree with their path (${String(options.path)} and the title's ${String(options.title)})`,
      evaluate: (elements, context) => this.evaluate(elements, context),
    }
  }

  /** Forget the last run: a fork shares this instance, and each run reads only its own. */
  start(): void {
    this.last = undefined
  }

  /**
   * P5: a non-empty selection judged no document. One finding, at the first selected document,
   * naming each cause: a side that read nothing, or both sides reading but never on the same document.
   */
  findings(context: ConditionContext): ArchViolation[] {
    const last = this.last
    if (last === undefined || last.selected === 0 || last.judged > 0) return []
    const { path, title } = this.options
    const causes: string[] = []
    if (last.pathRead === 0) {
      causes.push(`the path pattern ${String(path)} read none of ${String(last.selected)} paths`)
    }
    if (last.titled === 0) {
      causes.push(`none of the ${String(last.selected)} documents has a title`)
    } else if (last.titleRead === 0) {
      causes.push(`the title pattern ${String(title)} read none of ${String(last.titled)} titles`)
    }
    if (causes.length === 0) {
      causes.push(
        `the path pattern read ${String(last.pathRead)} and the title pattern ${String(last.titleRead)}, but none on the same document`,
      )
    }
    return [
      declarationViolation(
        `agreeWithPath → ${String(path)}`,
        `selected ${String(last.selected)} documents, judged none: ${causes.join('; ')}`,
        context,
        last.first?.file ?? '',
        last.first === undefined ? 0 : 1,
      ),
    ]
  }

  private evaluate(elements: readonly MdDocument[], context: ConditionContext): ArchViolation[] {
    const readings = elements.map((d) => readDocument(d, this.options))
    const count = (has: (r: DocReading) => boolean): number => readings.filter(has).length
    const last: LastRun = {
      selected: elements.length,
      first: elements[0],
      pathRead: count((r) => r.pathRead),
      titled: count((r) => r.titled),
      titleRead: count((r) => r.titleRead),
      judged: count((r) => r.judged),
    }
    this.last = last
    const dead = deadSides(last)
    return readings
      .flatMap((r) => r.findings)
      .filter((f) => !dead.has(f.side))
      .map((f) =>
        mdViolation({
          element: `${f.doc.relPath}:${String(f.line)}`,
          file: f.doc.file,
          line: f.line,
          message: f.message,
          sourceText: f.doc.text,
          context,
        }),
      )
  }
}
