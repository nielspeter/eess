import {
  ArchConfigError,
  globNode,
  type Condition,
  type ConditionContext,
  type Direction,
} from '@nielspeter/eess'
import { stampGlobs } from '@nielspeter/eess/internal'
import picomatch from 'picomatch'
import type { Corpus } from '../corpus.js'
import { mdSelectorFault } from '../model/selector-fault.js'
import type { MdDocument } from '../model/document.js'
import { fieldVerdict } from '../model/field-verdict.js'
import type { FieldOccurrence, FieldOptions } from '../model/fields.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import { declarationViolation, type Agreement } from './agreement.js'

/** One group: the values that belong in its folders (plan 0495). */
export interface FolderGroup {
  /** Compared with the document's value after `normalize`. */
  readonly values: readonly string[]
  /**
   * Globs relative to the corpus's `cwd`, as `resideInFolder` takes them; or `'rest'`: every
   * selected document that is in no other group's folders. At most one group per rule is `'rest'`.
   */
  readonly folders: readonly string[] | 'rest'
}

/** What `agreeWithFolder` asks of a document (plan 0495, proposal 017 block 5). */
export interface AgreeWithFolderOptions {
  /** Read as `fields()` reads it and resolved as `haveField` resolves it. One value per document. */
  readonly field: Omit<FieldOptions, 'split'>
  readonly groups: readonly FolderGroup[]
  /**
   * The kernel's `Direction`. Left is the value, right is the folder:
   * - `'left-to-right'` (value → folder): a document whose value is in a group sits in one of that
   *   group's folders;
   * - `'right-to-left'` (folder → value): a document in a group's folders carries one of that
   *   group's values;
   * - `'both'`.
   */
  readonly direction: Direction
  /** Applied to the value read and to every declared value before they are compared. Default: none. */
  readonly normalize?: (value: string) => string
}

const ARROW: Readonly<Record<Direction, string>> = {
  'left-to-right': 'value → folder',
  'right-to-left': 'folder → value',
  both: 'value → folder and folder → value',
}

/** One group as the rule reads it. Named by its first value, as every finding names it. */
interface Group {
  readonly at: number
  readonly name: string
  readonly values: readonly string[]
  readonly globs: readonly string[] | 'rest'
  readonly match: (relPath: string) => boolean
}

/** What one run decided about the declaration, before any document is judged. */
interface Prepared {
  readonly groups: readonly Group[]
  /** Groups with a dead folder: their values' placement findings are F7's, not one per record. */
  readonly dead: ReadonlySet<number>
  readonly findings: (context: ConditionContext) => ArchViolation[]
}

const DIRECTIONS: readonly Direction[] = ['left-to-right', 'right-to-left', 'both']

/** The configuration refusals (an `ArchConfigError` naming the option, ADR-009). */
function refuse(o: AgreeWithFolderOptions): void {
  const fail = (option: string, why: string): never => {
    throw new ArchConfigError('agreeWithFolder', `agreeWithFolder: ${option} ${why}`)
  }
  if (!DIRECTIONS.includes(o.direction)) {
    fail('direction', `must be one of ${DIRECTIONS.join(', ')}; it has no default`)
  }
  if (o.groups.length === 0) {
    fail('groups', 'is empty; declare each group of values and the folders they belong in')
  }
  const norm = o.normalize ?? ((v: string): string => v)
  const valueOwner = new Map<string, number>()
  const globOwner = new Map<string, number>()
  let rest: number | undefined
  o.groups.forEach((g, i) => {
    const at = `groups[${String(i)}]`
    if (g.values.length === 0) fail(`${at}.values`, 'is empty; a group names the values it holds')
    if (g.folders === 'rest') {
      if (rest !== undefined) {
        fail(
          `${at}.folders`,
          `is 'rest', and so is groups[${String(rest)}]: at most one group binds the rest`,
        )
      }
      rest = i
    } else {
      if (g.folders.length === 0) {
        fail(`${at}.folders`, "is empty; name the group's folder globs, or 'rest'")
      }
      for (const glob of g.folders) {
        const other = globOwner.get(glob)
        if (other !== undefined && other !== i) {
          fail(
            `${at}.folders:`,
            `'${glob}' is also groups[${String(other)}]'s; a folder binds one group`,
          )
        }
        globOwner.set(glob, i)
      }
    }
    for (const v of g.values) {
      if (v.trim() === '') fail(`${at}.values`, 'holds an empty value')
      const key = norm(v)
      const other = valueOwner.get(key)
      if (other !== undefined && other !== i) {
        const after = o.normalize === undefined ? '' : ' after normalize'
        fail(
          `${at}.values:`,
          `'${v}' is also in groups[${String(other)}]${after}; a value belongs to one group`,
        )
      }
      valueOwner.set(key, i)
    }
  })
}

