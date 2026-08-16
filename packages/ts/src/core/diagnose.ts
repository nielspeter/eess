import type { RuleBuilderLike } from '../cli/load-rules.js'
import type { ArchProject } from './project.js'
import type { GlobNode, GlobPosition, OnDisk } from '@nielspeter/eess'
import { isFaultPosition } from '@nielspeter/eess'
import type { GlobFault } from './glob-diagnosis.js'
import { diagnoseGlob, syntacticFault, FAULT_ADVICE, ON_DISK_ADVICE } from './glob-diagnosis.js'
import { globSitesOf, isDeadSite, isDeadGlobTree } from './glob-evaluator.js'
import { pathUniverse } from './path-universe.js'
import { diskSet } from './disk-set.js'
import { loadedNothing, emptyProjectAdvice } from './empty-project-advice.js'

/**
 * Anything `diagnose()` can inspect: a rule that can describe its globs.
 *
 * Structural rather than a class, so a caller can pass the same
 * `RuleBuilderLike[]` array the CLI's `check`/`baseline` commands already
 * load without any of it being coupled to a class. Every hook is optional —
 * a builder that predates `RuleBuilder<T,P>.globs()`/`.getProject()` (or
 * doesn't route through it, like `SliceRuleBuilder`/`PairFinalBuilder`)
 * simply contributes nothing, silently, rather than throwing.
 *
 * Narrower than ts-archunit's own `DiagnosableRule`, deliberately: that
 * interface has grown, through several ts-archunit-specific plans this repo
 * doesn't carry (deferred/accepted warnings, a structural "inert rule"
 * adequacy predicate, declared-emptiness), to seven finding kinds. eess has
 * the machinery for two of them today — `dead-glob` and `project-empty` —
 * so that's what this ports. See `diagnose()`'s own docstring for exactly
 * which kinds and why the rest are out of scope for now.
 */
export interface DiagnosableRule extends RuleBuilderLike {
  globs?: () => readonly GlobNode[]
  describeRule?: () => { rule: string; id?: string }
  getProject?: () => ArchProject | undefined
}

/** One thing wrong with one rule, named specifically enough to fix. */
export interface DiagnosticFinding {
  /**
   * `'dead-glob'` — a glob that can never match. `'project-empty'` — the
   * project loaded no files, so nothing can match and the globs are not the
   * fault (the same distinction ts-archunit's own bug 0031 exists for:
   * diagnosing individual globs against an empty project reports six false
   * causes for one real one).
   */
  readonly kind: 'dead-glob' | 'project-empty'
  /** The rule's id if it has one, else its assembled description. */
  readonly rule: string
  /** Where the glob was written: `resideInFolder("**\/src/x/**")`. */
  readonly origin?: string
  readonly glob?: string
  readonly position?: GlobPosition
  readonly fault?: GlobFault
  readonly onDisk?: OnDisk
  /** The sanctioned fix, or an honest list of causes where none is verifiable. */
  readonly advice: string
  /**
   * The rule file this rule was written in, when the caller knows it.
   *
   * `diagnose()` never sets this — it is handed rules, not files. `doctor`
   * sets it, since its loop over rule files is the only place the mapping
   * exists.
   */
  readonly ruleFile?: string
}

/**
 * Report which of each rule's declared globs can never match, and whether
 * the project itself loaded nothing — without evaluating any condition.
 *
 * Independent of whether `.check()`/`.warn()` fails: a rule that currently
 * PASSES can still declare a glob that can never match (an `or(dead, live)`
 * selector, or a glob that's dead today but was live when the rule was
 * written), and this is the only way to see it before it silently degrades
 * to always-empty.
 *
 * **Scope, honestly stated.** ts-archunit's own `diagnose()` (613 lines) has
 * grown to seven finding kinds across several of its own plans this repo
 * doesn't carry: deferred/accepted-warning previews, a structural
 * `inertAdvice()` adequacy predicate, declared-emptiness bookkeeping, and
 * orphaned exclusion comments. This ports the two kinds eess's kernel
 * actually has the machinery for today — `dead-glob` (Phase 4 Batches 1–2's
 * whole point) and `project-empty` (`empty-project-advice.ts`, ported
 * Batch 1, unconsumed until now). The other five need features eess doesn't
 * have yet (`.asSeverity('warn', { accepted })`, a per-family adequacy hook,
 * `.expectEmpty()`'s own declared-state bookkeeping surfaced structurally) —
 * naming them here rather than silently answering a narrower question with
 * ts-archunit's wider promise.
 *
 * Reports **identities, never totals**: which glob, in which rule, at which
 * position. A count is a snapshot; callers who want one can take `.length`.
 */
