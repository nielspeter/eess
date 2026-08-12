import { finishPreset, type PresetReportOptions } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import type { ArchViolation } from '../model/violation.js'
import { collectTaskItems } from '../model/task-items.js'

/**
 * `honestyAtClose` — the ledger-reconciliation gate for an engineering corpus.
 *
 * The working method's first firm principle: when an item is finished, every
 * part of it ends as *done*, *done-otherwise*, *deferred to a named home*, or
 * *dropped on purpose* — and the deferral count is said out loud. "Silence is
 * not 'nothing deferred.'" A *done*-item that still carries an undisposed open
 * box has silently lost scope.
 *
 * This preset enforces only the mechanically-knowable slice — the *silent* case.
 * Whether a `deferred→<home>` is *truthful* is Tier-4 judgment for the reviewer.
 * So it is a necessary-not-sufficient floor (form-gated / content-judgment).
 *
 * Three findings: `silent-open-box`, `deferred-none-lie`, `state-folder-mismatch`
 * (see plan 0068 Phase 3). The GFM task boxes are read from mdast (via
 * `collectTaskItems`), so a `- [ ]` in fenced code or a blockquote is excluded
 * for free — no hand-rolled stripping. `deferred: none` summaries and the
 * `State:` header token are unambiguous prose lines, scanned from the source.
 */
export interface HonestyAtCloseOptions extends PresetReportOptions {
  /**
   * Path segments that mark a document as *done* (in addition to a terminal
   * `State:` token in its header). Default: the common terminal folders.
   */
  readonly doneFolders?: readonly string[]
  /** Board/index basenames that are not items and are never scanned. */
  readonly boardFiles?: readonly string[]
  /**
   * When `true`, items close *in place* rather than moving to a done-folder, so
   * the "a `State: Done` item must sit in a done-folder" half of the placement
   * check is disabled. Default `false`.
   */
  readonly closeInPlace?: boolean
  /**
   * The full `State:` vocabulary this corpus uses. A token outside it is
   * **reported** (`ledger/unknown-state`), not ignored. Default: the plan lane's
   * enum. A bug-shaped lane passes its own, e.g.
   * `['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked']`.
   */
  readonly states?: readonly string[]
  /**
   * Which of {@link states} mean *closed*. Default `['Done', "Won't-do"]`; a
   * bug lane passes `['Fixed', 'Rejected']`. Members are treated as known states
   * whether or not they also appear in {@link states}.
   */
  readonly terminalStates?: readonly string[]
}

const DEFAULT_DONE_FOLDERS = ['/completed/', '/fixed/', '/wont-do/', '/delivered/', '/archived/']
const DEFAULT_BOARD_FILES = ['ROADMAP.md', 'BUGS.md', 'REFINEMENT.md', 'SUPPORT.md', 'README.md']
const DEFAULT_STATES = ['Draft', 'Ready', 'Open', 'Done', "Won't-do"]
const DEFAULT_TERMINAL_STATES = ['Done', "Won't-do"]

// The `State:` label. A colon is **required** in every form: making it optional
// turned any line beginning with the word "State" into a state declaration, so
// `Stateless rendering is the default` reported its state as `less` and
// `State machine transitions are documented` reported `machine`. Both were
// silent before and would have been build failures.
const LABEL = String.raw`^\s*(?:[-*+]\s+)?(?:\*\*State:\*\*|\*\*State\*\*\s*:|__State__\s*:|State\s*:)\s*`
// An emphasis wrapper or a leading symbol on the value — `**Done**`, `` `Done` ``,
// `✅ Done`. Markdown, not vocabulary.
const WRAP = String.raw`(?:\*\*|__|\x60|_)?(?:[^\w\s'’-]+\s*)?`

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A matcher built **from the declared vocabulary**, not a blind token grab.
 *
 * Capturing `(\S+)` and comparing it to the enum looked equivalent and was not:
 * it regressed shapes the old enum regex read correctly — `**State: Done**`
 * captured `Done**`, `- **State:** Done.` captured `Done.` — and told the author
 * their corpus does not declare a state it plainly declares. It also made a
 * multi-word state (`In progress`) unrepresentable, so `states` could not
 * express the vocabularies it exists to express.
 *
 * Alternatives are sorted longest-first so `In progress` wins over `In`, the
 * apostrophe accepts either glyph (an editor smart-quoting `Won't-do` should not
 * break a build over two near-identical characters), and matching is
 * case-insensitive with the declared spelling returned as canonical.
 */
