import picomatch from 'picomatch'
import {
  collectResult,
  globNode,
  type ArchViolation,
  type CollectResult,
  type Condition,
  type Predicate,
} from '@nielspeter/eess'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import { proseText } from '../model/prose.js'
import { stampedByDocument } from '../model/by-document.js'
import { readFields, type FieldForm, type FieldOptions } from '../model/fields.js'
import { unnamedFormFindings } from './field-findings.js'

/**
 * Controlled-vocabulary primitive (plan 0069 Phase 4): derive a term set from
 * the corpus, then assert that named references in prose resolve against it.
 *
 * Both halves are consumer parameters — where the terms come from
 * (`fromFolders` / `fromHeadings` / explicit `terms`) and what a reference
 * looks like (the `label` pattern). Nothing domain-shaped lives here.
 */
export interface VocabularyOptions {
  /**
   * Glob over directory paths (repo-relative, POSIX); each matched
   * directory's basename becomes a term — e.g. folders-as-canonical-names.
   */
  readonly fromFolders?: string
  /** Glob over documents; every heading whose depth matches becomes a term. */
  readonly fromHeadings?: { readonly files: string; readonly depth?: number }
  /** Explicit terms, unioned with the derived ones. */
  readonly terms?: readonly string[]
  /** Normalization applied to terms AND references before comparing. Default: trim. */
  readonly normalize?: (value: string) => string
}

export interface Vocabulary {
  /** The normalized term set. */
  readonly terms: ReadonlySet<string>
  /** The normalization in force (shared with `resolveAgainst`). */
  readonly normalize: (value: string) => string
}

const defaultNormalize = (value: string): string => value.trim()

/** Derive a controlled vocabulary from the corpus. */
export function vocabulary(corpus: Corpus, options: VocabularyOptions): Vocabulary {
  const normalize = options.normalize ?? defaultNormalize
  const terms = new Set<string>()

  if (options.fromFolders !== undefined) {
    const matches = picomatch(options.fromFolders)
    const dirs = new Set<string>()
    for (const rel of corpus.fileIndex) {
      const parts = rel.split('/')
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    }
    for (const dir of dirs) {
      if (matches(dir)) {
        const base = dir.split('/').pop()
        if (base !== undefined && base !== '') terms.add(normalize(base))
      }
    }
  }

  if (options.fromHeadings !== undefined) {
    const { files, depth } = options.fromHeadings
    const inFiles = picomatch(files)
    for (const doc of corpus.documents()) {
      if (!inFiles(doc.relPath)) continue
      for (const section of doc.sections) {
        if (depth !== undefined && section.depth !== depth) continue
        terms.add(normalize(section.name))
      }
    }
  }

  for (const t of options.terms ?? []) terms.add(normalize(t))

  return { terms, normalize }
}

/** A labeled named reference found in prose — e.g. `Bounded Context: Billing`. */
export interface MdTerm {
  /** The referenced value (markdown emphasis stripped, trimmed). */
  readonly value: string
  /** The line's text after the label match, before cleanup. */
  readonly raw: string
  readonly doc: MdDocument
  readonly line: number
  /** The label as written, without its colon or emphasis (plan 0468). */
  readonly label: string
  /** The form it was read in; `'pattern'` for a `terms()` element (plan 0468). */
  readonly form: FieldForm | 'pattern'
}

export interface TermsOptions {
  /** Pattern locating a labeled reference on a line — e.g. `/Bounded Context:/`. */
  readonly label: RegExp
  /**
   * Extract the referenced value from the text following the label match.
   * Default: strip markdown emphasis characters and trim.
   */
  readonly value?: (rest: string) => string
}

