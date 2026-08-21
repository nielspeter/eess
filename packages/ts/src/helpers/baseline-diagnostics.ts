import type { ArchViolation } from '@nielspeter/eess'
import { hashSubject, HASH_VERSION } from './baseline.js'

/**
 * Why a baseline stopped matching — the diagnosis half of `Baseline`.
 *
 * `Baseline` answers "is this finding already accepted?", which is three short
 * methods. Explaining why an accepted set suddenly matches nothing is a
 * different job and five times the code, and keeping both in one class is what
 * pushed it past its own size rule.
 *
 * These take an explicit {@link BaselineFacts} rather than the instance, so each
 * diagnosis is callable — and testable — against a stated set of facts instead
 * of a constructed object.
 */
export interface BaselineFacts {
  readonly knownHashes: ReadonlySet<string>
  readonly knownSubjects: ReadonlyMap<string, string>
  readonly root: string
  readonly sourcePath: string | undefined
  readonly hashVersion: number
  isKnown(violation: ArchViolation): boolean
  hasEntry(violation: ArchViolation): boolean
}

/**
 * A meta-finding for baseline entries that stopped matching because the
 * **rule's description changed**, not because the violation was fixed.
 *
 * The distinction is the whole difficulty (bug 0027). An entry that stops
 * matching is normally success — that is what a ratchet is for — so "some
 * entries did not match" is not evidence of anything, which is why
 * \{@link unmatchedBaselineFinding\} is gated on `matched === 0` and stays
 * silent here. But that leaves the common case unexplained: an accepted
 * violation reported as new, reading like fresh rot in application code.
 *
 * `hashSubject` is the differently-derived value that separates them. A
 * violation in this run whose subject matches a baseline entry, under a
 * different full hash, is the same finding about the same code under a rule
 * whose description moved. A subject present in the baseline and absent from
 * the run was fixed, and says nothing.
 *
 * Silent for a baseline written before 0.24.0: those entries have no subject,
 * so the question cannot be asked and no cause is guessed.
 */
/**
 * The rule description the baseline recorded for this violation's subject, when
 * the violation looks like the SAME finding under a renamed rule.
 *
 * Extracted from `descriptionChangeFinding` so the four disqualifying cases
 * read as one question with one answer instead of four `continue`s inside the
 * accumulating loop (they were most of that method's branching).
 */
function renamedRuleFor(ctx: BaselineFacts, violation: ArchViolation): string | undefined {
  if (violation.bypassFilters === true) return undefined
  if (ctx.isKnown(violation)) return undefined
  // A regressed metric is not a renamed rule (bug 0012). Its hash is in the
  // baseline — the description is demonstrably unchanged — and only the
  // measurement moved, so `isKnown` is false while `hasEntry` is true. Without
  // this the ratchet's own working case reported "1 rule whose description
  // changed", which is a false cause under ADR-009 rule 2.
  if (ctx.hasEntry(violation)) return undefined
  return ctx.knownSubjects.get(hashSubject(violation, ctx.root))
}

export function descriptionChangeFinding(
  ctx: BaselineFacts,
  violations: ArchViolation[],
): ArchViolation | undefined {
  if (ctx.knownSubjects.size === 0) return undefined
  // Rule descriptions the baseline recorded for subjects this run re-reported
  // under a different identity. A Map keyed by the OLD description, so the
  // same edited rule is named once however many violations it has.
  const changed = new Map<string, string>()
  for (const violation of violations) {
    const recordedRule = renamedRuleFor(ctx, violation)
    if (recordedRule !== undefined) changed.set(recordedRule, violation.rule)
  }
  if (changed.size === 0) return undefined

  const where = ctx.sourcePath ?? 'the baseline file'
  // Identities, never a total (ADR-009 rule 4): name the rules, both spellings,
  // so the reader can see WHAT changed rather than being told how many did.
  const pairs = [...changed.entries()]
    .map(([was, now]) => `\n  was: ${was}\n  now: ${now}`)
    .join('')
  const plural = changed.size === 1 ? 'rule' : 'rules'
  return {
    rule: 'eess-ts: baseline',
    element: 'baseline',
    file: '',
    line: 0,
    message:
      `Baseline at ${where} no longer matches ${String(changed.size)} ${plural} whose ` +
      `description changed, so already-accepted violations of ${changed.size === 1 ? 'it' : 'them'} ` +
      `are being reported as new. This is not new rot in your code — the rule was edited, ` +
      `or its conditions accumulated (v0.23.0):${pairs}`,
    because:
      "A violation's identity includes the rule description, so editing a rule re-reports every violation it had already accepted — indistinguishable from a regression unless it is named.",
    suggestion: `Regenerate the baseline: \`npx eess-ts baseline <your-rule-files> --output ${where}\`. Review the diff: the entries that vanish are the ones listed above, and their replacements should be the same violations under the new description.`,
    bypassFilters: true,
  }
}