function stateMatcher(states: readonly string[]): RegExp {
  const alts = [...states]
    .sort((a, b) => b.length - a.length)
    .map((s) => escapeRe(s).replace(/['’]/g, "['’]"))
    .join('|')
  return new RegExp(`${LABEL}${WRAP}(${alts})(?![\\w'’-])`, 'i')
}

// Fallback: the line IS a state declaration, but its value is not in the
// vocabulary. Used only to name the offending value in the message — so it
// captures up to the house `—` separator rather than one whitespace-delimited
// token, or a multi-word state would be reported by its first word alone.
const UNREADABLE_RE = new RegExp(`${LABEL}(\\S[^—–]*?)\\s*(?:[—–].*)?$`, 'i')
const ELIDE = 32

// Any one of these on a box's line marks it *disposed* (not silent). Tokens are
// the canonical hyphenated enum, word-bounded — so prose like "…the connection
// dropped in prod" does not falsely exempt a silent box. `deferred` must name a
// home other than "none".
const DISPOSITION_RE =
  /(\bdone-otherwise\b|\bdropped-on-purpose\b|\bvalidation-owed\b|deferred\s*(?:→|->|:|\bto\b)\s*(?!none\b)\S)/i
const DEFERRED_DISPOSITION_RE = /deferred\s*(?:→|->|:|\bto\b)\s*(?!none\b)\S/i
// A summary line asserting the deferral count out loud, e.g. `Deferred: none`.
const DEFERRED_SUMMARY_RE =
  /^[^\S\n]*(?:[-*+][^\S\n]+)?(?:\*\*)?deferred:?(?:\*\*)?[^\S\n]*(.+?)[^\S\n]*$/im
const FENCE_RE = /(```|~~~)[\s\S]*?\1/g

// Blank out fenced code in place (preserve line numbers) so an illustrative
// `**State:** Done` or `Deferred: none` in an example never misclassifies.
function stripFencedCode(s: string): string {
  return s.replace(FENCE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
}

/**
 * The `State:` token in the header region, with its line — one scan, shared by
 * the done-item test and the placement check so the two cannot disagree about
 * what a document says it is.
 */
function findState(
  text: string,
  vocabulary: readonly string[],
): { state?: string; raw: string; line: number } | null {
  const known = stateMatcher(vocabulary)
  const canonical = (m: string): string =>
    vocabulary.find(
      (s) => s.toLowerCase().replace(/’/g, "'") === m.toLowerCase().replace(/’/g, "'"),
    ) ?? m
  const lines = stripFencedCode(text).split('\n')
  // The preamble **and the first section**. Stopping at the first `##` — as this
  // did — meant the check never ran on a real document in the corpus it was
  // written for: the house template is `# Title` / `## Status` / `- **State:** X`,
  // so every single `State:` line sat one heading past where it looked, and the
  // whole placement half reported green having examined nothing (bug 0119).
  let seenHeading = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i] ?? '')) {
      seenHeading += 1
      if (seenHeading > 1) break
      continue
    }
    const line = lines[i] ?? ''
    const hit = known.exec(line)
    if (hit?.[1] !== undefined) return { state: canonical(hit[1]), raw: hit[1], line: i + 1 }
    const unreadable = UNREADABLE_RE.exec(line)
    if (unreadable?.[1] !== undefined) {
      const raw = unreadable[1]
      return { raw: raw.length > ELIDE ? `${raw.slice(0, ELIDE)}…` : raw, line: i + 1 }
    }
  }
  return null
}

function isDoneItem(
  doc: MdDocument,
  doneFolders: readonly string[],
  terminalStates: readonly string[],
): boolean {
  if (doneFolders.some((seg) => `/${doc.relPath}`.includes(seg))) return true
  const found = findState(doc.text, terminalStates)
  return found?.state !== undefined && terminalStates.includes(found.state)
}

const v = (
  rule: string,
  doc: MdDocument,
  line: number,
  message: string,
  because: string,
): ArchViolation => ({
  rule,
  element: doc.relPath,
  file: doc.file,
  line,
  message,
  because,
})

/**
 * What the header's `State:` line establishes — an unreadable token first, then
 * state↔folder coherence. The order matters: a token the vocabulary does not
 * contain cannot be classified as terminal or not, so reporting it is the only
 * honest answer. Returning `null` there is what made this check silently
 * self-disabling (bug 0118).
 */
function headerStateViolation(
  doc: MdDocument,
  inDoneFolder: boolean,
  closeInPlace: boolean,
  states: readonly string[],
  terminalStates: readonly string[],
): ArchViolation | null {
  const known = [...new Set([...states, ...terminalStates])]
  const found = findState(doc.text, known)
  if (!found) return null // no State line at all → this document is not an item

  if (found.state === undefined) {
    return v(
      'ledger/unknown-state',
      doc,
      found.line,
      `State: ${found.raw} is not a state this corpus declares — expected one of ${known.join(', ')}.` +
        ` An unreadable state cannot be checked against its folder, so it is reported rather than skipped.`,
      'a state nobody can read is a check that silently stops running',
    )
  }

  const terminal = terminalStates.includes(found.state)
  if (inDoneFolder && !terminal) {
    return v(
      'ledger/state-folder-mismatch',
      doc,
      found.line,
      `State: ${found.state} but filed in a done-folder — move it back to the active lane or close it out.`,
      'a done-folder item marked as not-done is a silent placement corruption',
    )
  }
  if (!inDoneFolder && terminal && !closeInPlace) {
    return v(
      'ledger/state-folder-mismatch',
      doc,
      found.line,
      `State: ${found.state} but not in a done-folder — the move-to-done was never made (orphaned close).`,
      'a done item left in an active lane is an orphaned post-merge move',
    )
  }
  return null
}

