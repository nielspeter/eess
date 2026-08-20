import type { ArchViolation } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import type { DiscoverySource } from './slice-rule-builder.js'
import { emptyProjectAdvice, loadedNothing } from '../core/empty-project-advice.js'
import { matchingGlobPrefix } from '../models/slice.js'
import { FAULT_ADVICE, GLOB_DOCS, syntacticFault } from '../core/glob-diagnosis.js'
import type { GlobFault } from '../core/glob-diagnosis.js'
import { isProjectRelative } from '../core/project-relative.js'

/** How many causes a group names before it summarises the rest. */
const MAX_NAMED_CAUSES_PER_GROUP = 4

/**
 * Rule builder for slice-level architecture rules.
 *
 * Unlike other builders that extend RuleBuilder<T>, SliceRuleBuilder
 * has its own chain because the grouping step (matching/assignedFrom)
 * replaces the predicate phase entirely.
 *
 * Usage:
 *   slices(project).matching(glob).should().beFreeOfCycles().check()
 *   slices(project).assignedFrom(def).should().respectLayerOrder(...).check()
 */
/** The shared advice starts lowercase for `diagnose`; here it opens a sentence. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * What a slice rule says when its discovery found nothing.
 *
 * Split from the builder because composing the explanation is not deciding one
 * is warranted — and it is the larger half. The two inputs the family reads,
 * the project and the discovery declaration, arrive as arguments.
 */

/**
 * The remedy for empty discovery, derived from how slices were sourced *and*
 * from the globs actually given.
 *
 * Bug 0009 was a single hardcoded remedy that was correct for one source and
 * false for the other. Branching only on the source is not enough: telling a
 * caller to add a `**\/` prefix they already have, or to check a directory that
 * plainly exists, is the same defect one level down. So each branch below is
 * reachable only when its advice is actually true (ADR-008).
 */
export function emptyDiscoveryMessage(
  project: ArchProject,
  discovery: DiscoverySource | undefined,
): string {
  const tail = 'A slice rule that discovers nothing enforces nothing.'

  if (!discovery) {
    return (
      'No slice source: call .matching(glob) or .assignedFrom(definition) ' +
      `before .should(). ${tail}`
    )
  }

  // Nothing can match when the project loaded no files at all — blaming the
  // glob would send the caller to the wrong file entirely.
  if (loadedNothing(project)) {
    // The SAME string `diagnose()` reports, from the one place that owns it.
    // These were two texts for one state and had already diverged: this copy
    // said only "check that this tsconfig includes your sources", which is
    // not actionable for a config that has no `include` at all — and this is
    // the copy a failing build prints.
    return `${capitalize(emptyProjectAdvice(project))}. ${tail}`
  }

  if (discovery.mode === 'matching') {
    return matchingDiscoveryMessage(project, discovery.glob, tail)
  }

  return assignedFromDiscoveryMessage(discovery.entries, tail)
}

/**
 * Why a `matching(glob)` discovery resolved no slices.
 *
 * Its own method because the two discovery modes are two independent fault
 * ladders that share only the closing sentence — `emptyDiscoveryMessage` was
 * both of them plus the guards, and read as one method only by adjacency.
 *
 * Takes the glob rather than re-reading `discovery`: the caller has
 * already narrowed the mode, and narrowing twice is how the two copies drift.
 */
function matchingDiscoveryMessage(project: ArchProject, glob: string, tail: string): string {
  const prefix = matchingGlobPrefix(glob)

  // No literal directory prefix at all ('src', '*', '{a,b}/x/*'). Telling the
  // caller to "check the prefix" would send them to inspect something that does
  // not exist — the false-remedy shape this guard keeps relapsing into.
  if (prefix === '') {
    return (
      `matching(${JSON.stringify(glob)}) has no literal directory prefix, so there is ` +
      'nothing to locate in your file paths. It needs at least one plain directory ' +
      `segment before the wildcard, e.g. "src/features/*". ${tail}`
    )
  }

  // Check the claim before making it. The prefix is located with a literal
  // `indexOf` while the pattern goes through picomatch, and the two disagree
  // for prefixes containing `(`, `{` or `!` — so "the prefix was not found"
  // was a verifiable falsehood on exactly the route-group directory names this
  // parser is careful to treat as literal elsewhere.
  const prefixExists = project.getSourceFiles().some((file) => file.getFilePath().includes(prefix))

  if (prefixExists) {
    return (
      `matching(${JSON.stringify(glob)}) resolved no slices even though the prefix ` +
      `${JSON.stringify(prefix)} does occur in this project's files, so the rest of the ` +
      'glob matched nothing. If a path segment contains "(", ")", "{", "}" or "!", those ' +
      'are pattern syntax rather than literal characters here — match that level with ' +
      `"*" instead. ${tail}`
    )
  }

  return (
    `matching(${JSON.stringify(glob)}) resolved no slices: the prefix ` +
    `${JSON.stringify(prefix)} was not found in any of this project's ` +
    `${String(project.getSourceFiles().length)} file paths. Compare it against a ` +
    'real path — the segment after the prefix names each slice (a directory when files ' +
    `are nested under it, otherwise each matching file name). ${tail}`
  )
}