/** The groups as the rule reads them, after `refuse`. */
function groupsOf(o: AgreeWithFolderOptions): Group[] {
  return o.groups.map((g, at) => ({
    at,
    name: g.values[0] ?? '',
    values: g.values,
    globs: g.folders,
    match: g.folders === 'rest' ? (): boolean => false : picomatch([...g.folders]),
  }))
}

/** Why a group's folder glob can bind no document, or `undefined` when it can. */
function deadGlob(corpus: Corpus, group: Group, glob: string): string | undefined {
  // Text faults and unloaded Markdown are md's selector diagnosis, not a second copy of it.
  const site = stampGlobs(
    globNode({ glob, kind: 'file-path', base: 'normalized' }),
    'selector',
    () => `${group.name}'s folder ${glob}`,
  )
  const fault = mdSelectorFault([site], corpus)
  if (fault !== undefined) return `${fault.cause}. ${fault.remedy}`
  const match = picomatch(glob)
  for (const p of corpus.fileIndex) if (match(p)) return undefined
  return ''
}

/**
 * F7 and F8, once per rule, over the corpus rather than the selection (plan 0495, D2): a caller may
 * narrow with `.that()` and still declare every group.
 */
function prepare(corpus: Corpus, o: AgreeWithFolderOptions): Prepared {
  refuse(o)
  const groups = groupsOf(o)
  const dead = new Set<number>()
  const reports: { element: string; message: string }[] = []
  for (const g of groups) {
    if (g.globs === 'rest') continue
    const why = g.globs.map((glob) => ({ glob, why: deadGlob(corpus, g, glob) }))
    const gone = why.filter((w) => w.why !== undefined)
    for (const { glob, why: cause } of gone) {
      dead.add(g.at)
      reports.push({
        element: `${g.name}'s folder ${glob}`,
        message:
          cause === '' || cause === undefined
            ? `${g.name}'s folder ${glob} matches no path in the corpus; if it is a typo, correct ` +
              'it; if the folder has no record yet, file the first one there, or leave the group out'
            : `${g.name}'s folder ${glob}: ${cause}`,
      })
    }
  }
  if (o.direction !== 'left-to-right') {
    const all = corpus.documents()
    for (const g of groups) {
      if (g.globs === 'rest' || dead.has(g.at)) continue
      if (all.some((d) => g.match(d.relPath))) continue
      reports.push({
        element: `${g.name}'s folders`,
        message: `${g.name}'s folders hold no document in the corpus; the group judges nothing`,
      })
    }
  }
  return {
    groups,
    dead,
    findings: (context) =>
      reports.map((r) =>
        declarationViolation(`agreeWithFolder → ${r.element}`, r.message, context),
      ),
  }
}

/**
 * `docs().should().agreeWithFolder()` (plan 0495): a document's value and the folder it sits in say
 * the same thing. The value is read once, by plan 0469's resolver; the groups are a closed set within
 * the bound folders. The builder owns what a condition cannot: the declaration's findings
 * (`declarationFindings`, reported even over an empty selection) and, after the run, whether this
 * agreement judged anything (`judgedNone`).
 */
export class FolderAgreement implements Agreement {
  readonly condition: Condition<MdDocument>
  private prepared: Prepared | undefined
  private last: LastRun | undefined

  constructor(
    private readonly corpus: Corpus,
    private readonly options: AgreeWithFolderOptions,
  ) {
    this.condition = {
      description: `agree with their folder (${options.field.label}, ${ARROW[options.direction]})`,
      evaluate: (elements, context) => this.evaluate(elements, context),
    }
  }

  /** Refuse a malformed declaration and decide F7/F8, once per run, before any document is judged. */
  start(): void {
    this.prepared = prepare(this.corpus, this.options)
    this.last = undefined
  }

  /** The declaration's findings and, when it judged none, that one (the `Agreement` contract). */
  findings(context: ConditionContext): ArchViolation[] {
    return [...this.declarationFindings(context), ...this.judgedNone(context)]
  }

  /** F7 and F8, for this run. */
  declarationFindings(context: ConditionContext): ArchViolation[] {
    return (this.prepared ?? prepare(this.corpus, this.options)).findings(context)
  }

