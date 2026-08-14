/**
 * Shared policy for the proposal↔plan linkage gate (plan 0142, closing bug
 * 0141): parsing the literal `**Ruling:**` token out of a proposal document,
 * and the `**Implements:**` back-reference out of a plan document.
 *
 * Extracted from `check-corpus.mjs` rather than inlined — the architect
 * review of bug 0141's own draft Fix warned that a check written inline
 * leaves its own non-vacuity fixture no option but to re-declare the parsing
 * policy, proving only that a copy fails, never that the production script
 * invokes it (the same lesson bug 0127 fixed for the links/pointers checks).
 * Mirrors `lib/corpus-link-routing.mjs`'s shape: policy lives here: both
 * `check-corpus.mjs` and `check-nonvacuity.mjs`'s probes exercise this same
 * module.
 *
 * `**Ruling:**` is bounded and closed-vocabulary by design (plan 0142 Phase
 * 1) — `**Ruling: Rewrite needed**`, bold closing immediately after the
 * verdict, never a sentence — so this is a fixed-shape parse, not a
 * heuristic extractor.
 *
 * Revised 2026-08-14 after branch review found the first version's
 * heading-scoped extraction (a `## Review —` section, em dash required, `##`
 * exactly) silently invisible-not-flagged the day the heading drifted —
 * including proposal 001's own original shape (a bare `**Ruling:` line, no
 * heading at all), the exact gap Phase 1 had to hand-backfill because
 * nothing could see it. Dropped the heading apparatus entirely: the
 * operative Ruling is now the LAST `**Ruling: <verdict>**` line anywhere in
 * the (fence-stripped) document, full stop — verified against all five real
 * proposals, including 005's two-round file (its second, most-recent Ruling
 * is also textually last, so this agrees with PROPOSALS.md's "most recent
 * wins" rule without needing to locate a heading to prove it). Known
 * residual: if a future proposal's preserved/superseded appendix material
 * itself carries an old `**Ruling:` line positioned *after* the real most
 * recent review, "last in the file" and "most recent chronologically" could
 * diverge — not the case for any proposal filed to date (verified by count).
 */

/** The closed six-value vocabulary — verbatim, same casing as `PROPOSALS.md`. */
export const RULING_VOCABULARY = [
  'Ship as-is',
  'Ship with changes',
  'Split and sequence',
  'Rewrite needed',
  'Docs-only',
  'Reject',
]

/**
 * Rulings that mean "accepted; this proposal should have a plan." Excludes
 * `Split and sequence` deliberately: per `PROPOSALS.md`, that ruling means
 * "more than one shippable thing; split before planning" — the next step is
 * decomposing the proposal itself, not yet a plan. If that reading changes,
 * change this set; it is the one place the policy is decided.
 */
export const ACCEPTED_RULINGS = new Set(['Ship as-is', 'Ship with changes'])