/**
 * Why an `assignedFrom(...)` discovery resolved no slices.
 *
 * Reports EVERY entry, grouped by its own cause — reporting one group and
 * stopping, or applying one group's advice to all of them, is what made each
 * earlier version of this message false for somebody.
 */
function assignedFromDiscoveryMessage(
  entries: readonly { readonly name: string; readonly glob: string }[],
  tail: string,
): string {
  if (entries.length === 0) {
    return (
      'assignedFrom() was given no entries, so there are no slices to check. Pass at ' +
      `least one name-to-glob mapping, e.g. { services: "**/src/services/**" }. ${tail}`
    )
  }

  // Every entry is at fault (all slices are empty), so every entry is reported,
  // grouped by its own cause. Reporting one group and stopping — or applying one
  // group's advice to all of them — is what made each earlier version of this
  // message false for somebody.
  const clauses = faultGroups(entries).map((group) => {
    // Cap per group, never across groups, so no cause is hidden entirely — and
    // always keep an entry whose key the docs single out as error-prone.
    const notable = group.list.filter((entry) => /shared/i.test(entry.name))
    const ordered = [...notable, ...group.list.filter((entry) => !notable.includes(entry))]
    const head = ordered.slice(0, MAX_NAMED_CAUSES_PER_GROUP)
    const rest = ordered.length - head.length
    const named =
      head.map((entry) => `${entry.name}: ${JSON.stringify(entry.glob)}`).join(', ') +
      (rest > 0 ? `, and ${String(rest)} more` : '')
    return `${FAULT_ADVICE[group.fault]}: ${named}`
  })

  return `Every slice in assignedFrom(...) is empty. ${clauses.join('. Separately, ')}. ${tail}`
}

/**
 * The entries, grouped by the fault that explains them, in reporting order.
 *
 * Syntactic only: this runs while explaining why EVERY slice is empty, so
 * "matched no file" is already established and the useful split is between the
 * two causes with a verifiable fix.
 */
function faultGroups(
  entries: readonly { readonly name: string; readonly glob: string }[],
): { fault: GlobFault; list: readonly { readonly name: string; readonly glob: string }[] }[] {
  const FAULT_ORDER: readonly GlobFault[] = ['dot-segment', 'unanchored', 'no-match']
  return FAULT_ORDER.map((fault) => ({
    fault,
    list: entries.filter(
      (entry) =>
        // The SAME base the declaration uses (bug 0033). With the default
        // `'absolute'`, a project-relative glob is classified `unanchored` and
        // the message tells the author to prefix `"**/"` — advice that stopped
        // being true when this entry point started resolving one against the
        // project root. It would now send them to change a glob whose spelling
        // is fine and whose folder is simply missing.
        (syntacticFault(
          entry.glob,
          'file-path',
          isProjectRelative(entry.glob) ? 'normalized' : 'absolute',
        ) ?? 'no-match') === fault,
    ),
  })).filter((group) => group.list.length > 0)
}

/**
 * A config-level finding: the rule is misconfigured, so it checks nothing.
 *
 * Deliberately does NOT carry the rule author's `suggestion`/`docs`. Those
 * describe how to fix a *real* violation of the rule ("Split the cycle"), and the
 * formatter renders `suggestion` under `Fix:` — the field an agent obeys. Pairing
 * a configuration message with an unrelated `Fix:` is a false remedy by
 * juxtaposition, no matter how accurate each half is on its own.
 */
export function metaViolation(
  message: string,
  metadata: { id?: string; suggestion?: string; docs?: string } | undefined,
  reason: string | undefined,
): ArchViolation {
  const id = metadata?.id ?? 'slices'
  return {
    rule: id,
    ruleId: metadata?.id,
    element: id,
    file: '',
    line: 0,
    message,
    because: reason,
    // Its own remedy, not the rule author's (bug 0021). Deliberately generic:
    // the specific, per-branch diagnosis is already in `message`, where
    // `emptyDiscoveryMessage` derives it and — per the comment there — each
    // branch is reachable only when its advice is actually true. Restating that
    // in `suggestion` would mean two texts to keep in agreement, which is the
    // drift this project keeps paying for. So the `Fix:` line names the two
    // actions that hold in every branch and points at the diagnosis.
    suggestion:
      'A slice rule that discovers nothing cannot enforce anything: correct the cause ' +
      'named in the message, or remove the rule.',
    docs: GLOB_DOCS,
    bypassFilters: true,
  }
}
