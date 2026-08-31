import type { ArchViolation } from './violation.js'
import { maskNonCommentSpans, maskMarkdownCodeSpans } from './mask-non-comment.js'

/**
 * Exclusion comment parsed from source code.
 */
export interface ExclusionComment {
  /** Rule ID being excluded */
  ruleId: string
  /** Required reason for the exclusion */
  reason: string
  /** File path where the comment was found */
  file: string
  /** Line number of the comment */
  line: number
  /** Whether this is a block exclusion (start/end) */
  isBlock: boolean
  /** End line for block exclusions */
  endLine?: number
}

/**
 * Validation warning for exclusion comments.
 */
export interface ExclusionWarning {
  /** Warning message */
  message: string
  /** File path */
  file: string
  /** Line number */
  line: number
  /**
   * What kind of fault this is, so a caller can act on it differently.
   *
   * `'undocumented'` — the directive is well-formed but states no reason. It is
   * refused (see the reason-free branches below), and a caller may additionally
   * promote this to a finding so the author is told what to fix rather than
   * shown the unrelated violation their waiver was covering. `eess-ts` does.
   *
   * `'malformed'` — the directive is broken syntax. Also refused, and the
   * original violation is already firing, so a stderr line is the right weight.
   *
   * Added when the two parsers were unified (ADR-012): only `eess-ts`'s copy had
   * it, and its `execute-rule` branches on it. Merging without it would have
   * silently downgraded bug 0039's gate to a stderr line.
   */
  kind: 'undocumented' | 'malformed'
}

/**
 * Result of parsing exclusion comments from a source file.
 */
export interface ParseResult {
  /** Successfully parsed exclusion comments */
  exclusions: ExclusionComment[]
  /** Warnings about malformed comments */
  warnings: ExclusionWarning[]
}

// Single-line: // eess-exclude <rule-id>[, <rule-id>]: <reason>
// Single-line without reason: // eess-exclude <rule-id>
// The directive must OPEN its comment (bug 0154). Masking alone took this file's
// own false-positive count from 12 to 7; the rest were genuine line comments that
// merely DESCRIBE the grammar — like the line above this one. No lexical rule can
// separate those, but anchoring to the start of the comment body separates all of
// them from every real directive, including the trailing `code // eess-exclude …`
// form.
//
// Rejected alternative: validating the rule-id's shape. It rejects `<rule-id>`
// and still accepts `// see eess-exclude a/b: why`, and it couples this parser to
// an id grammar nothing else enforces.
const SINGLE_LINE_RE = /^[ \t]*eess-exclude[ \t]+(.+)/

/**
 * The body of a line's FIRST `//` comment, or undefined if it has none.
 *
 * The directive must open the comment, and it must be the comment the line
 * actually starts — not any `//` on the line. A grammar description carries two:
 *
 *     // Single-line: // eess-exclude <rule-id>: <reason>
 *
 * Anchoring to `//` alone matches the second one and reads the file's own
 * documentation as 8 live waivers. Taking the first `//` and requiring the
 * directive at the start of its body separates every description from every real
 * directive, including the trailing `code // eess-exclude …` form, whose first
 * `//` is the directive's own.
 */
const CODE_LIKE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/i
const MARKDOWN_LIKE = /\.(?:md|markdown|mdx)$/i

/**
 * The HTML-comment forms exist for text dialects whose sources have no `//` —
 * markdown corpora and the like. In a `.ts` file `// <!-- eess-exclude … -->` is
 * prose describing the grammar, and reading it accounted for the last 2 of this
 * very file's own false hits (bug 0154).
 */
function htmlFormsApply(filePath: string): boolean {
  return !CODE_LIKE.test(filePath)
}

function firstCommentBody(line: string): string | undefined {
  const at = line.indexOf('//')
  return at === -1 ? undefined : line.slice(at + 2)
}

// Block start: // eess-exclude-start <rule-id>[, <rule-id>]: <reason>
// The trailing group is OPTIONAL. A bare `// eess-exclude-start` (no ids, no
// reason) used to match nothing at all — so it pushed no frame, said nothing,
// and the next `-end` closed the ENCLOSING block. Same two symptoms as the
// reason-free case, through a shape the reason-free fix did not reach: it is a
// bracket the reader can see, so it must consume the `-end` written for it.
const BLOCK_START_RE = /^[ \t]*eess-exclude-start(?:[ \t]+(.*))?[ \t]*$/

// Block end: // eess-exclude-end
const BLOCK_END_RE = /^[ \t]*eess-exclude-end\b/