  /**
   * Plan 0495, decision D1 as rebuilt after review: an agreement that ran over a non-empty selection
   * and gave no document a verdict is this agreement's own finding, unsuppressable, whatever
   * conditions sit beside it, so a broken agreement cannot hide behind another condition's count,
   * or another agreement's. It names one of two causes: values were read, but each sits outside
   * every group's folders and no group names it (the live values are undeclared, or the selection
   * misses the bound folders); or no value was read (a misspelt label, the wrong forms or region).
   */
  judgedNone(context: ConditionContext): ArchViolation[] {
    const last = this.last
    if (last === undefined || last.selected === 0 || last.judged > 0) return []
    const message =
      last.unplaced.count > 0
        ? `${String(last.unplaced.count)} selected documents carry values no group names (${[...last.unplaced.values].join(', ')}) and sit in no group's folders: declare them in a 'rest' group, or select a folder a group binds`
        : `selected ${String(last.selected)} documents, judged none: the field read no value (check its label, forms or region)`
    return [declarationViolation(`agreeWithFolder → ${this.options.field.label}`, message, context)]
  }

  private evaluate(elements: readonly MdDocument[], context: ConditionContext): ArchViolation[] {
    const j = judgeOf(this.prepared ?? prepare(this.corpus, this.options), this.options)
    const out: ArchViolation[] = []
    const judged = new Set<MdDocument>()
    const overlaps = new Map<string, Overlap>()
    const unplaced = { count: 0, values: new Set<string>() }
    for (const d of elements) {
      const hits = j.groups.filter((g) => g.match(d.relPath))
      if (hits.length > 1) {
        // F6: the document is the declaration's finding, never judged by whichever group came first.
        addOverlaps(overlaps, hits, d)
        continue
      }
      const verdict = judgeDocument(j, d, hits[0] ?? j.rest)
      if (verdict.judged) judged.add(d)
      if (verdict.unplaced !== undefined) {
        unplaced.count += 1
        unplaced.values.add(verdict.unplaced)
      }
      for (const f of verdict.findings) {
        out.push(mdViolation({ ...f, file: d.file, context }))
      }
    }
    out.push(...overlapFindings(overlaps, context))
    this.last = { selected: elements.length, judged: judged.size, unplaced }
    return out
  }
}

/** What the last evaluation saw, for `judgedNone`. */
interface LastRun {
  readonly selected: number
  readonly judged: number
  /** Documents whose value was read, in no group's folders, and named by no group. */
  readonly unplaced: { readonly count: number; readonly values: ReadonlySet<string> }
}

/** One run's reading of the declaration, shared by every document it judges. */
interface Judge {
  readonly field: Omit<FieldOptions, 'split'>
  readonly groups: readonly Group[]
  readonly dead: ReadonlySet<number>
  readonly rest: Group | undefined
  readonly norm: (value: string) => string
  readonly byValue: ReadonlyMap<string, Group>
  readonly valueToFolder: boolean
  readonly folderToValue: boolean
  /** Every declared value, in group order, for F3. */
  readonly declared: string
  /** Every group's explicit globs, for a `'rest'` value's "belongs outside". */
  readonly explicit: readonly string[]
}

function judgeOf(p: Prepared, o: AgreeWithFolderOptions): Judge {
  const norm = o.normalize ?? ((v: string): string => v)
  const byValue = new Map<string, Group>()
  for (const g of p.groups) for (const v of g.values) byValue.set(norm(v), g)
  return {
    field: o.field,
    groups: p.groups,
    dead: p.dead,
    rest: p.groups.find((g) => g.globs === 'rest'),
    norm,
    byValue,
    valueToFolder: o.direction !== 'right-to-left',
    folderToValue: o.direction !== 'left-to-right',
    declared: p.groups.flatMap((g) => g.values).join(', '),
    explicit: p.groups.flatMap((g) => (g.globs === 'rest' ? [] : g.globs)),
  }
}

/** A finding about one document, before it gets the document's file and the rule's context. */
interface DocFinding {
  readonly line: number
  readonly element: string
  readonly message: string
}

interface DocVerdict {
  /** Given a verdict, and so counted in `examined` (D1). */
  readonly judged: boolean
  readonly findings: readonly DocFinding[]
  /** The value read, when the document sits in no group's folders and no group names it. */
  readonly unplaced?: string
}

const belongs = (j: Judge, g: Group): string =>
  g.globs === 'rest'
    ? `belongs outside ${j.explicit.join(', ')}`
    : `belongs in ${g.globs.join(', ')}`
const foldersOf = (g: Group): string =>
  g.globs === 'rest' ? `${g.name}'s folders ('rest')` : `${g.name}'s folders`

