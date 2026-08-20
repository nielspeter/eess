import type { ArchViolation } from '@nielspeter/eess'
import type { ArchProject } from './project.js'
import type { GlobNode, GlobSite, RuleDescription } from '@nielspeter/eess'
// The dialect's own `PathUniverse`, not the kernel's identically-shaped one. The
// values reaching here are built by `pathUniverse()` in this package, so the
// local type is the one that actually describes them; importing the kernel's
// compiled only because the two are structurally identical today, which is a
// coincidence to stop relying on rather than a contract.
import type { PathUniverse } from './path-universe.js'
import { DECLARE_INSTEAD, isFaultPosition, UNSUPPRESSABLE } from '@nielspeter/eess'
import { diagnoseGlob, FAULT_ADVICE, ON_DISK_ADVICE } from './glob-diagnosis.js'
import { globSitesOf, isDeadGlobTree, isDeadSite } from './glob-evaluator.js'
import { pathUniverse } from './path-universe.js'
import { diskSet } from './disk-set.js'
import { emptyProjectAdvice, loadedNothing } from './empty-project-advice.js'

/**
 * The unit noun, singular when there is one of it — plan 0099.
 *
 * `n === 1` is the MOST likely expiry case: a declaration expires the day the
 * first thing appears, so "it examined 1 subjects" is the sentence a reader is
 * likeliest to meet. The zero-subjects sentence one method away already
 * pluralises its file count correctly.
 */
function singularise(noun: string, n: number): string {
  if (n !== 1) return noun
  return noun.endsWith('ies') ? `${noun.slice(0, -3)}y` : noun.replace(/s$/, '')
}

/**
 * What a rule can be asked about itself, without running it.
 *
 * Every diagnosis in this module is a function of these and nothing else — none
 * of them evaluates the rule. That is what let them leave `TerminalBuilder`:
 * they were never terminal behaviour, they were explanations OF it, and keeping
 * them on the class is most of why it carried 372 code lines.
 */
// Consumed by the test suite; the build tsconfig this gate reads excludes tests,
// so `src` is the only usage it can see. The directive sits LAST because a
// single-line waiver covers exactly the next line.
// eess-exclude eess/no-unused-exports: test-only consumer
export const ASSERTION_DOCS =
  'https://nielspeter.github.io/eess/violation-reporting#a-rule-must-assert-something'

export interface RuleFacts {
  /** The builder's own class, for naming the rule in a finding. */
  readonly ruleClass: { name: string }
  describeRule(): RuleDescription
  assertionAdvice(): string
  emptyDeclarationAdvice(): string
  examinedUnitNoun(): string
  narrowingHint(): string | undefined
  getProject(): ArchProject | undefined
  globs(): readonly GlobNode[]
  assertsCardinality(): boolean
  declaresEmpty(): boolean
  zeroSubjectsAdvice(): string
  zeroSubjectsViolation(project: ArchProject | undefined): ArchViolation
}

/**
 * The finding for a rule that states no assertion at all.
 *
 * Extracted from `collectWithAssertionGuard`, which was the assertion gate,
 * the dead-selector gate, the evidence floor AND this constructor in one
 * method — most of its branching was the reader having to hold all four.
 */
export function assertionLessFinding(facts: RuleFacts): ArchViolation[] {
  const described = facts.describeRule()
  const name = described.id || described.rule || facts.ruleClass.name
  // ADR-008 rule 3: where there is deliberately no escape hatch, say so, and
  // say what to do instead. Stated on the finding rather than inside
  // `assertionAdvice()` so the seven per-shape remedies stay one sentence each
  // and this stays one sentence in one place. Measured before it was added: a
  // reader given only the remedy tries `.asSeverity('warn')`, `.excluding()`,
  // the baseline and `--changed` — four CI cycles — because nothing told them
  // those were refused.
  const advice = `${facts.assertionAdvice()} ${UNSUPPRESSABLE}`
  return [
    {
      rule: name,
      ruleId: described.id,
      element: name,
      file: '',
      line: 0,
      message: advice,
      // Its own remedy, never the author's (bug 0021): their `suggestion`
      // describes how to fix a violation of the rule, and this finding says
      // the rule cannot produce one. Same for `docs` — the author's link is
      // about their rule; this one is about the grammar the rule broke.
      suggestion: advice,
      docs: ASSERTION_DOCS,
      bypassFilters: true,
      // `ruleId` and `because` are deliberately NOT set here. `applyFilters`
      // fills both from the rule's metadata for every finding that leaves
      // them unset, and all three callers of this method go through it — so
      // setting them here was two lines that read as load-bearing and were
      // not: sabotage removed each with nothing failing. The remedy fields
      // above are the opposite case, and must stay, because `applyFilters`
      // deliberately refuses to supply those for a `bypassFilters` finding.
    },
  ]
}

