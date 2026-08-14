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
 * `check-corpus.mjs` and `check-nonvacuity.mjs`'s probe exercise this same
 * module.
 *
 * `**Ruling:**` is bounded and closed-vocabulary by design (plan 0142 Phase
 * 1) — `**Ruling: Rewrite needed**`, bold closing immediately after the
 * verdict, never a sentence — so this is a fixed-shape parse, not a
 * heuristic extractor. Multi-round proposals (005 has two `## Review —`
 * sections) are handled by scoping to the LAST one: PROPOSALS.md's own
 * Vocabulary section states the most recent Ruling is operative.
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

/** Rulings that mean "accepted; this proposal should have a plan." */
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
const RULING_LINE_RE = new RegExp(`^\\*\\*Ruling: (${RULING_ALTS})\\*\\*\\s*$`, 'm')
const REVIEW_HEADING_RE = /^## Review — .*$/gm
const NEXT_H2_RE = /^## /m

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

/**
 * The text of the most recent `## Review — ...` section (heading through the
 * line before the next `##` heading, or end of file) — `null` if the
 * document has no `## Review` section at all (never reviewed).
 */
export function lastReviewSection(text) {
  const stripped = stripFencedCode(text)
  const headings = [...stripped.matchAll(REVIEW_HEADING_RE)]
  if (headings.length === 0) return null
  const last = headings.at(-1)
  const afterHeading = last.index + last[0].length
  const rest = stripped.slice(afterHeading)
  const next = rest.match(NEXT_H2_RE)
  const end = next ? afterHeading + next.index : stripped.length
  return { text: stripped.slice(last.index, end), startIndex: last.index }
}

/**
 * The operative Ruling for a proposal — the verdict inside its most recent
 * `## Review —` section, or `null` if there is no Review section, or if the
 * Review section's Ruling line doesn't match the bounded closed-vocabulary
 * shape (garbled or hand-edited into free prose again). A `null` here is
 * NOT silently "not accepted" for a document that has a Review section — see
 * {@link hasUnparseableRuling}, which distinguishes "never reviewed" from
 * "reviewed but unparseable" so the latter can be its own violation.
 */
export function operativeRuling(text) {
  const section = lastReviewSection(text)
  if (section === null) return null
  const m = section.text.match(RULING_LINE_RE)
  return m ? m[1] : null
}

/** True if the document has a `## Review —` section whose Ruling does not
 * parse to the closed vocabulary — a real finding, not a silent exclusion. */
export function hasUnparseableRuling(text) {
  const section = lastReviewSection(text)
  return section !== null && !RULING_LINE_RE.test(section.text)
}

/** 1-based line of the operative Ruling line, or of the Review heading
 * itself if the Ruling didn't parse — always a real line to point at. */
export function operativeRulingLine(text) {
  const stripped = stripFencedCode(text)
  const section = lastReviewSection(stripped)
  if (section === null) return 1
  const m = section.text.match(RULING_LINE_RE)
  if (!m || m.index === undefined) return lineAt(stripped, section.startIndex)
  return lineAt(stripped, section.startIndex + m.index)
}

export function isAccepted(ruling) {
  return ruling !== null && ACCEPTED_RULINGS.has(ruling)
}

const IMPLEMENTS_RE = /^\*\*Implements:\*\*\s*proposal\s+(\d+)\s*$/m

/**
 * The proposal number a plan declares it implements, via its own
 * `**Implements:** proposal NNN` header line — `null` if it declares none. A
 * textual mention elsewhere in the plan's prose does not count: bug 0141
 * found the only three real citations in this corpus mention a proposal
 * while explicitly excluding it from scope or citing it as a dependency to
 * re-check, never implementing it — a declared header line is required.
 */
export function declaredImplements(text) {
  const stripped = stripFencedCode(text)
  const m = stripped.match(IMPLEMENTS_RE)
  // Normalized the same way as proposalNumberFromPath — "proposal 002" and
  // "proposal 2" must key identically, since the join is on the number, not
  // its zero-padding.
  return m ? String(Number(m[1])) : null
}

/** 1-based line of the `**Implements:**` declaration, or 1 if absent. */
export function declaredImplementsLine(text) {
  const stripped = stripFencedCode(text)
  const m = stripped.match(IMPLEMENTS_RE)
  return m && m.index !== undefined ? lineAt(stripped, m.index) : 1
}

const PROPOSAL_NUMBER_RE = /(\d+)-[^/]*\.md$/

/** The proposal's own number, from its file's basename — `work/proposals/002-x.md` → `"2"`. */
export function proposalNumberFromPath(relPath) {
  const m = relPath.match(PROPOSAL_NUMBER_RE)
  return m ? String(Number(m[1])) : null
}