const defaultValue = (rest: string): string =>
  rest
    .replace(/[*_`]/g, '')
    .trim()
    .replace(/\s+[·—–|].*$/, '')
    .trim()

function collectTerms(corpus: Corpus, options: TermsOptions): MdTerm[] {
  const extract = options.value ?? defaultValue
  // Non-global copy: a caller's /g regex would carry lastIndex across lines.
  const label = new RegExp(options.label.source, options.label.flags.replace(/g/g, ''))
  const out: MdTerm[] = []
  for (const doc of corpus.documents()) {
    // A closed fence is an example, so its prose never yields terms. Only a closed one: a builder cannot
    // report a fence that never closes, so it reads past one rather than drop the rest (bug 0287).
    const lines = proseText(doc.text, 'closed-fences', doc.root).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const m = label.exec(line)
      if (!m) continue
      const raw = line.slice(m.index + m[0].length)
      const value = extract(raw)
      const written = m[0].replace(/[*_:]/g, '').replace(/\s+/g, ' ').trim()
      if (value !== '') {
        out.push({ value, raw, doc, line: i + 1, label: written, form: 'pattern' })
      }
    }
  }
  return out
}

const resideInFile = (glob: string): Predicate<MdTerm> => {
  const matches = picomatch(glob)
  return {
    description: `reside in file '${glob}'`,
    test: (t) => matches(t.doc.relPath),
    // Declared, so an absence rule over a broken glob is diagnosed (plan 0456).
    globs: globNode({ glob, kind: 'file-path', base: 'normalized' }),
    originLabel: `resideInFile("${glob}")`,
  }
}

/** A vocabulary, or a pattern the whole value must match (plan 0468). */
export type Allowed = Vocabulary | RegExp

/** Whether a value is allowed, and the clause a finding says when it is not. */
export function judge(allowed: Allowed): { ok: (value: string) => boolean; says: string } {
  if (allowed instanceof RegExp) {
    // A copy without `g`/`y`, so a caller's stateful pattern judges every value alike; anchored, so
    // `/fixed/` does not pass `unfixed`; without `m`, so `^…$` spans the whole value, not one line.
    const whole = new RegExp(`^(?:${allowed.source})$`, allowed.flags.replace(/[gym]/g, ''))
    return { ok: (v) => whole.test(v), says: `does not match ${String(allowed)}` }
  }
  return {
    ok: (v) => allowed.terms.has(allowed.normalize(v)),
    says: `does not resolve against the vocabulary (${String(allowed.terms.size)} terms)`,
  }
}

const resolveAgainst = (allowed: Allowed): Condition<MdTerm> => {
  const { ok, says } = judge(allowed)
  return {
    description:
      allowed instanceof RegExp ? `match ${String(allowed)}` : 'resolve against the vocabulary',
    evaluate: (elements, ctx) =>
      elements
        .filter((t) => !ok(t.value))
        .map(
          (t): ArchViolation => ({
            rule: ctx.rule,
            ...(ctx.ruleId !== undefined && { ruleId: ctx.ruleId }),
            element: `${t.doc.relPath}:${t.line}`,
            file: t.doc.file,
            line: t.line,
            // A field names its label and line; it never lists the set, which can be hundreds long.
            message: valueMessage(t, says),
            ...(ctx.because !== undefined && { because: ctx.because }),
            ...(ctx.suggestion !== undefined && { suggestion: ctx.suggestion }),
            ...(ctx.docs !== undefined && { docs: ctx.docs }),
          }),
        ),
  }
}

/**
 * A value finding. A field names its label and line; one whose value is empty after cutting (an
 * emoji-only `✅`, a `### Status:` with the value elsewhere, a cut that kept nothing) says so, with
 * the text it read, so the author is not sent to a vocabulary for a value that is not there.
 */
function valueMessage(t: MdTerm, says: string): string {
  if (t.form === 'pattern') return `'${t.value}' ${says}`
  const where = `(${t.label}, line ${String(t.line)})`
  if (t.value === '') {
    const read = t.raw.replace(/\s+/g, ' ').trim()
    return `${where} has no value this rule can read${read === '' ? '' : ` in '${read}'`}`
  }
  return `'${t.value}' ${where} ${says}`
}

/** What a `TermRuleBuilder` reads: a `terms()` pattern, or a `fields()` label in named forms. */
type Source =
  | { readonly kind: 'pattern'; readonly options: TermsOptions }
  | { readonly kind: 'fields'; readonly options: FieldOptions }

function fieldTerms(corpus: Corpus, options: FieldOptions): MdTerm[] {
  return stampedByDocument(corpus, (doc) =>
    readFields(doc, options).flatMap((f) =>
      f.values.map((value) => ({ value, raw: f.raw, line: f.line, label: f.label, form: f.form })),
    ),
  )
}

/** Rule builder over labeled named references in the corpus's prose. */
export class TermRuleBuilder extends CorpusRuleBuilder<MdTerm> {
  protected readonly noun = 'terms'

  constructor(
    corpus: Corpus,
    private readonly source: Source,
  ) {
    super(corpus)
  }

  protected getElements(): MdTerm[] {
    return this.source.kind === 'pattern'
      ? collectTerms(this.project, this.source.options)
      : fieldTerms(this.project, this.source.options)
  }

  /**
   * The base result, plus a finding for each label this `fields()` rule's selection holds in a form
   * it does not read. The scan examines nothing the rule asserts over, so it does not raise
   * `examined` (as `links()`'s declaration scan).
   */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    if (this.source.kind !== 'fields') return base
    const findings = unnamedFormFindings(
      this.project,
      this.source.options,
      this._predicates,
      this.buildConditionContext(),
      base,
    )
    if (findings.length === 0) return base
    const causes = findings.filter((v) => v.bypassFilters === true).length
    return collectResult([...base, ...findings], {
      examined: base.examined,
      sourceEmpty: base.sourceEmpty,
      declaredEmpty: base.declaredEmpty,
      notRun: base.notRun,
      deadGlob: base.deadGlob,
      undecided: (base.undecided ?? 0) + causes,
    })
  }
  protected locate(e: MdTerm): MdLocation {
    return atLine(e)
  }

  /** Filter to references in documents whose path matches the glob. */
  resideInFile(glob: string): this {
    return this.addPredicate(resideInFile(glob))
  }

  /**
   * Assert every value is allowed: a term of the vocabulary, or a whole-value match of the pattern.
   * A field's finding names its label and line, never the set.
   */
  resolveAgainst(allowed: Vocabulary | RegExp): this {
    return this.addCondition(resolveAgainst(allowed))
  }
}

/** Entry point: build rules over labeled named references (`Label: Value` lines). */
export function terms(corpus: Corpus, options: TermsOptions): TermRuleBuilder {
  return new TermRuleBuilder(corpus, { kind: 'pattern', options })
}

/**
 * Entry point: rules over a labelled value, read in the forms the caller names (plan 0468):
 * `fields(c, { label: 'Status', forms: ['bold', 'heading'] }).should().resolveAgainst(states)`.
 * A label the rule's selection writes with markup it does not read is reported; plain prose is not.
 */
export function fields(corpus: Corpus, options: FieldOptions): TermRuleBuilder {
  return new TermRuleBuilder(corpus, { kind: 'fields', options })
}