export function diagnose(
  rules: readonly DiagnosableRule[],
  project?: ArchProject,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = []
  /**
   * Projects already reported empty, by OBJECT not by path — object
   * identity is what `pathUniverse`/`diskSet` already key their own caches
   * on, and a path is not a safe identity (two loaders can point at one
   * tsconfig).
   */
  const emptyProjects = new WeakSet<ArchProject>()

  for (const rule of rules) {
    const name = ruleName(rule)
    // The rule's own project wins over the parameter — a rule file with two
    // `project()` calls must not have half its globs checked against the
    // wrong universe. The parameter is a fallback for a rule that cannot
    // name one at all (no `getProject()`, or it returns `undefined`).
    const target = rule.getProject?.() ?? project
    const trees = rule.globs?.() ?? []
    if (trees.length === 0) continue

    if (target === undefined) {
      // Still report syntactic faults — a glob can be malformed independent
      // of any project ('./src/**' is dead everywhere), and withholding it
      // sends the reader on a round trip for a fault already decided.
      findings.push(...syntacticFindings(name, trees))
      continue
    }

    if (loadedNothing(target)) {
      if (!emptyProjects.has(target)) {
        emptyProjects.add(target)
        findings.push({ kind: 'project-empty', rule: name, advice: emptyProjectAdvice(target) })
      }
      findings.push(...syntacticFindings(name, trees))
      // Skip the rest of the glob walk — every one would carry a cause
      // (this specific glob is wrong) that's false; the real cause already
      // has its own finding above.
      continue
    }

    const universe = pathUniverse(target)
    for (const tree of trees) {
      // Only diagnose sites inside a tree that is actually dead. A live
      // tree may still contain a dead site (`or(dead, live)` is a working
      // rule), and reporting the dead one there is the false red the tree
      // exists to prevent.
      if (!isDeadGlobTree(tree, universe)) continue
      for (const site of globSitesOf(tree)) {
        // An exclusion matching zero is remedy-optional and never a fault; a
        // positive condition glob is indistinguishable from an armed
        // tripwire that hasn't fired.
        if (!isFaultPosition(site.position)) continue
        if (!isDeadSite(site, universe)) continue
        findings.push(describeDeadSite(site, name, universe, target))
      }
    }
  }
  return findings
}

/**
 * The faults that need no project at all. `syntacticFault` takes
 * `(glob, kind, base)` — no universe, no project — so it applies whether or
 * not the caller could name a project. `'./src/**'` is dead in every
 * possible project; loading the tsconfig won't fix it.
 */
function syntacticFindings(rule: string, trees: readonly GlobNode[]): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = []
  for (const tree of trees) {
    for (const site of globSitesOf(tree)) {
      if (!isFaultPosition(site.position)) continue
      const fault = syntacticFault(site.glob, site.kind, site.base)
      if (fault === undefined) continue
      findings.push({
        kind: 'dead-glob',
        rule,
        origin: site.origin,
        glob: site.glob,
        position: site.position,
        fault,
        advice: FAULT_ADVICE[fault],
      })
    }
  }
  return findings
}

function describeDeadSite(
  site: ReturnType<typeof globSitesOf>[number],
  rule: string,
  universe: ReturnType<typeof pathUniverse>,
  project: ArchProject,
): DiagnosticFinding {
  // The disk set is reached only from here, so a project with no dead globs
  // never walks the filesystem.
  const diagnosis = diagnoseGlob(site, universe, diskSet(project))
  const onDiskAdvice = diagnosis.onDisk !== undefined ? ON_DISK_ADVICE[diagnosis.onDisk] : ''
  return {
    kind: 'dead-glob',
    rule,
    origin: site.origin,
    glob: site.glob,
    position: site.position,
    fault: diagnosis.fault,
    onDisk: diagnosis.onDisk,
    advice: onDiskAdvice === '' ? FAULT_ADVICE[diagnosis.fault] : onDiskAdvice,
  }
}

function ruleName(rule: DiagnosableRule): string {
  const described = rule.describeRule?.()
  // `||`, not `??`: `describeRule()` returns `rule: ''` for a bare entry
  // point with no predicates/conditions, and `''` is not nullish.
  return described?.id || described?.rule || 'unnamed rule'
}
