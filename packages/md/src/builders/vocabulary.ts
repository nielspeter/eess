import picomatch from 'picomatch'
import { RuleBuilder, type Condition, type Predicate, type ArchViolation } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'

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

// Blank out fenced code (line-preserving) so example prose never yields terms.
const FENCE_RE = /(```|~~~)[\s\S]*?\1/g
function stripFencedCode(s: string): string {
  return s.replace(FENCE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
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
    const lines = stripFencedCode(doc.text).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const m = label.exec(line)
      if (!m) continue
      const raw = line.slice(m.index + m[0].length)
      const value = extract(raw)
      if (value !== '') out.push({ value, raw, doc, line: i + 1 })
    }
  }
  return out
}

const resideInFile = (glob: string): Predicate<MdTerm> => {
  const matches = picomatch(glob)
  return {
    description: `reside in file '${glob}'`,
    test: (t) => matches(t.doc.relPath),
  }
}

const resolveAgainst = (vocab: Vocabulary): Condition<MdTerm> => ({
  description: 'resolve against the vocabulary',
  evaluate: (elements, ctx) =>
    elements
      .filter((t) => !vocab.terms.has(vocab.normalize(t.value)))
      .map(
        (t): ArchViolation => ({
          rule: ctx.rule,
          ...(ctx.ruleId !== undefined && { ruleId: ctx.ruleId }),
          element: `${t.doc.relPath}:${t.line}`,
          file: t.doc.file,
          line: t.line,
          message: `'${t.value}' does not resolve against the vocabulary (${vocab.terms.size} terms)`,
          ...(ctx.because !== undefined && { because: ctx.because }),
          ...(ctx.suggestion !== undefined && { suggestion: ctx.suggestion }),
          ...(ctx.docs !== undefined && { docs: ctx.docs }),
        }),
      ),
})

/** Rule builder over labeled named references in the corpus's prose. */
export class TermRuleBuilder extends RuleBuilder<MdTerm, Corpus> {
  constructor(
    corpus: Corpus,
    private readonly opts: TermsOptions,
  ) {
    super(corpus)
  }

  protected getElements(): MdTerm[] {
    return collectTerms(this.project, this.opts)
  }

  /** Filter to references in documents whose path matches the glob. */
  resideInFile(glob: string): this {
    return this.addPredicate(resideInFile(glob))
  }

  /** Assert every reference's value is a term of the vocabulary. */
  resolveAgainst(vocab: Vocabulary): this {
    return this.addCondition(resolveAgainst(vocab))
  }
}

/** Entry point: build rules over labeled named references (`Label: Value` lines). */
export function terms(corpus: Corpus, options: TermsOptions): TermRuleBuilder {
  return new TermRuleBuilder(corpus, options)
}