/**
 * Walk the glob trees and split the dead sites by position.
 *
 * Extracted from `deadSelectorFindings`, which is otherwise five guard clauses
 * and this loop — the guards are the interesting part and the nesting was most
 * of the branching.
 */
function deadSitesIn(
  facts: RuleFacts,
  trees: readonly GlobNode[],
  project: ArchProject,
): { selector: ArchViolation[]; discovery: ArchViolation[] } {
  const universe = pathUniverse(project)
  const selector: ArchViolation[] = []
  const discovery: ArchViolation[] = []
  for (const tree of trees) {
    // Only inside a tree that is dead as a whole: `or(dead, live)` is a
    // working rule, and reporting its dead branch is the false red the tree
    // model exists to prevent.
    if (!isDeadGlobTree(tree, universe)) continue
    for (const site of globSitesOf(tree)) {
      // `isFaultPosition`, shared with `diagnose()` — the two used inverse
      // hand-maintained lists and disagreed about exactly `discovery`, which
      // is why `doctor` reported a dead layer glob and the build did not.
      if (!isFaultPosition(site.position)) continue
      if (!isDeadSite(site, universe)) continue
      const finding = deadSelectorViolation(facts, site, universe, project)
      if (site.position === 'discovery') discovery.push(finding)
      else selector.push(finding)
    }
  }
  return { selector, discovery }
}

/**
 * The finding for one dead selector glob.
 *
 * Carries the SAME cause and advice `doctor` prints, from the same two
 * tables — a reader who ran the pre-flight must not be told something
 * different by the build that fails. Bugs 0031 and 0032 are why the tables
 * are worth reusing rather than paraphrasing: both were cases where the
 * cause stated was wrong for the input, and both were fixed in one place.
 *
 * `bypassFilters` makes it a configuration finding: `error` severity
 * regardless of `.asSeverity('warn')`, refused by `.excluding()`, and
 * skipped by diff and baseline (ADR-008 rule 1). A rule that can never have
 * subjects is not a violation you triage; it is a rule that does not work.
 */
function deadSelectorViolation(
  facts: RuleFacts,
  site: GlobSite,
  universe: PathUniverse,
  project: ArchProject,
): ArchViolation {
  const described = facts.describeRule()
  const name = described.id || described.rule || facts.ruleClass.name
  const diagnosis = diagnoseGlob(site, universe, diskSet(project))
  const onDisk = diagnosis.onDisk === undefined ? '' : ON_DISK_ADVICE[diagnosis.onDisk]
  const cause = onDisk === '' ? FAULT_ADVICE[diagnosis.fault] : onDisk
  // Position-aware in BOTH clauses, not just the noun (plan 0080).
  //
  // Admitting `discovery` globs made this sentence wrong twice over for them.
  // The noun was the obvious half — a `smells.duplicateBodies().inFolder()` glob
  // is not a "selector". The **consequence clause** was the part that actually
  // lied: "it has no subjects and cannot fail" describes a rule that selects
  // nothing, while a dead discovery glob means the rule discovered nothing to
  // compare — there may be plenty of subjects. Review flagged that fixing the
  // noun alone ships a grammatical sentence that is still false.
  const isDiscovery = site.position === 'discovery'
  const what = isDiscovery ? 'discovery glob' : 'selector'
  const consequence = isDiscovery
    ? 'so it discovers nothing to check and cannot fail'
    : 'so it has no subjects and cannot fail'
  const advice =
    `This rule's ${what} ${site.origin} can never match anything in this project, ` +
    `${consequence} — ${cause}. ` +
    `Correct the glob, or remove the rule. ${UNSUPPRESSABLE}`
  return {
    rule: name,
    ruleId: described.id,
    element: site.glob,
    file: '',
    line: 0,
    message: advice,
    // Its own remedy, never the author's (bug 0021): their `suggestion` is
    // for a violation of the rule, and this says the rule cannot produce one.
    suggestion: advice,
    bypassFilters: true,
  }
}

