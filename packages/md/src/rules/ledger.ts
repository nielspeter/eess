import { finishPreset, type PresetReportOptions } from '@nielspeter/eess'
import type { Condition, ConditionContext, Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import type { ArchViolation } from '../model/violation.js'
import { collectTaskItems } from '../model/task-items.js'
import { docs } from '../builders/docs.js'
import { taskItems, type MdTaskItem } from '../builders/task-items.js'

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
 *
 * **Expressed through the builder DSL** (bug 0131, closed by plan 0101 Phase 1):
 * previously this preset hand-iterated `corpus.documents()` directly, calling
 * no `RuleBuilder`/`TerminalBuilder` at all — invisible to every kernel-level
 * guarantee, including the ADR-010 evidence gate the fold (plan 0088) landed.
 * `docs(corpus)` and `taskItems(corpus)` already existed and already
 * `extends RuleBuilder<T, Corpus>` — the detection logic below is unchanged
 * from the pre-fold version (same regexes, same `findState`/`isDoneItem`
 * helpers, same messages), only its *iteration* now goes through the DSL, so
 * this preset inherits the fold's fail-closed floor like every sibling
 * builder-based rule already does.
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
  /**
   * Declare that this corpus may legitimately hold zero non-board documents
   * right now — a freshly-bootstrapped lane before its first real item is
   * authored (e.g. a `kit/`-seeded `work/plans/` containing only
   * `ROADMAP.md`). Default `false`: an empty non-board selection is treated
   * as a dead selector (wrong glob, broken `boardFiles`) and reported.
   *
   * This is a genuine, caller-declared claim, not something `honestyAtClose`
   * can infer — nothing else in the corpus distinguishes "nothing authored
   * yet" from "the selector broke." Per ADR-010 it **expires**: the day a
   * real document appears, `examined > 0` while this is still declared `true`
   * is itself reported ("the declaration has expired"), so remove it once
   * the lane has real content.
   */
  readonly expectEmptyHeaders?: boolean
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
 *
 * An empty `states` must never match — a lane with no known/terminal
 * vocabulary (`terminalStates: []`, a legitimate config: bug 0121's
 * `proposals` lane, where nothing is ledger-closed by design) is a real,
 * supported input, not a caller error. Naively joining zero alternatives
 * makes the capture group `()`, a zero-width match that fires at almost any
 * position — `findState` would then read every `State:`-shaped line as
 * "readable, value ''" instead of falling through to the `UNREADABLE_RE`
 * fallback, silently miscounting `withReadableState`/`unreadableState` and
 * (for `isDoneItem`, which calls this with `terminalStates` directly) relying
 * on `[].includes('')` being `false` by accident rather than by design.
 */
function stateMatcher(states: readonly string[]): RegExp {
  if (states.length === 0) return /(?!)/ // never matches: forces the UNREADABLE_RE fallback
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

/** A box's disposition is disclosed, or it is a silent open box. */
function isDisposed(boxText: string): boolean {
  return DISPOSITION_RE.test(boxText)
}

/**
 * Does this document carry at least one open box disposed as `deferred→<home>`?
 *
 * A corruption here (always `false`) is caught by
 * `scripts/nonvacuity/bad-ledger.mjs`'s `completed/0005-deferred-none-lie.md`
 * fixture (bug 0131 round-2 review) — before it existed, no fixture in that
 * corpus carried a `deferred→<home>` box at all, so this function's only
 * "protection" was this repo's own live corpus incidentally carrying one,
 * which would have silently vanished the day that box got resolved.
 */
function hasDeferredDisposedBox(doc: MdDocument): boolean {
  return collectTaskItems(doc.root).some(
    (box) => !box.checked && DEFERRED_DISPOSITION_RE.test(box.text),
  )
}

/**
 * A `none` deferral-summary while the document carries a box disposed as
 * `deferred→<home>` — the summary contradicts the boxes. Absence of a summary
 * is deliberately NOT gated; only a *contradicting* one is.
 */
function deferredNoneLieViolation(doc: MdDocument): ArchViolation | null {
  const lines = stripFencedCode(doc.text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    if (/^\s*>/.test(raw)) continue
    const sm = raw.match(DEFERRED_SUMMARY_RE)
    if (sm && /^none\b/i.test((sm[1] ?? '').trim())) {
      return v(
        'ledger/deferred-none-lie',
        doc,
        i + 1,
        "'deferred: none' contradicts a box disposed as deferred→<home>",
        'the out-loud summary must reconcile with the box states, not override them',
      )
    }
  }
  return null
}

/** Predicate: not a board/index file (never scanned as an item). */
function notBoardFile(boardFiles: ReadonlySet<string>): Predicate<MdDocument> {
  return {
    description: 'is not a board file',
    test: (doc) => !boardFiles.has(doc.relPath.split('/').pop() ?? doc.relPath),
  }
}

/** Predicate: this document is a done-item under the caller's own vocabulary. */
function isDoneItemPredicate(
  doneFolders: readonly string[],
  terminalStates: readonly string[],
): Predicate<MdDocument> {
  return {
    description: 'is a done item',
    test: (doc) => isDoneItem(doc, doneFolders, terminalStates),
  }
}

/**
 * Predicate: this task item's own document is a done-item.
 *
 * A corruption here (always `false`) is caught not by a purpose-built
 * fixture but as a side effect of `ledger.test.ts`'s pre-existing
 * `flags a silent open box in a done-item (red)` /
 * `passes a done-item whose every open box is disposed (green)` pair, and of
 * `scripts/nonvacuity/bad-ledger.mjs`'s `completed/0001-silent-open-box.md`
 * fixture — both keep a real open box on a real done-item in the corpus, the
 * exact shape `honestyAtClose`'s independent `anyOpenBoxOnADoneItem` peek
 * (see its docstring) needs to diverge from a corrupted `belongsToADoneItem`.
 * Simplifying either fixture to drop that box, even for reasons unrelated to
 * this concern, would silently regress the coverage.
 */
function belongsToADoneItem(
  doneFolders: readonly string[],
  terminalStates: readonly string[],
): Predicate<MdTaskItem> {
  return {
    description: 'belongs to a done item',
    test: (t) => isDoneItem(t.doc, doneFolders, terminalStates),
  }
}

/** Condition: the header `State:` line is readable and matches its folder. */
function headerStateCondition(
  doneFolders: readonly string[],
  closeInPlace: boolean,
  states: readonly string[],
  terminalStates: readonly string[],
): Condition<MdDocument> {
  return {
    description: 'have a readable State: line that matches its folder',
    evaluate(elements: MdDocument[], _ctx: ConditionContext): ArchViolation[] {
      const out: ArchViolation[] = []
      for (const doc of elements) {
        const inDoneFolder = doneFolders.some((seg) => `/${doc.relPath}`.includes(seg))
        const found = headerStateViolation(doc, inDoneFolder, closeInPlace, states, terminalStates)
        if (found) out.push(found)
      }
      return out
    },
  }
}

/** Condition: an open box on a done-item carries a disposition token. */
function dispositionCondition(): Condition<MdTaskItem> {
  return {
    description:
      'carry a disposition token (done-otherwise / deferred→<home> / dropped-on-purpose / validation-owed)',
    evaluate(elements: MdTaskItem[], _ctx: ConditionContext): ArchViolation[] {
      return elements
        .filter((t) => !isDisposed(t.text))
        .map((t) =>
          v(
            'ledger/silent-open-box',
            t.doc,
            t.line,
            'unchecked box with no disposition (done-otherwise / deferred→<home> / dropped-on-purpose / validation-owed)',
            "silence is not 'nothing deferred' — a done-item with a silently-open box has lost scope",
          ),
        )
    },
  }
}

/** Condition: a document with a deferred-disposed box does not lie in its summary. */
function deferredNoneLieCondition(): Condition<MdDocument> {
  return {
    description: "not summarize deferrals as 'none' while a box is deferred→<home>",
    evaluate(elements: MdDocument[], _ctx: ConditionContext): ArchViolation[] {
      const out: ArchViolation[] = []
      for (const doc of elements) {
        const found = deferredNoneLieViolation(doc)
        if (found) out.push(found)
      }
      return out
    },
  }
}

/**
 * Run the honesty-at-close gate over a corpus. Throws `ArchRuleError` on any
 * finding. Placement is checked on every item; ledger reconciliation only on
 * done-items (the inverse of the frozen-folder exemption).
 *
 * Three builder-based rules, merged: header state↔folder (`docs()`), silent
 * open boxes (`taskItems()`, filtered to done-items), and the deferred-none
 * lie (`docs()`, filtered to done-items carrying a deferred-disposed box).
 *
 * **Emptiness declarations, and why each is shaped the way it is** (bug 0131
 * follow-up, six-persona review before this landed): `.expectEmpty()` is only
 * a sound fail-closed gate when the thing that decides *whether* to declare
 * it is independent of the predicate the declaration would otherwise let
 * pass silently. Two designs were tried and rejected for this reason:
 *
 * 1. Peeking the exact same selection each rule gates (`.select()` on
 *    `openBoxesOnDoneItems`/`doneItemsWithDeferredBox` themselves) before
 *    conditionally declaring `.expectEmpty()`. This *reads* as a live check
 *    but is circular: the peek and the real run filter the identical
 *    elements through the identical predicates with nothing in between, so
 *    the declaration is always self-consistent and can never expire — it
 *    provides zero protection against exactly the corruption class ADR-010
 *    exists to catch, for either rule.
 * 2. Gating on `terminalStates.length === 0` alone. Correct for the
 *    always-structurally-empty `proposals` lane, but too narrow: it doesn't
 *    cover a plan/bug lane's own test fixtures that legitimately have zero
 *    done-items in a given run (e.g. a single-document fixture testing an
 *    unrelated placement rule).
 * 3. Gating both rules on one coarse "any done item exists in this corpus"
 *    signal. Independent of the right predicate, but the wrong *scope*: most
 *    done items carry zero open boxes and zero deferred boxes — that's the
 *    normal, healthy, permanent state for a reconciled item, not a corner
 *    case — so "a done item exists" routinely holds while the real selection
 *    (open boxes on it, or a deferred box on it) is legitimately empty. That
 *    false-positived on the project's own `fixed/green-bug-closed.md` fixture
 *    (a done item with one already-checked box, no open boxes at all).
 *
 * The fix: peek `openTaskItems` once (`taskItems(corpus).that().areOpen()`,
 * a purely structural filter, no done-item check), then derive each rule's
 * own emptiness signal from *that*, narrowed to what the rule actually
 * selects, while staying independent of the specific predicate/function
 * being protected:
 *
 * - `silentOpenBoxViolations` is gated by `belongsToADoneItem`. Its peek
 *   (`anyOpenBoxOnADoneItem`) calls `isDoneItem` on `openTaskItems` directly
 *   — not through `belongsToADoneItem` — so a corruption of that predicate
 *   specifically doesn't also blind the peek.
 * - `deferredLieViolations`'s selection adds `hasDeferredDisposedBox` (which
 *   walks each done document's own mdast via a separate
 *   `collectTaskItems(doc.root)` call) on top of `isDoneItemPredicate`. Its
 *   peek (`anyDeferredDisposedBoxOnADoneItem`) instead re-tests
 *   `openTaskItems` (a different traversal) against the same
 *   `DEFERRED_DISPOSITION_RE` constant `hasDeferredDisposedBox` uses — so a
 *   corruption of `hasDeferredDisposedBox`'s own body doesn't blind this
 *   peek either.
 *
 * Both peeks share `isDoneItem` and the underlying `collectTaskItems` box
 * collection with the very selections they protect — a corruption isolated to
 * either would defeat both peek and real selection identically, uniformly,
 * for every lane. This is a real residual gap, not a narrow one: verified by
 * sabotaging `isDoneItem` against this repo's own real corpus during bug
 * 0131's round-2 review, which produced **zero violations, exit 0** — not a
 * partial miss. `headerStateCondition` does **not** independently backstop
 * this (an earlier draft of this comment claimed it "would likely also
 * surface through `headerViolations`" — false: `headerStateCondition` never
 * calls `isDoneItem`, it recomputes the folder half of the same determination
 * inline, so it only catches a corruption if a live state/folder mismatch
 * already exists in the scanned corpus, which it usually doesn't).
 *
 * `honestyAtClose` itself can't close this gap generically — a corpus with
 * zero done-items is legitimate on a freshly-bootstrapped lane's first day,
 * so a library-level "zero done-items across the whole call is always wrong"
 * assertion would be exactly the false-positive class `expectEmptyHeaders`
 * exists to avoid. What closes it is caller knowledge: **a corpus with an
 * established history should assert its own "zero done-items is never
 * legitimate here" claim on top.** `scripts/check-ledger.mjs` (this repo's
 * own wiring) does exactly that — 0 done-items summed across every lane fails
 * the build, because this repo has carried done-items in every
 * terminal-states lane for its entire history. A `kit/`-seeded caller with no
 * history yet should not copy that assertion verbatim; it becomes true, and
 * worth adding, once the corpus has one.
 *
 * `headerViolations` gets no computed declaration — nothing in the corpus
 * can tell "no non-board documents authored yet" apart from "the selector
 * broke." Callers who know the former is legitimate (a freshly-bootstrapped
 * lane) opt in explicitly via {@link HonestyAtCloseOptions.expectEmptyHeaders}.
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
  const expectEmptyHeaders = options.expectEmptyHeaders ?? false

  let headerRule = docs(corpus)
    .that()
    .satisfy(notBoardFile(boardFiles))
    .should()
    .satisfy(headerStateCondition(doneFolders, closeInPlace, states, terminalStates))
  if (expectEmptyHeaders) headerRule = headerRule.expectEmpty()
  const headerViolations = headerRule.violations()

  // Open task items, collected once and reused for both peeks below. "Any
  // done item exists" is too coarse a signal on its own — most done items
  // legitimately carry zero open boxes and zero deferred boxes, so gating on
  // it alone false-positives on the common, healthy case (a done item with
  // nothing outstanding). Each peek below narrows to what its own rule
  // actually selects, while staying independent of the predicate/function
  // that rule uses to select it.
  const openTaskItems = taskItems(corpus)
    .that()
    .areOpen()
    .select({
      label: 'open task items',
      identify: (t: MdTaskItem) => ({ name: t.doc.relPath, file: t.doc.file, line: t.line }),
    }).elements

  // Independent of `belongsToADoneItem`: calls `isDoneItem` directly rather
  // than through that predicate object, so a corruption of
  // `belongsToADoneItem` itself doesn't also blind this peek.
  const anyOpenBoxOnADoneItem = openTaskItems.some((t) =>
    isDoneItem(t.doc, doneFolders, terminalStates),
  )
  let silentBoxRule = taskItems(corpus)
    .that()
    .areOpen()
    .satisfy(belongsToADoneItem(doneFolders, terminalStates))
    .should()
    .satisfy(dispositionCondition())
  if (!anyOpenBoxOnADoneItem) silentBoxRule = silentBoxRule.expectEmpty()
  const silentOpenBoxViolations = silentBoxRule.violations()

  // Independent of `hasDeferredDisposedBox`: that function walks each done
  // document's own mdast via a separate `collectTaskItems(doc.root)` call:
  // this peek instead reuses the flat, already-collected `openTaskItems` list
  // (from the `taskItems()` builder's own traversal) and the same
  // `DEFERRED_DISPOSITION_RE` constant `hasDeferredDisposedBox` tests against
  // — two different collection paths converging on the one shared pattern,
  // so a corruption of `hasDeferredDisposedBox`'s own body doesn't blind this
  // peek too.
  const anyDeferredDisposedBoxOnADoneItem = openTaskItems.some(
    (t) => isDoneItem(t.doc, doneFolders, terminalStates) && DEFERRED_DISPOSITION_RE.test(t.text),
  )
  let deferredLieRule = docs(corpus)
    .that()
    .satisfy(isDoneItemPredicate(doneFolders, terminalStates))
    .satisfy({
      description: 'carries a box disposed as deferred→<home>',
      test: (doc: MdDocument) => hasDeferredDisposedBox(doc),
    })
    .should()
    .satisfy(deferredNoneLieCondition())
  if (!anyDeferredDisposedBoxOnADoneItem) deferredLieRule = deferredLieRule.expectEmpty()
  const deferredLieViolations = deferredLieRule.violations()

  return finishPreset(
    [...headerViolations, ...silentOpenBoxViolations, ...deferredLieViolations],
    options,
  )
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
 *
 * Pure read-only counting, not a rule — no evidence gate applies here.
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