/** Ledger reconciliation of one done-item: unchecked boxes + the `none`-summary lie. */
function ledgerViolations(doc: MdDocument): ArchViolation[] {
  const out: ArchViolation[] = []
  let anyDeferredDisposedBox = false

  for (const box of collectTaskItems(doc.root)) {
    if (box.checked) continue // only open boxes are live ledger entries
    if (DEFERRED_DISPOSITION_RE.test(box.text)) anyDeferredDisposedBox = true
    if (!DISPOSITION_RE.test(box.text)) {
      out.push(
        v(
          'ledger/silent-open-box',
          doc,
          box.line,
          'unchecked box with no disposition (done-otherwise / deferred→<home> / dropped-on-purpose / validation-owed)',
          "silence is not 'nothing deferred' — a done-item with a silently-open box has lost scope",
        ),
      )
    }
  }

  // A `none` deferral-summary while a box carries a defer disposition — the
  // summary contradicts the boxes. (Absence of a summary is deliberately NOT gated.)
  if (anyDeferredDisposedBox) {
    const lines = stripFencedCode(doc.text).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? ''
      if (/^\s*>/.test(raw)) continue
      const sm = raw.match(DEFERRED_SUMMARY_RE)
      if (sm && /^none\b/i.test((sm[1] ?? '').trim())) {
        out.push(
          v(
            'ledger/deferred-none-lie',
            doc,
            i + 1,
            "'deferred: none' contradicts a box disposed as deferred→<home>",
            'the out-loud summary must reconcile with the box states, not override them',
          ),
        )
        break
      }
    }
  }
  return out
}

/**
 * Run the honesty-at-close gate over a corpus. Throws `ArchRuleError` on any
 * finding. Placement is checked on every item; ledger reconciliation only on
 * done-items (the inverse of the frozen-folder exemption).
 */
export function honestyAtClose(
  corpus: Corpus,
  options: HonestyAtCloseOptions = {},
): ArchViolation[] {
  const doneFolders = options.doneFolders ?? DEFAULT_DONE_FOLDERS
  const boardFiles = new Set(options.boardFiles ?? DEFAULT_BOARD_FILES)
  const closeInPlace = options.closeInPlace ?? false
  const states = options.states ?? DEFAULT_STATES
  const terminalStates = options.terminalStates ?? DEFAULT_TERMINAL_STATES

  const violations: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    const base = doc.relPath.split('/').pop() ?? doc.relPath
    if (boardFiles.has(base)) continue

    const inDoneFolder = doneFolders.some((seg) => `/${doc.relPath}`.includes(seg))
    const header = headerStateViolation(doc, inDoneFolder, closeInPlace, states, terminalStates)
    if (header) violations.push(header)

    if (isDoneItem(doc, doneFolders, terminalStates)) violations.push(...ledgerViolations(doc))
  }

  return finishPreset(violations, options)
}

/** What a {@link honestyAtClose} run actually examined. */
export interface LedgerStats {
  /** Documents considered (board files excluded). */
  readonly scanned: number
  /** …of which carry a `State:` line the declared vocabulary can read. */
  readonly withReadableState: number
  /** …of which carry a `State:` line whose value is not in the vocabulary. */
  readonly unreadableState: number
  /** …of which are *done* — by folder or by terminal state — and so ledger-checked. */
  readonly doneItems: number
}

/**
 * The denominator, computed by the preset itself.
 *
 * `withReadableState` is the number nobody could see when bug 0119 happened: the
 * placement check had never examined a document, and every summary line in the
 * repo reported a healthy done-count derived purely from folder membership. A
 * caller that prints this cannot be blind and green at the same time — if the
 * region assumption drifts from the corpus again, this drops and says so.
 *
 * Callers must not re-derive it. `check-ledger.mjs` did, with a copy of the very
 * expression 0119 removed, and its copy disagreed with the preset on 56 of 56
 * records while heading a section captioned "so a green is provably non-vacuous".
 */
export function ledgerStats(corpus: Corpus, options: HonestyAtCloseOptions = {}): LedgerStats {
  const doneFolders = options.doneFolders ?? DEFAULT_DONE_FOLDERS
  const boardFiles = new Set(options.boardFiles ?? DEFAULT_BOARD_FILES)
  const states = options.states ?? DEFAULT_STATES
  const terminalStates = options.terminalStates ?? DEFAULT_TERMINAL_STATES
  const known = [...new Set([...states, ...terminalStates])]

  let scanned = 0
  let withReadableState = 0
  let unreadableState = 0
  let doneItems = 0
  for (const doc of corpus.documents()) {
    const base = doc.relPath.split('/').pop() ?? doc.relPath
    if (boardFiles.has(base)) continue
    scanned += 1
    const found = findState(doc.text, known)
    if (found?.state !== undefined) withReadableState += 1
    else if (found !== null) unreadableState += 1
    if (isDoneItem(doc, doneFolders, terminalStates)) doneItems += 1
  }
  return { scanned, withReadableState, unreadableState, doneItems }
}