/**
 * ADR-010's floor: what to report when a family produced NOTHING from NOTHING.
 *
 * `undefined` means "no floor finding — carry on", which is not the same as
 * an empty array (that is a deliberate pass, and `assertsCardinality()`
 * returns one).
 *
 * A family that produced ANY finding passes through untouched. The floor
 * fires only where a family produced nothing from nothing — bug 0066's shape.
 * Each family's own empty-selection block stays as the better-attributed
 * implementation; this is a floor beneath them, not a replacement.
 *
 * Precedence has already removed the other causes by the time this is reached:
 * no dead selector glob, no missing assertion, no empty project, no cardinality
 * assertion, no declaration. So the remedy names ONE cause without the hedging
 * ADR-008 rule 2 forbids.
 *
 * Three defects in 0098's preview wording are fixed here, from its
 * user-perspective review:
 *
 * - **It hedged where we hold the fact.** "including any default it applies
 *   that you did not write" was printed as a hypothetical while the rule knew
 *   the answer. We materialized the selection, so we know the project loaded N
 *   files and the selection produced 0 — print the numbers.
 * - **"can never fail" overstated.** For a `crossLayer` rule whose pairs do not
 *   exist yet, or a folder empty in a young repository, the rule is correct and
 *   matches nothing *today*. "never" made a true statement false.
 * - **The ranking was wrong for the people most likely to adopt early.** It
 *   called widening the fix and declaring "the exception… proves nothing". For
 *   a team whose second layer is not built yet, widening is *impossible* — the
 *   code does not exist — so the only available action was the one the message
 *   disparaged. Both are now offered as peers, and the declaration is described
 *   by what it does: it expires.
 */
export function evidenceFloor(
  facts: RuleFacts,
  violations: ArchViolation[],
  examined: number,
): ArchViolation[] | undefined {
  if (violations.length !== 0 || examined !== 0) return undefined
  // The instrument outranks the selection. A declaration asserts a fact
  // about a LOADED corpus; over zero loaded files it asserts nothing, and
  // the expiry that justifies `.expectEmpty()` can never engage — so on a
  // solution-style tsconfig a one-line declaration would restore bug 0066's
  // 401-findings-reported-clean permanently, through the sanctioned door.
  // This supersedes the precedence bug 0066's root-cause note endorsed:
  // that ordering is right at SELECTION level and wrong at INSTRUMENT level.
  //
  // `getProject()` may be undefined and that is honest, not a gap:
  // `correspondence` discards its project by documented design, and an
  // ADR-010 dialect over a non-TypeScript element type has none. The
  // instrument check is skipped; the zero-subjects floor below still holds.
  const project = facts.getProject()
  if (project !== undefined && loadedNothing(project)) {
    return [emptyProjectViolation(facts, project)]
  }
  // `.notExist()` and friends examine zero BECAUSE that is what they
  // assert. Exempt since 0.34.0, and `diagnose()` exempts it too — the two
  // must agree or `doctor` and `check` disagree about a working rule.
  if (facts.assertsCardinality()) return violations
  // The author said empty is the point. `declaresEmpty()` — not
  // `_expectEmpty` — because `CorrespondenceBuilder` declares per side and
  // overrides this; asking a fully-declared correspondence to declare would
  // be ADR-008 rule 2's loop, and the base implementation cannot express it.
  if (!facts.declaresEmpty()) return [facts.zeroSubjectsViolation(project)]
  return undefined
}

/**
 * The finding for a project that loaded no source files.
 *
 * Deliberately **not** `deadSelectorViolation` with different text: that one
 * names a glob as its `element`, and here no glob is at fault. The element is
 * the rule, matching how `diagnose()` reports this state.
 *
 * Carries the same advice `doctor` prints, from the one owner
 * (`empty-project-advice.ts`) — the parity `deadSelectorViolation`'s docstring
 * claims for the whole gate, which was false for this input until bug 0048.
 */