// HTML-comment forms — the same directives for text dialects whose sources
// aren't `//`-commented (markdown corpora, and any future text dialect).
// <!-- eess-exclude <rule-id>[, <rule-id>]: <reason> -->
const HTML_SINGLE_RE = /<!--\s*eess-exclude\s+(.+?)\s*-->/
const HTML_BLOCK_START_RE = /<!--\s*eess-exclude-start\s+(.+?)\s*-->/
const HTML_BLOCK_END_RE = /<!--\s*eess-exclude-end\s*-->/

/**
 * Parse rule IDs and reason from the content after the directive keyword.
 *
 * Format: `rule-a, rule-b: reason text`
 * If no colon is present, all content is treated as rule IDs and reason is empty.
 */
function parseRuleIdsAndReason(content: string): { ruleIds: string[]; reason: string } {
  const colonIndex = content.indexOf(':')
  if (colonIndex < 0) {
    // No colon — all content is rule IDs, no reason
    const ruleIds = content
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return { ruleIds, reason: '' }
  }

  const idsPart = content.slice(0, colonIndex)
  const reason = content.slice(colonIndex + 1).trim()
  const ruleIds = idsPart
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return { ruleIds, reason }
}

/** Handle a block-end directive line. */
function handleBlockEnd(
  openBlocks: ExclusionComment[][],
  exclusions: ExclusionComment[],
  warnings: ExclusionWarning[],
  filePath: string,
  lineNum: number,
): void {
  // Bug 0158: pop the INNERMOST frame. Closing every open block meant an inner
  // `-end` silently ended the outer one, so the outer waiver stopped applying
  // partway through the region it was written for — two wrong results from one
  // input, and neither reported.
  const frame = openBlocks.pop()
  if (frame === undefined) {
    warnings.push({
      message: `eess-exclude-end without matching start`,
      file: filePath,
      line: lineNum,
      kind: 'malformed',
    })
    return
  }

  for (const comment of frame) {
    comment.endLine = lineNum
    exclusions.push(comment)
  }
}

/** Emit undocumented-exclusion warnings for each rule ID when no reason is given. */
function warnUndocumented(
  warnings: ExclusionWarning[],
  ruleIds: string[],
  directive: string,
  filePath: string,
  lineNum: number,
): void {
  for (const ruleId of ruleIds) {
    warnings.push({
      message:
        `Undocumented exclusion at ${filePath}:${String(lineNum)} — ` +
        `// ${directive} ${ruleId}\n` +
        `  Fix: Add a reason — // ${directive} ${ruleId}: <why>`,
      file: filePath,
      line: lineNum,
      kind: 'undocumented',
    })
  }
}

/** Handle a block-start directive line. */
function handleBlockStart(
  content: string,
  openBlocks: ExclusionComment[][],
  warnings: ExclusionWarning[],
  filePath: string,
  lineNum: number,
): void {
  const { ruleIds, reason } = parseRuleIdsAndReason(content)

  if (ruleIds.length === 0) {
    // A `-start` naming no rule at all. It still consumes its `-end` (see the
    // regex comment), but it is malformed and saying nothing about it would be
    // the silence this whole grammar is written to refuse.
    warnings.push({
      message:
        `eess-exclude-start names no rule id. ` +
        `Fix: write // eess-exclude-start <rule-id>: <why>, or delete the directive ` +
        `and its matching -end.`,
      file: filePath,
      line: lineNum,
      kind: 'malformed',
    })
    openBlocks.push(
      ruleIds.map((ruleId) => ({
        ruleId,
        reason,
        file: filePath,
        line: lineNum,
        isBlock: true,
      })),
    )
    return
  }

  if (reason === '') {
    warnUndocumented(warnings, ruleIds, 'eess-exclude-start', filePath, lineNum)
    // Push an EMPTY frame rather than returning. Refusing the waiver and
    // refusing the frame are different things: `-start`/`-end` is a bracket
    // language, so a `-start` the reader can see must consume the `-end` the
    // reader wrote for it, whatever we decide about its reason.
    //
    // Returning here — as this did when bug 0158's two halves shipped together —
    // let the next `-end` pop the OUTER frame, so a valid enclosing waiver
    // stopped early and a balanced file reported "end without matching start".
    // That is precisely the frame-mangling 0158's nesting half removed,
    // reintroduced by its reason-required half. Empty means it suppresses
    // nothing, which is the refusal; present means the brackets still pair.
    openBlocks.push(
      ruleIds.map((ruleId) => ({
        ruleId,
        reason,
        file: filePath,
        line: lineNum,
        isBlock: true,
      })),
    )
    return
  }

  // A rule re-opened while already open is warned but still applied. The likeliest
  // cause is a missing `-end`, which the author wants to know; refusing it is what
  // produced the early-close bug. Ported from `eess-ts` when the parsers were
  // unified (ADR-012) — the kernel had no such warning, so `eess-md`,
  // `eess-mermaid` and `eess-gherkin` never got it.
  const alreadyOpen = new Set(openBlocks.flat().map((c) => c.ruleId))
  for (const ruleId of ruleIds) {
    if (!alreadyOpen.has(ruleId)) continue
    warnings.push({
      message:
        `eess-exclude-start for '${ruleId}' is already open — ` +
        `the enclosing block covers this region. Fix: remove this directive, ` +
        `or close the enclosing block first if the nesting was unintended.`,
      file: filePath,
      line: lineNum,
      kind: 'malformed',
    })
  }

  // Bug 0158: nesting is supported rather than refused. Blocks are a STACK, not
  // a map keyed by rule id — the map dropped an inner `-start` outright, and a
  // second start for the same id overwrote the first. One `-start` pushes one
  // frame, whatever number of ids it names.
  openBlocks.push(
    ruleIds.map((ruleId) => ({
      ruleId,
      reason,
      file: filePath,
      line: lineNum,
      isBlock: true,
    })),
  )
}

