/**
 * Plan 0624's fixture: one document per outcome class of `haveField`'s reading, and the specs the
 * golden table (Phase 1a) and the agreement test (Phase 1b) read them under. The class each document
 * stands for is its name; the agreement test asserts that each occurs, with its count.
 */
import { docs, isArchConfigError, predicateHaveField, type Corpus } from '../../src/index.js'
import type { HaveFieldOptions } from '../../src/builders/have-field.js'

const doc = (...lines: readonly string[]): string => [...lines, ''].join('\n')

/** One document per class, keyed by its repo-relative path. */
export const FIELD_DOCS: Readonly<Record<string, string>> = {
  'docs/value.md': doc('# A', '', '**Status:** open'),
  'docs/conflict-disagree.md': doc('# A', '', '**Status:** open', '**Status:** closed'),
  'docs/conflict-agree.md': doc('# A', '', '**Status:** open', '**Status:** open'),
  'docs/empty.md': doc('# A', '', '**Status:**'),
  'docs/unread-form.md': doc('# A', '', '## Status: open', '', '## Body', '', 'text'),
  'docs/unclosed-fence.md': doc('# A', '', '```', 'Status: open'),
  'docs/indented.md': doc('# A', '', 'Intro.', '', '    Status: open'),
  'docs/outside-header.md': doc('# A', '', '## Body', '', '**Status:** open'),
  'docs/absent-with-labels.md': doc('# A', '', '**Owner:** Ann'),
  'docs/absent-no-labels.md': doc('# A', '', 'Plain text.'),
  'docs/value-prose-note.md': doc('# A', '', '**Status:** open', 'Status: closed'),
  'docs/value-unread-form-note.md': doc('# A', '', '**Status:** open', '', '## Status: closed'),
  'docs/alias.md': doc('# A', '', '**State:** open'),
  'docs/section-present.md': doc('# A', '', '## Meta', '', '**Status:** open'),
  'docs/split.md': doc('# A', '', '**Tags:** red, blue'),
  'docs/disallowed.md': doc('# A', '', '**Status:** closed'),
  'docs/outside-section.md': doc(
    '# A',
    '',
    '## Meta',
    '',
    'text',
    '',
    '## Other',
    '',
    '**Status:** open',
  ),
  // Two causes, and two notes, so a reading that keeps only the first is seen.
  'docs/unread-form-twice.md': doc(
    '# A',
    '',
    '## Status: open',
    '',
    '## Status: closed',
    '',
    '## Body',
  ),
  'docs/value-two-notes.md': doc(
    '# A',
    '',
    '**Status:** open',
    'Status: closed',
    '',
    '## Status: shut',
  ),
  // Proposal 028's Measured rows 1 and 3: an indented example above the real value, and an indented
  // line like a heading above it (bug 0622's shape).
  'docs/measured-indented-example.md': doc(
    'Intro.',
    '',
    '    Status: fake',
    '',
    '**Status:** real',
  ),
  'docs/measured-indented-heading.md': doc('# B', '', '    ## Notes', '', '**Status:** open'),
}

/** The specs, by name. Each reads every document above. */
export const FIELD_SPECS: Readonly<Record<string, HaveFieldOptions>> = {
  header: { label: 'Status', forms: ['bold', 'plain'], region: 'header' },
  'header-aliases': {
    label: 'Status',
    forms: ['bold', 'plain'],
    region: 'header',
    aliases: ['State'],
  },
  section: { label: 'Status', forms: ['bold', 'plain'], region: { section: 'Meta' } },
  split: { label: 'Tags', forms: ['bold'], split: (v) => v.split(/,\s*/) },
  value: {
    label: 'Status',
    forms: ['bold', 'plain'],
    region: 'header',
    value: (v) => v.toUpperCase(),
  },
  'one-of': { label: 'Status', forms: ['bold', 'plain'], region: 'header', oneOf: /^open$/ },
}

/** What `haveField` decides for one document under one spec: the golden table's row. */
export interface GoldenRow {
  /** `predicateHaveField(spec).test(doc)`, or `'refuses'` when it throws on an undecided document. */
  readonly test: boolean | 'refuses'
  /** `predicateHaveField(spec).undecided(doc)`'s messages. */
  readonly undecided: readonly string[]
  /** The `haveField` condition's messages for this document, in order. */
  readonly condition: readonly string[]
}

/** The golden table: `spec name → document path → row`, computed through the public builders. */
export function goldenTable(
  corpusOf: (files: Readonly<Record<string, string>>) => Corpus,
): Record<string, Record<string, GoldenRow>> {
  const c = corpusOf(FIELD_DOCS)
  const out: Record<string, Record<string, GoldenRow>> = {}
  for (const [name, spec] of Object.entries(FIELD_SPECS)) {
    const p = predicateHaveField(spec)
    const found = docs(c).should().haveField(spec).violations()
    const rows: Record<string, GoldenRow> = {}
    for (const d of c.documents()) {
      let test: boolean | 'refuses'
      try {
        test = p.test(d)
      } catch (e) {
        // Only the predicate's own refusal; any other throw is a defect and fails the run.
        if (!isArchConfigError(e)) throw e
        test = 'refuses'
      }
      rows[d.relPath] = {
        test,
        undecided: (p.undecided?.(d) ?? []).map((u) => u.message),
        condition: found.filter((v) => v.file === d.file).map((v) => v.message),
      }
    }
    out[name] = rows
  }
  return out
}