/** One document's verdict, by the direction table of plan 0495. `bound` is its folder's group. */
function judgeDocument(j: Judge, d: MdDocument, bound: Group | undefined): DocVerdict {
  const v = fieldVerdict(d, j.field)
  const causes = v.causes.map(
    (c): DocFinding => ({ line: c.line, element: c.element, message: c.message }),
  )
  if (v.resolved && v.occurrence !== undefined) {
    const placed = judgeValue(j, d, bound, v.occurrence)
    const raw = v.occurrence.values.join(', ')
    const named = j.byValue.has(j.norm(raw))
    // A resolved value's side causes (prose that disagrees, a label in a form the rule does not
    // read) are reported wherever the document is judged.
    if (placed !== undefined) return { judged: true, findings: [...placed, ...causes] }
    return bound === undefined && !named
      ? { judged: false, findings: [], unplaced: raw }
      : { judged: false, findings: [] }
  }
  if (v.causes.some((c) => c.kind === 'unreadable')) {
    // F5: withheld, never counted as agreeing.
    return { judged: false, findings: bound !== undefined || j.valueToFolder ? causes : [] }
  }
  // F4: no value, reported only in a bound folder (bug 0444: lanes are the caller's).
  if (bound === undefined || !j.folderToValue) return { judged: false, findings: [] }
  return {
    judged: true,
    findings: causes.map((c) => ({
      ...c,
      message: `${d.relPath} is in ${foldersOf(bound)} and has ${c.message}`,
    })),
  }
}

/**
 * A resolved value against its folder: the placement findings (F1, F2, F3; none when it agrees), or
 * `undefined` when the document gets no verdict. A value whose group has a dead folder is F7's, so
 * its records are not each reported as belonging in the typo.
 */
function judgeValue(
  j: Judge,
  d: MdDocument,
  bound: Group | undefined,
  occ: FieldOccurrence,
): DocFinding[] | undefined {
  const raw = occ.values.join(', ')
  const owner = j.byValue.get(j.norm(raw))
  const at = { line: occ.line, element: `${d.relPath}:${String(occ.line)}` }
  const quoted = `\`${raw}\` (${occ.label}, line ${String(occ.line)})`
  if (bound === undefined) {
    if (owner === undefined || !j.valueToFolder || j.dead.has(owner.at)) return undefined
    const message = `${quoted} ${belongs(j, owner)}; ${d.relPath} is in none of its folders. Move it or change the value.`
    return [{ ...at, message }]
  }
  if (owner === undefined) {
    const message = `\`${raw}\` at line ${String(occ.line)} is none of the declared values (${j.declared}); fix the spelling, or add it to a group`
    return [{ ...at, message }]
  }
  if (owner === bound) return []
  if (j.dead.has(owner.at)) return undefined
  const message = `wrong folder: ${quoted} ${belongs(j, owner)}; ${d.relPath} is in ${foldersOf(bound)}. Move it or change the value.`
  return [{ ...at, message }]
}

/** Two groups that both bind a document, and the documents they share. */
interface Overlap {
  readonly a: Group
  readonly b: Group
  readonly docs: MdDocument[]
}

function addOverlaps(overlaps: Map<string, Overlap>, hits: readonly Group[], d: MdDocument): void {
  hits.forEach((a, i) => {
    for (const b of hits.slice(i + 1)) {
      const key = `${String(a.at)}:${String(b.at)}`
      const pair = overlaps.get(key) ?? { a, b, docs: [] }
      pair.docs.push(d)
      overlaps.set(key, pair)
    }
  })
}

const globsOf = (g: Group): string => (g.globs === 'rest' ? "'rest'" : g.globs.join(', '))

/** F6, one per overlapping pair of groups, at the first document they share. */
function overlapFindings(
  overlaps: ReadonlyMap<string, Overlap>,
  context: ConditionContext,
): ArchViolation[] {
  return [...overlaps.values()].map(({ a, b, docs }) => {
    const first = docs.slice(0, 2).map((d) => d.relPath)
    const [head] = docs
    return declarationViolation(
      `agreeWithFolder → ${a.name} and ${b.name}`,
      `${globsOf(a)} (${a.values.join(', ')}) and ${globsOf(b)} (${b.values.join(', ')}) both bind ${String(docs.length)} document(s), first ${first.join(', ')}; bind each folder to one group, or make one group 'rest'`,
      context,
      head?.file ?? '',
      head === undefined ? 0 : 1,
    )
  })
}