/** Handle a single-line exclude directive. */
function handleSingleLine(
  content: string,
  exclusions: ExclusionComment[],
  warnings: ExclusionWarning[],
  filePath: string,
  lineNum: number,
): void {
  // Skip if this was a block start or end (already handled above, but guard)
  if (content.startsWith('-start') || content.startsWith('-end')) return

  const { ruleIds, reason } = parseRuleIdsAndReason(content)

  // Bug 0158: the grammar documents `<rule-id>: <reason>`, and a reason-free
  // directive must not silence a real finding while the build exits 0.
  //
  // **How that is enforced changed in ADR-012, and the change is the point.**
  // This used to `return` — refusing the waiver — so the author saw the original
  // violation and a line on stderr about their directive. `eess-ts` had always
  // done the opposite (bug 0039): apply the waiver, and let `execute-rule`
  // replace the suppressed finding with an UNSUPPRESSABLE one saying the waiver
  // states no reason. Both end red; the second tells the author what to fix
  // instead of showing them the thing they were waiving.
  //
  // Unifying the two parsers forced a choice, and `eess-ts`'s is the better
  // design, so the kernel adopts it — which means the other four dialects gain
  // it. It is safe here because the kernel's own `execute-rule` now does the
  // promotion; applying without promoting would be the fail-open.
  if (reason === '') {
    warnUndocumented(warnings, ruleIds, 'eess-exclude', filePath, lineNum)
  }

  for (const ruleId of ruleIds) {
    exclusions.push({
      ruleId,
      reason,
      file: filePath,
      line: lineNum,
      isBlock: false,
    })
  }
}

/**
 * Scan a source file for eess-exclude comments.
 *
 * Supported formats:
 *   // eess-exclude <rule-id>: <reason>
 *   // eess-exclude-start <rule-id>: <reason>
 *   // eess-exclude-end
 *   // eess-exclude <rule-a>, <rule-b>: <reason>
 *   <!-- eess-exclude <rule-id>: <reason> -->      (markdown / text dialects)
 *   <!-- eess-exclude-start <rule-id>: <reason> --> / <!-- eess-exclude-end -->
 */
/**
 * Blanks the spans of a file that are NOT comments, length- and line-preserving
 * so every reported position still points at the original.
 *
 * A dialect that knows its language supplies one; `eess-ts` passes a
 * ts-morph-backed masker. See ADR-012.
 */
export type MaskNonComment = (sourceText: string, filePath: string) => string

export interface ParseExclusionOptions {
  /**
   * A dialect's own masker, applied BEFORE the kernel's default.
   *
   * Composition, not replacement (ADR-012 clause 3). An injected masker can only
   * blank MORE than the default, never less, so the worst a bad one can do is
   * hide a directive (loud) rather than expose one written inside a string
   * literal (silent, and bug 0154).
   */
  mask?: MaskNonComment
}