/**
 * A meta-finding for a baseline that is present, non-empty, and matched
 * **nothing** in a run that produced findings it could have matched.
 *
 * Gated on the measurement, not on the version field. An earlier cut fired
 * whenever `hashVersion` was older, which was wrong for most users: v2
 * hashing is byte-identical to v1 for any violation whose fields contain no
 * path, so the majority of existing baselines still match perfectly. Failing
 * those with "its entries match nothing" was both a false red and a false
 * statement — a derived value reported as a fact with nothing disagreeing
 * with it, which is the ADR-009 rule 5 mistake this bug was about.
 *
 * `matched === 0` is the independently-derived signal, and it covers every
 * cause at once: a v1 file, a root that resolved differently here than where
 * the file was written, or a baseline for a different project entirely.
 *
 * Silent when the run produced nothing to match (`matchable === 0`) — an
 * empty run is not evidence about the baseline. Carries `bypassFilters`
 * because the filters are what it is reporting on (ADR-008; plan 0067).
 */
export function unmatchedBaselineFinding(
  ctx: BaselineFacts,
  matched: number,
  matchable: number,
): ArchViolation | undefined {
  if (ctx.knownHashes.size === 0 || matchable === 0 || matched > 0) return undefined
  const where = ctx.sourcePath ?? 'the baseline file'
  const entries = ctx.knownHashes.size
  const plural = entries === 1 ? 'entry' : 'entries'
  const cause = unmatchedCause(ctx)
  return {
    rule: 'eess-ts: baseline',
    element: 'baseline',
    file: '',
    line: 0,
    message:
      `Baseline at ${where} matched 0 of its ${String(entries)} ${plural} against ` +
      `${String(matchable)} finding(s) in this run, so every one of them is being reported as new. ${cause}`,
    because:
      'A baseline that matches nothing is indistinguishable from a mass regression, and silently reporting the whole set as new hides which of the two happened (bug 0010).',
    suggestion:
      ctx.hashVersion > HASH_VERSION
        ? 'Upgrade eess-ts to a version that reads this format.'
        : // `<your-rule-files>` stands in for the caller's own paths on
          // purpose: the command needs rule files unless a config supplies
          // them, and printed without them it fails with "No rule files
          // specified" — a remedy that
          // cannot remediate (ADR-009 rule 2). Measured. The path is left as
          // recorded rather than absolutized, so the line is copyable on a
          // machine other than the one that wrote the baseline.
          `Regenerate it: \`npx eess-ts baseline <your-rule-files> --output ${where}\` (rule files are implied if an eess-ts config lists them). Review the diff first — entries that vanish were never matching here.`,
    bypassFilters: true,
  }
}

/**
 * Why a baseline matched nothing — or, where nothing can be told apart, the
 * candidates in order.
 *
 * Extracted from {@link unmatchedBaselineFinding} so that method stays inside
 * `eess/max-method-lines`, which bug 0170 re-derived from span lines to code
 * lines. Most of what was there was this decision.
 */
function unmatchedCause(ctx: BaselineFacts): string {
  if (ctx.hashVersion < HASH_VERSION) {
    return `It was written in identity format v${String(ctx.hashVersion)} and this version reads v${String(HASH_VERSION)}, which is the likely cause.`
  }
  if (ctx.hashVersion > HASH_VERSION) {
    return `It was written in identity format v${String(ctx.hashVersion)}, which is newer than this version reads (v${String(HASH_VERSION)}) — upgrade eess-ts rather than regenerating.`
  }
  // **Do not assert a cause that has not been distinguished from its alternatives.**
  //
  // This branch used to say "Same identity format, so the likely cause is that it
  // was generated against a different repository root". That is one cause among
  // several and the code has checked none of them —
  // [ts-archunit bug 0060](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0060-a-pattern-change-silently-invalidates-every-baselined-finding.md),
  // where a shipped default pattern changed and a reader spent an hour on `root`
  // before regenerating, which is the outcome ts-archunit's `docs/upgrading.md` exists to prevent.
  //
  // The rename detector above cannot cover it either: when a pattern changes, the
  // rule description AND the subject move together, so `hashSubject` misses and
  // that diagnostic stays silent. Nothing here can tell these apart, so the honest
  // output is the candidate list, ordered, with the version-specific one first
  // because upgrading is when this happens.
  return (
    'The identity format is unchanged, so one of its INPUTS moved.\n' +
    '  This code cannot tell which. In order of likelihood:\n' +
    '    1. you upgraded, and a shipped rule description or default pattern changed —\n' +
    '       check the CHANGELOG entry for the version you moved to, which says so when\n' +
    '       it happens. If this is it, regenerating is correct and expected.\n' +
    '    2. you upgraded, and a metric changed WHAT IT COUNTS (bug 0171). Those entries\n' +
    '       normally still match and report themselves — but a rule edited in the same\n' +
    '       release moves the identity too, and then they land here instead.\n' +
    '    3. the baseline was generated against a different repository root — see the\n' +
    '       `root` option on withBaseline()/generateBaseline().\n' +
    '    4. the rules themselves were edited.'
  )
}