function emptyProjectViolation(facts: RuleFacts, project: ArchProject): ArchViolation {
  const described = facts.describeRule()
  const name = described.id || described.rule || facts.ruleClass.name
  // `emptyProjectAdvice` deliberately returns a lowercase, period-less clause so
  // each caller can frame it. Capitalised inline rather than via a shared helper:
  // `slice-rule-builder.ts` has its own local `capitalize` and core has none, so
  // importing across that boundary for one character would be the worse trade.
  const shared = emptyProjectAdvice(project)
  const advice = `${shared.charAt(0).toUpperCase()}${shared.slice(1)}. ${UNSUPPRESSABLE}`
  return {
    rule: name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message: advice,
    // Its own remedy, never the author's (bug 0021).
    suggestion: advice,
    bypassFilters: true,
  }
}

/**
 * A declaration that has expired — plan 0099.
 *
 * The property that makes `.expectEmpty()` an assertion rather than
 * `allowEmpty()`'s permission, which had no failing state and so stayed green
 * forever. Here the number IS the finding: the author asserted zero and the
 * answer is not zero.
 *
 * The remedy is DISTINCT from the message, because `format.ts` drops the `Fix:`
 * line when the two are equal — a defect this producer's rule-builder ancestor
 * shipped with, found in review of plan 0089.
 */
export function expiredDeclarationViolation(facts: RuleFacts, examined: number): ArchViolation {
  const described = facts.describeRule()
  const name = described.id || described.rule || facts.ruleClass.name
  const declaration = facts.emptyDeclarationAdvice()
  const message = `${declaration} asserted this rule examines nothing, and it examined ${String(examined)} ${singularise(facts.examinedUnitNoun(), examined)}.`
  const suggestion =
    `Remove ${declaration} and let the rule enforce itself — the thing you were waiting for has ` +
    `appeared, and the rule now has something to check. If instead the selection is wider than you ` +
    `meant, narrow it and keep the declaration. ` +
    `The rule's own violations are reported as separate findings under the same rule id. ` +
    UNSUPPRESSABLE
  return {
    rule: name,
    ruleId: described.id,
    // The DESCRIPTION, not the id — and this is the one place in this file
    // where that differs on purpose.
    //
    // `dedupeConfigFindings` keys on `(file, ruleId ?? rule, element)`. With
    // `file: ''` and the id in both remaining slots, every instance of a
    // fanned-out preset id collapses to one and picks up `affectedNote`'s
    // "this one option generated N rules that cannot enforce anything".
    //
    // For `zeroSubjectsViolation` that collapse is CORRECT: those N rules
    // genuinely cannot enforce, and they are one edit. Here it is false — a
    // rule whose declaration expired enforces fine, and its violations are
    // reported alongside. Measured in review of plan 0089: 4 findings became 3,
    // the survivor claiming two rules could not enforce while both their real
    // violations sat below it. `RuleBuilder.describeRule()` returns the chain
    // description, which differs per instance and keeps them distinct.
    element: described.rule || name,
    file: '',
    line: 0,
    message,
    suggestion,
    bypassFilters: true,
  }
}

/**
 * A dead glob's findings, **split by whether the builder might own the message**.
 *
 * `selector` and `discovery` are both faults (`isFaultPosition`), but the caller
 * treats them differently: a dead selector short-circuits before the AST walk,
 * while a dead discovery glob defers to whatever the builder produced. An
 * `ArchViolation` carries no position, so the split happens here rather than
 * being recovered by inspecting findings downstream.
 */