export function parseExclusionComments(
  sourceText: string,
  filePath: string,
  options?: ParseExclusionOptions,
): ParseResult {
  // Bug 0154: read directives from MASKED text, never the raw source. Strings,
  // templates, regex literals and block comments are blanked first — a directive
  // written inside one is prose, and reading it silently waived a real finding on
  // the next line. Masking is length- and line-preserving, so every position
  // reported below is still the position in the original file.
  // Mask with the lexer that matches the file. Running the JS/TS one over
  // markdown made a stray backtick swallow every directive after it — the same
  // question (is this text an example or an instance?) needs the host language's
  // answer, not one language's answer everywhere.
  //
  // Routed on MARKDOWN specifically, not on "not code". The first version used
  // `!CODE_LIKE`, which handed `.mmd`, `.feature`, `.yml` and everything else to
  // the markdown lexer — and a `.mmd` node label is a quoted string, which the
  // JS masker blanks and the markdown one does not. That is the very mistake this
  // comment describes, committed by the fix for it. Anything neither code nor
  // markdown keeps the conservative masker: over-masking hides a directive
  // (loud), under-masking invents one (silent).
  const defaultMask = CODE_LIKE.test(filePath)
    ? maskNonCommentSpans
    : MARKDOWN_LIKE.test(filePath)
      ? maskMarkdownCodeSpans
      : maskNonCommentSpans
  // The dialect's masker runs FIRST and the default runs over its output, so the
  // default's protection cannot be opted out of (ADR-012). A dialect supplies
  // accuracy; it cannot supply permission.
  const injected = options?.mask
  const masked = injected ? defaultMask(injected(sourceText, filePath)) : defaultMask(sourceText)
  const lines = masked.split('\n')
  const htmlApply = htmlFormsApply(filePath)
  const exclusions: ExclusionComment[] = []
  const warnings: ExclusionWarning[] = []
  const openBlocks: ExclusionComment[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const lineNum = i + 1

    // Check block end first (before start/single so we don't match -start as single)
    // The `//` forms read the FIRST comment's body; the HTML forms read the
    // whole line, since they are for text dialects with no `//` at all.
    const body = firstCommentBody(line)
    if (
      (body !== undefined && BLOCK_END_RE.test(body)) ||
      (htmlApply && HTML_BLOCK_END_RE.test(line))
    ) {
      handleBlockEnd(openBlocks, exclusions, warnings, filePath, lineNum)
      continue
    }

    // Check block start
    const startMatch =
      (body === undefined ? null : BLOCK_START_RE.exec(body)) ??
      (htmlApply ? HTML_BLOCK_START_RE.exec(line) : null)
    // `startMatch !== null`, not `startMatch?.[1]`. The capture is optional now, so
    // a bare `// eess-exclude-start` matches with group 1 undefined — and testing
    // the GROUP threw that line away again, which is the same "no frame, silent,
    // enclosing block closes early" defect one level up from the regex.
    if (startMatch !== null) {
      handleBlockStart(startMatch[1] ?? '', openBlocks, warnings, filePath, lineNum)
      continue
    }

    // Check single-line exclude (must not match block directives)
    const singleMatch =
      (body === undefined ? null : SINGLE_LINE_RE.exec(body)) ??
      (htmlApply ? HTML_SINGLE_RE.exec(line) : null)
    if (singleMatch?.[1]) {
      handleSingleLine(singleMatch[1], exclusions, warnings, filePath, lineNum)
    }
  }

  // Any unclosed blocks are errors
  for (const frame of openBlocks) {
    for (const comment of frame) {
      warnings.push({
        message: `eess-exclude-start without matching end for rule '${comment.ruleId}'`,
        file: filePath,
        line: comment.line,
        kind: 'malformed',
      })
    }
  }

  return { exclusions, warnings }
}

/**
 * Check if a violation is covered by an exclusion comment.
 *
 * For single-line comments: the violation must be in the same file and
 * on the line immediately after the comment.
 *
 * For block comments: the violation must be in the same file and
 * within the line range (start line, end line) inclusive.
 */
/** Check if a single comment covers the given violation. */
function commentCoversViolation(comment: ExclusionComment, violationLine: number): boolean {
  if (comment.isBlock) {
    return (
      comment.endLine !== undefined &&
      violationLine >= comment.line &&
      violationLine <= comment.endLine
    )
  }
  return violationLine === comment.line + 1
}

export function isExcludedByComment(
  violation: ArchViolation,
  comments: ExclusionComment[],
): boolean {
  const ruleId = violation.ruleId
  if (!ruleId) return false

  return comments.some(
    (comment) =>
      comment.ruleId === ruleId &&
      comment.file === violation.file &&
      commentCoversViolation(comment, violation.line),
  )
}
