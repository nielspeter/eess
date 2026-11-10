import { ArchConfigError, type ConditionContext } from '@nielspeter/eess'
import type { MdMention } from '../model/mentions.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'

/**
 * What every named-code-reference condition needs of its mentions (plan 0648), shared with plan
 * 0649's line condition: the refusals made when the rule is built, the requirements checked on
 * each mention, and the name rule.
 */

/** The builder's reading, which a condition cannot see from its elements. */
interface CodeReferenceReading {
  readonly pattern: RegExp
  readonly keepBackticks: boolean
}

/**
 * The pattern's named groups, listed by compiling it as an alternative of the empty string, so a
 * lookbehind or an escaped `\(?<` in the source is never mistaken for a group. The caller's flags
 * are kept, less `g` and `y`, so a pattern that needs `u` or `v` compiles.
 */
function namedGroups(pattern: RegExp): readonly string[] {
  const probe = new RegExp(`(?:${pattern.source})|`, pattern.flags.replace(/[gy]/g, ''))
  return Object.keys(probe.exec('')?.groups ?? {})
}

/**
 * Refuse, when the rule is built, a reading this condition cannot judge: one that drops inline
 * code's backticks, or a pattern without a group the condition requires.
 */
export function refuseCodeReferenceReading(
  owner: string,
  reading: CodeReferenceReading,
  required: readonly string[],
): void {
  if (!reading.keepBackticks) {
    throw new ArchConfigError(
      owner,
      `${owner}() needs the mentions read with inline code's backticks kept: write ` +
        `mentions(corpus, { pattern, keepBackticks: true }). Without it a pattern written with ` +
        `backticks matches nothing, and nothing says which part of a match is code.`,
    )
  }
  const groups = new Set(namedGroups(reading.pattern))
  const missing = required.filter((g) => !groups.has(g))
  if (missing.length > 0) {
    throw new ArchConfigError(
      owner,
      `${owner}() reads the pattern's named groups ${required.map((g) => `"${g}"`).join(', ')}; ` +
        `${String(reading.pattern)} has no ${missing.map((g) => `"${g}"`).join(', ')}. ` +
        `Name them with (?<name>…), for example.`,
    )
  }
}

/** A name this rule can look for: an identifier of at least two characters. */
const IDENTIFIER = /^[A-Za-z_$][\w$]+$/

/** A mention that passed the requirements: the name as written, the name judged, and the path. */
interface CodeReference {
  readonly mention: MdMention
  readonly name: string
  /** The last `.`-segment of `name`, the token this rule looks for. */
  readonly judged: string
  readonly path: string
}

/** The element a finding names: the document, then the name and the path as written. */
function referenceElement(m: MdMention): string {
  return `${m.doc.relPath} → \`${m.groups['name'] ?? ''}\` \`${m.groups['path'] ?? ''}\``
}

/** A finding about one mention, with its own remedy. */
export function referenceFinding(
  m: MdMention,
  ctx: ConditionContext,
  message: string,
  suggestion: string,
  cannotJudge: boolean,
): ArchViolation {
  return {
    ...mdViolation({
      element: referenceElement(m),
      file: m.doc.file,
      line: m.line,
      message,
      sourceText: m.doc.text,
      context: ctx,
    }),
    suggestion,
    // A finding that says the rule could not judge the mention fails `.warn()` and no exclusion
    // drops it (ADR-021 clause 5): a rule that judged nothing must never read as clean. One per
    // mention, since each mention is its own cause, as eess-md's unread findings are.
    ...(cannotJudge ? { bypassFilters: true } : {}),
  }
}

/**
 * The requirements, in order, the first that fails being the only finding (plan 0648 Phase 2):
 * every required group captured; `name` and `path` each inside one code span; the judged name an
 * identifier. Returns the reference, or the one finding.
 */
export function readReference(
  m: MdMention,
  required: readonly string[],
  ctx: ConditionContext,
): CodeReference | ArchViolation {
  const quoted = `"${m.text.replace(/\s+/g, ' ')}"`
  for (const group of required) {
    if (m.groups[group] === undefined) {
      return referenceFinding(
        m,
        ctx,
        `${quoted}: the pattern's "${group}" group did not capture here, so this rule cannot judge it`,
        `Make the "${group}" group required in the pattern, so every match captures it.`,
        true,
      )
    }
  }
  for (const group of ['name', 'path']) {
    if (!(m.codeGroups ?? []).includes(group)) {
      return referenceFinding(
        m,
        ctx,
        `${quoted}: the ${group} is not inside one code span, so this rule cannot judge it as code`,
        'Write the name and the path each in its own code span, as `name` (`path`).',
        true,
      )
    }
  }
  const name = m.groups['name'] ?? ''
  const path = m.groups['path'] ?? ''
  const judged = name.split('.').pop() ?? ''
  if (!IDENTIFIER.test(judged)) {
    return referenceFinding(
      m,
      ctx,
      `\`${name}\` is not a name this rule can look for` +
        (judged === name ? '' : ` (it judges the last segment, "${judged}")`),
      'Write the identifier itself: two or more letters, digits, `_` or `$`, not starting with a digit.',
      true,
    )
  }
  return { mention: m, name, judged, path }
}

/** Whether `readReference` returned a reference rather than a finding. */
export function isReference(r: CodeReference | ArchViolation): r is CodeReference {
  return 'judged' in r
}