export function deadSelectorFindings(facts: RuleFacts): {
  selector: ArchViolation[]
  discovery: ArchViolation[]
} {
  // Annotated: inferred, this is `{ selector: never[]; discovery: never[] }`,
  // and it is returned from four early-exit paths. Nothing mutates it today —
  // but a `push` onto a `never[]` is a type error whose message points at the
  // literal rather than at the caller that meant to add a finding.
  const empty: { selector: ArchViolation[]; discovery: ArchViolation[] } = {
    selector: [],
    discovery: [],
  }
  const project = facts.getProject()
  if (project === undefined) return empty
  // A condition that asserts CARDINALITY is satisfied by having no subjects,
  // so an unsatisfiable selector is this rule working rather than failing —
  // the pre-emptive guard `.should().notExist()` expresses. Declared by the
  // condition, never probed: evaluating any condition against `[]` returns no
  // violations, so probing answers "satisfied" for all of them.
  if (facts.assertsCardinality()) return empty
  const trees = facts.globs()
  if (trees.length === 0) return empty

  // The project loaded nothing, so no glob can match and none of them is at
  // fault — [bug 0048](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0048-the-dead-glob-gate-blames-the-glob-when-the-project-is-empty.md).
  //
  // Without this the gate reported every selector glob dead and told the
  // reader to *"Correct the glob, or remove the rule"*, which is a remedy for
  // a fault that is not theirs: measured on an empty tsconfig, the glob was
  // correct and the tsconfig had loaded 0 files. `diagnose()` short-circuited
  // here (bug 0031) and `SliceRuleBuilder` had its own branch; this gate had
  // neither, so the wrong remedy sat on the path every `modules()`,
  // `classes()`, `functions()` and `types()` rule takes.
  //
  // One finding for the project, not one per glob — the identity of this fault
  // is the tsconfig, which is what ADR-008 rule 4 asks be named, and it is why
  // `diagnose()` dedupes by project too.
  if (loadedNothing(project))
    return { selector: [emptyProjectViolation(facts, project)], discovery: [] }

  return deadSitesIn(facts, trees, project)
}

/** The value behind `TerminalBuilder.zeroSubjectsAdvice()`. */
export function zeroSubjectsAdviceOf(facts: RuleFacts): string {
  const project = facts.getProject()
  const loaded = project === undefined ? undefined : project.getSourceFiles().length
  // The project file count is CONTEXT in parentheses, never a denominator: the
  // rule did not examine files, and "0 of 616" reads as a glob problem when the
  // glob may already match everything.
  const context =
    loaded === undefined
      ? ''
      : ` (the project loaded ${String(loaded)} file${loaded === 1 ? '' : 's'})`
  const counted = `This rule examined 0 ${facts.examinedUnitNoun()}${context}`
  // Name the excluder when the family knows it; name the POSSIBILITY when it
  // does not. Deleting the possibility was a measured regression: 0.58's
  // preview said "including any default it applies that you did not write",
  // this plan called that hedging, and the replacement printed numbers that
  // disclose no cause — net information loss on the commonest real case.
  // "removed them" asserts there was something to remove. On a corpus that
  // never contained a single unit of this family's kind, nothing was removed
  // and the true cause is upstream — `narrowingHint()`'s own docstring promises
  // the caller "names the possibility rather than asserting a cause it cannot
  // verify", and asserting removal breaks that promise.
  const hint = facts.narrowingHint()
  const cause =
    hint === undefined
      ? ' Its own narrowing may have removed them — including any default it applies that you did not write.'
      : ` ${hint}`
  return (
    `${counted}, so it enforces nothing as written today.${cause} ` +
    `Either close the gap — widen the selector, or add the code it is waiting for — or declare ` +
    `the empty state with ${facts.emptyDeclarationAdvice()} — a declaration is an assertion, not ` +
    `a silencer: it fails the day something does match.`
  )
}

/** The value behind `TerminalBuilder.zeroSubjectsViolation()`. */
export function zeroSubjectsViolationOf(
  facts: RuleFacts,
  project: ArchProject | undefined,
): ArchViolation {
  // The precedence lives HERE, not only at the call site, because this
  // producer's docstring declares "no empty project" as a precondition and an
  // assumed precondition is one a second caller forgets.
  //
  // Measured: `rule-builder`'s `emptySelectionViolation` called this directly,
  // and `deadSelectorFindings` only catches a rule that DECLARES a glob — so
  // `functions(p).that().haveNameMatching(/x/)` over a zero-file project was
  // told "widen it, or declare the empty state". Both remedies are impossible
  // on that input, and the sentence stated the instrument-level fact and then
  // gave selection-level advice contradicting it.
  if (project !== undefined && loadedNothing(project)) {
    return emptyProjectViolation(facts, project)
  }
  const described = facts.describeRule()
  const name = described.id || described.rule || facts.ruleClass.name
  const advice = `${facts.zeroSubjectsAdvice()} ${UNSUPPRESSABLE} ${DECLARE_INSTEAD}`
  return {
    rule: name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message: advice,
    // Its own remedy, never the author's (bug 0021).
    suggestion: advice,
    bypassFilters: true,
  }
}