const FENCE_RE = /(```|~~~)[\s\S]*?\1/g

/**
 * Blank out fenced code in place (preserve line numbers), so an illustrative
 * `**Ruling: Ship as-is**` inside an example block never misclassifies — the
 * same discipline `packages/md/src/rules/ledger.ts`'s `stripFencedCode`
 * applies to `State:` tokens.
 */
function stripFencedCode(text) {
  return text.replace(FENCE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
}

// Longest-first so "Ship with changes" can never be cut short by a
// hypothetical shorter alternative sharing a prefix — the same discipline
// `packages/md/src/rules/ledger.ts`'s `stateMatcher` applies to `State:`.
const RULING_ALTS = [...RULING_VOCABULARY].sort((a, b) => b.length - a.length).join('|')
// A leading list marker, blockquote marker, or plain indentation — the same
// tolerance IMPLEMENTS_RE below needed, and branch review found (twice,
// independently) that the Ruling side lacked it: a bulleted, blockquoted, or
// indented `**Ruling:` line was silently invisible, reproduced live against
// the real corpus. Both sides now share this prefix.
const LABEL_PREFIX = String.raw`^(?:[-*+]\s+|>\s*)?\s*`
const RULING_LINE_RE_G = new RegExp(
  `${LABEL_PREFIX}\\*\\*Ruling: (${RULING_ALTS})\\*\\*\\s*$`,
  'gm',
)
// The bare label, unbounded — matches a line someone clearly meant as a
// Ruling declaration even when the rest of it doesn't parse. Used only to
// distinguish "attempted and garbled" from "never reviewed at all".
const RULING_LABEL_RE = new RegExp(`${LABEL_PREFIX}\\*\\*Ruling:`, 'm')

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

/**
 * The operative Ruling for a proposal — the LAST `**Ruling: <verdict>**`
 * line anywhere in the document, or `null` if none parses (never reviewed,
 * OR reviewed but garbled — see {@link hasUnparseableRuling} to tell them
 * apart so the latter can be its own violation instead of a silent "not
 * accepted").
 */
export function operativeRuling(text) {
  const stripped = stripFencedCode(text)
  const matches = [...stripped.matchAll(RULING_LINE_RE_G)]
  const last = matches.at(-1)
  return last ? last[1] : null
}

/** True if the document has a line that looks like a Ruling declaration
 * (starts `**Ruling:`) but none of them parses to the closed vocabulary in
 * the bounded shape — a real finding, not a silent exclusion. */
export function hasUnparseableRuling(text) {
  const stripped = stripFencedCode(text)
  return RULING_LABEL_RE.test(stripped) && operativeRuling(stripped) === null
}

/** 1-based line of the operative Ruling line, or of the first `**Ruling:`-
 * looking line if none parses, or 1 if the document has neither. */
export function operativeRulingLine(text) {
  const stripped = stripFencedCode(text)
  const matches = [...stripped.matchAll(RULING_LINE_RE_G)]
  const last = matches.at(-1)
  if (last && last.index !== undefined) return lineAt(stripped, last.index)
  const label = stripped.match(RULING_LABEL_RE)
  return label && label.index !== undefined ? lineAt(stripped, label.index) : 1
}

export function isAccepted(ruling) {
  return ruling !== null && ACCEPTED_RULINGS.has(ruling)
}

// Revised 2026-08-14: the first version anchored `^\*\*Implements:\*\*` with
// no bullet allowance and `\s*$` at the end — but PROPOSALS.md documents the
// line as living "in its own `## Status` header", and every real `## Status`
// header in this repo (including this plan's own) is a bulleted list
// (`- **State:** …`). The documented convention could not be written. Fixed:
// optional list-marker prefix, optional markdown-link wrapping around the
// number (the house style for every other cross-lane reference — bug 0141's
// own Status block cites `[bug 0141](../bugs/…)`), and no end anchor, so
// trailing rationale after the number (matching `- **State:** Ready — …`'s
// own shape) doesn't break the match.
const IMPLEMENTS_SOURCE =
  LABEL_PREFIX +
  String.raw`\*\*Implements:\*\*\s*(?:\[proposal (\d+)\b[^\]]*\]\([^)]*\)|proposal\s+(\d+)\b)`
const IMPLEMENTS_RE = new RegExp(IMPLEMENTS_SOURCE, 'im')
// Global variant, for counting — a plan is a `keyBy` join input (one key per
// element), so it must declare exactly one. Second-round branch review
// (product, customer, testing — three, independently): a second
// `**Implements:**` line was silently dropped, and the resulting violation
// on the OTHER proposal told the author to add a line their plan already
// had. Two-or-more is now the same "unparseable" finding as zero-that-parse,
// not a silent pick-the-first.
const IMPLEMENTS_RE_G = new RegExp(IMPLEMENTS_SOURCE, 'gim')
const IMPLEMENTS_LABEL_RE = new RegExp(`${LABEL_PREFIX}\\*\\*Implements:\\*\\*`, 'm')

/**
 * The proposal number a plan declares it implements, via its own
 * `**Implements:** proposal NNN` header line (bare or markdown-link form,
 * optionally bulleted) — `null` if it declares none, or more than one (a
 * plan is a single-key join input; see {@link hasUnparseableImplements}). A
 * textual mention elsewhere in the plan's prose does not count: bug 0141
 * found the only three real citations in this corpus mention a proposal
 * while explicitly excluding it from scope or citing it as a dependency to
 * re-check, never implementing it — a declared header line is required.
 */
export function declaredImplements(text) {
  const stripped = stripFencedCode(text)
  const matches = [...stripped.matchAll(IMPLEMENTS_RE_G)]
  if (matches.length !== 1) return null
  const m = matches[0]
  // Normalized the same way as proposalNumberFromPath — "proposal 002" and
  // "proposal 2" must key identically, since the join is on the number, not
  // its zero-padding.
  return String(Number(m[1] ?? m[2]))
}

/** True if the document has a line that looks like an Implements declaration
 * but doesn't resolve to exactly one proposal number — zero that parse, or
 * more than one — mirrors {@link hasUnparseableRuling} so a garbled or
 * doubled back-reference is a finding, not silence (plan 0142's own "zero
 * silent exclusions" success criterion, applied to both sides of the join). */
export function hasUnparseableImplements(text) {
  const stripped = stripFencedCode(text)
  return IMPLEMENTS_LABEL_RE.test(stripped) && declaredImplements(stripped) === null
}

/** 1-based line of the `**Implements:**` declaration (parsed or not), or 1
 * if the document has no such line at all. */
export function declaredImplementsLine(text) {
  const stripped = stripFencedCode(text)
  const m = stripped.match(IMPLEMENTS_RE) ?? stripped.match(IMPLEMENTS_LABEL_RE)
  return m && m.index !== undefined ? lineAt(stripped, m.index) : 1
}

const PROPOSAL_NUMBER_RE = /(\d+)-[^/]*\.md$/

/** The proposal's own number, from its file's basename — `work/proposals/002-x.md` → `"2"`. */
export function proposalNumberFromPath(relPath) {
  const m = relPath.match(PROPOSAL_NUMBER_RE)
  return m ? String(Number(m[1])) : null
}
