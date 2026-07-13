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
}

const DEFAULT_DONE_FOLDERS = ['/completed/', '/fixed/', '/wont-do/', '/delivered/', '/archived/']
const DEFAULT_BOARD_FILES = ['ROADMAP.md', 'BUGS.md', 'REFINEMENT.md', 'SUPPORT.md', 'README.md']

// A terminal `State:` token in the header — `**State:** Done` / `Won't-do`.
const DONE_STATE_RE = /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?\s*(Done|Won't-do)\b/im
// The full neutral State enum on one line (for state↔folder coherence).
const STATE_TOKEN_LINE_RE =
  /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?\s*(Draft|Ready|Open|Done|Won't-do)\b/i
const TERMINAL_STATES = new Set(['Done', "Won't-do"])

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

function headerRegion(text: string): string {
  return stripFencedCode(text).split(/^##\s/m)[0] ?? ''
}

function isDoneItem(doc: MdDocument, doneFolders: readonly string[]): boolean {
  if (doneFolders.some((seg) => `/${doc.relPath}`.includes(seg))) return true
  return DONE_STATE_RE.test(headerRegion(doc.text))
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

/** State↔folder coherence — the two mechanically-knowable placement defects. */
function placementViolation(
  doc: MdDocument,
  inDoneFolder: boolean,
  closeInPlace: boolean,
): ArchViolation | null {
  const lines = stripFencedCode(doc.text).split('\n')
  let stateLine = 0
  let state = ''
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i] ?? '')) break // header region only
    const m = STATE_TOKEN_LINE_RE.exec(lines[i] ?? '')
    if (m) {
      stateLine = i + 1
      state = m[1] ?? ''
      break
    }
  }
  if (!stateLine) return null // no neutral State token → nothing to check
  const terminal = TERMINAL_STATES.has(state)
  if (inDoneFolder && !terminal) {
    return v(
      'ledger/state-folder-mismatch',
      doc,
      stateLine,
      `State: ${state} but filed in a done-folder — move it back to the active lane or close it out.`,
      'a done-folder item marked as not-done is a silent placement corruption',
    )
  }
  if (!inDoneFolder && terminal && !closeInPlace) {
    return v(
      'ledger/state-folder-mismatch',
      doc,
      stateLine,
      `State: ${state} but not in a done-folder — the move-to-done was never made (orphaned close).`,
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

  const violations: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    const base = doc.relPath.split('/').pop() ?? doc.relPath
    if (boardFiles.has(base)) continue

    const inDoneFolder = doneFolders.some((seg) => `/${doc.relPath}`.includes(seg))
    const placement = placementViolation(doc, inDoneFolder, closeInPlace)
    if (placement) violations.push(placement)

    if (isDoneItem(doc, doneFolders)) violations.push(...ledgerViolations(doc))
  }

  return finishPreset(violations, options)
}
