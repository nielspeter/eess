import { finishPreset, type ArchViolation, type PresetReportOptions } from '@nielspeter/eess'
import { calls, type ArchProject } from '@nielspeter/eess-ts'
import type { FeatureSet, GherkinScenario } from '@nielspeter/eess-gherkin'
import path from 'node:path'
import { itOrTestTitleOf } from './it-title.js'

/**
 * Custom citation extractor — receives one `it('…')` title and returns the
 * scenario it cites, or `undefined` if the title is not a citation. Shared by
 * every gherkin-ts export that reads citations (plan 0145; previously three
 * copies of the same inline signature).
 */
export type TestCitationExtractor = (itTitle: string) => ExtractedTestCitation | undefined

export interface ScenarioTestsResolveOptions extends PresetReportOptions {
  /**
   * Custom citation extractor for transition periods. Default: the frozen
   * convention adapted to a single string — `` it('<path>.feature › <Scenario
   * title>') `` (plan 0080).
   */
  readonly extract?: TestCitationExtractor
}

export interface ScenariosCoveredOptions extends PresetReportOptions {
  /** Custom citation extractor — same contract as {@link ScenarioTestsResolveOptions.extract}. */
  readonly extract?: TestCitationExtractor
  /**
   * Require coverage only for scenarios matching this predicate — the opt-in
   * scope. Default: every scenario. Use it to exclude un-implemented flows,
   * e.g. `(s) => !s.tags.includes('wip')`.
   */
  readonly include?: (scenario: GherkinScenario) => boolean
}

export interface ExtractedTestCitation {
  /** The cited feature path, as written (may be a unique suffix). */
  readonly path: string
  /** The cited scenario title. */
  readonly title: string
}

/** Where one `it('…')` citation lives — exported (plan 0145) so a consumer
 * can report a citation's own location, not just that one exists. */
export interface TestCitationSite {
  readonly title: string
  readonly file: string
  readonly line: number
}

// The gherkin↔ts citation convention (plan 0080): a test names the scenario it
// proves in its `it()` title — a feature path (unique `/`-boundary suffix, like
// md↔gherkin) then the scenario title, separated by `›` or `·`.
const IT_CITE_RE = /^(?<path>.*\.feature)\s*[›·]\s*(?<title>.+)$/
const RULE = 'tests that cite a scenario should cite one that exists'

/** The default `it()`-title convention: `<path>.feature › <title>`. */
function defaultExtract(itTitle: string): ExtractedTestCitation | undefined {
  const m = IT_CITE_RE.exec(itTitle)
  const path = m?.groups?.path
  const title = m?.groups?.title
  if (path === undefined || title === undefined) return undefined
  return { path, title }
}

/**
 * Read every `it('…')` title from the project via eess-ts's public call API —
 * no ts-morph here, per ADR-007, exactly as `adrCitationsResolve` does. Sees
 * `` it(`no-substitution template`) `` titles a source regex would miss. The
 * title grammar itself lives in `it-title.ts`, shared with md↔ts (bug 0104).
 */
function itTitles(project: ArchProject): TestCitationSite[] {
  const allCalls = calls(project).select({
    label: 'call',
    identify: (c) => ({ name: c.getName() ?? '' }),
  }).elements
  const out: TestCitationSite[] = []
  for (const call of allCalls) {
    // Accept `it(...)` / `test(...)` and their modifier forms (`it.only`,
    // `it.skip`, `test.concurrent`, …) — the root callee is what matters, not
    // the modifier. The gate binds a citation, it does not run the test, so a
    // skipped test's citation is still checked (consistent with "cites, not
    // exercises"). `it.each(table)(...)` is a call-of-a-call with a templated
    // `%s` title — no static citation — so `root` is undefined and it is skipped.
    const root = call.getObjectName() ?? call.getMethodName()
    if (root !== 'it' && root !== 'test') continue
    const title = itOrTestTitleOf(call.getName({ withArgument: 0 }) ?? '')
    if (title === undefined) continue
    out.push({ title, file: call.getSourceFile().getFilePath(), line: call.getStartLineNumber() })
  }
  return out
}

/** Resolve a cited path against the set: exact relPath, or unique `/`-boundary suffix. */
function resolveFeature(path: string, set: FeatureSet): readonly string[] {
  const all = set.features().map((f) => f.relPath)
  if (all.includes(path)) return [path]
  return all.filter((rel) => rel.endsWith(`/${path}`))
}

const v = (site: TestCitationSite, message: string, because: string): ArchViolation => ({
  rule: RULE,
  ruleId: 'crossval/scenario-tests-resolve',
  element: `${site.file}:${site.line}`,
  file: site.file,
  line: site.line,
  message,
  because,
})

/**
 * Cross-validate that every scenario citation in the *test* AST resolves against
 * the loaded feature set — the mirror image of `scenarioCitationsResolve`, whose
 * left side is the markdown corpus; here it is the project's `it('…')` titles.
 * This is the code↔spec half plan 0069 deferred ("this one is spec↔spec only").
 *
 * A citation is an `it()` whose title matches the convention `<path>.feature ›
 * <Scenario title>` (overridable via `extract`). Three failure modes are gated:
 * the cited feature file doesn't exist in the set, the path is ambiguous
 * (matches several files), or the cited scenario title doesn't exist in that
 * file. A test whose title is not a citation is ignored.
 *
 * Resolves a citation; it does NOT claim the test exercises the scenario's
 * steps — that is Tier 2, still open (plan 0079).
 */
export function scenarioTestsResolve(
  project: ArchProject,
  set: FeatureSet,
  options: ScenarioTestsResolveOptions = {},
): ArchViolation[] {
  const extract = options.extract ?? defaultExtract
  const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath} ${s.title}`))
  const violations: ArchViolation[] = []

  for (const site of itTitles(project)) {
    const cite = extract(site.title)
    if (cite === undefined) continue // not a scenario-citing test
    const resolved = resolveFeature(cite.path, set)
    if (resolved.length === 0) {
      violations.push(
        v(
          site,
          `cites \`${cite.path}\` — no such feature file in the set`,
          'a test citing a missing behavior spec is a dangling reference',
        ),
      )
      continue
    }
    if (resolved.length > 1) {
      violations.push(
        v(
          site,
          `cites \`${cite.path}\` — ambiguous, matches ${resolved.length} feature files (${resolved.join(', ')})`,
          'an ambiguous citation cannot be mechanically resolved; cite a longer suffix',
        ),
      )
      continue
    }
    const rel = resolved[0]
    if (rel !== undefined && !scenarioKeys.has(`${rel} ${cite.title}`)) {
      violations.push(
        v(
          site,
          `cites '${cite.title}' in \`${rel}\` — no such scenario in that feature file`,
          'a renamed or deleted scenario must not silently orphan the test that proves it',
        ),
      )
    }
  }

  return finishPreset(violations, options)
}

const COVER_RULE = 'every scenario should be proven by a citing test'

const sv = (scenario: GherkinScenario, message: string, because: string): ArchViolation => ({
  rule: COVER_RULE,
  ruleId: 'crossval/scenarios-covered',
  element: `${scenario.relPath} › ${scenario.title}`,
  file: scenario.file,
  line: scenario.line,
  message,
  because,
})

/**
 * Every test citation, keyed by the scenario it cites (`relPath title`) —
 * exported (plan 0145) so a consumer can report where a citation lives, not
 * just that one exists. Ambiguous citations (matching more than one feature
 * file) are excluded, same as the prior `citedScenarioKeys`'s behavior. If
 * two tests cite the same scenario, the map keeps one of them (which one is
 * unspecified) — enough to point an author at *a* citing test, which is all
 * any consumer here needs.
 */
export function citedScenarioSites(
  project: ArchProject,
  set: FeatureSet,
  extract: TestCitationExtractor,
): Map<string, TestCitationSite> {
  const sites = new Map<string, TestCitationSite>()
  for (const site of itTitles(project)) {
    const cite = extract(site.title)
    if (cite === undefined) continue
    const resolved = resolveFeature(cite.path, set)
    const rel = resolved.length === 1 ? resolved[0] : undefined
    if (rel !== undefined) sites.set(`${rel} ${cite.title}`, site)
  }
  return sites
}

/** The set of `relPath title` keys a test unambiguously cites in the project. */
function citedScenarioKeys(
  project: ArchProject,
  set: FeatureSet,
  extract: TestCitationExtractor,
): Set<string> {
  return new Set(citedScenarioSites(project, set, extract).keys())
}

/**
 * Cross-validate that every in-scope scenario is cited by at least one test —
 * the coverage (right→left) direction, the complement of `scenarioTestsResolve`.
 * A scenario shipped with no citing test fails; `include` narrows the scope so
 * `@wip` / un-implemented flows do not force a red build.
 *
 * Assumes scenario titles are unique within a file — coverage keys on
 * `relPath + title`, so two identically-titled scenarios share one key and
 * citing one marks its twin covered. Pair with eess-gherkin's `haveUniqueTitles`
 * to close that gap.
 *
 * Coverage means "a test cites this scenario", not "a test exercises its steps"
 * (Tier 2, still open — plan 0079).
 */
export function scenariosCovered(
  project: ArchProject,
  set: FeatureSet,
  options: ScenariosCoveredOptions = {},
): ArchViolation[] {
  const extract = options.extract ?? defaultExtract
  const include = options.include ?? (() => true)
  const covered = citedScenarioKeys(project, set, extract)
  const violations = set
    .scenarios()
    .filter(include)
    .filter((s) => !covered.has(`${s.relPath} ${s.title}`))
    .map((s) =>
      sv(
        s,
        'no test cites this scenario',
        'an unproven use-case flow is a spec with no gate behind it',
      ),
    )
  return finishPreset(violations, options)
}

export interface ScenarioExemptionsCurrentOptions extends PresetReportOptions {
  /**
   * Which scenarios are currently exempt from the coverage requirement.
   * Required — no default, unlike `scenariosCovered`'s `include`: the two
   * options must never be able to silently disagree about the same tag.
   * Found in proposal 005's third review round — if both defaulted to
   * `@wip`, a `@wip` scenario would be simultaneously required to be cited
   * (`scenariosCovered`, default `include`) and required to be uncited
   * (this export, a hypothetical default `isExempt`), unconditionally.
   * There is no default under which the pair is not self-contradictory, so
   * there is no default at all — the caller states the tag explicitly,
   * e.g. `(s) => s.tags.includes('wip')`, paired with the matching
   * `scenariosCovered({ include: (s) => !s.tags.includes('wip') })`.
   */
  readonly isExempt: (scenario: GherkinScenario) => boolean
  /** Custom citation extractor — same contract as the siblings' `extract`. */
  readonly extract?: TestCitationExtractor
}

const EXEMPTION_RULE = 'an exempt scenario should have its exemption removed once a test cites it'

/**
 * Cross-validate that no scenario currently exempted (via `isExempt`) already
 * has a real citing test — the complement of `scenariosCovered`: that gate
 * proves a non-exempt scenario IS cited; this one proves an exempt scenario
 * is NOT YET cited. An exemption that outlives its reason is a silent hole
 * in the coverage gate it was meant to narrow (proposal 005).
 *
 * A citation from a `.skip`-modified test still counts as "cites it," same
 * as `scenariosCovered`'s own treatment (`itTitles` binds a citation; it
 * does not require the test to run) — consistency across the three
 * gherkin-ts gates is worth more than a bespoke carve-out here. A caller
 * who wants a skipped-placeholder citation to NOT trigger staleness narrows
 * `isExempt` to exclude it (or tags it `@wip @tracked` and narrows on that).
 */
export function scenarioExemptionsCurrent(
  project: ArchProject,
  set: FeatureSet,
  options: ScenarioExemptionsCurrentOptions,
): ArchViolation[] {
  const extract = options.extract ?? defaultExtract
  const sites = citedScenarioSites(project, set, extract)
  const violations = set
    .scenarios()
    .filter((s) => options.isExempt(s))
    .flatMap((s) => {
      const site = sites.get(`${s.relPath} ${s.title}`)
      if (site === undefined) return []
      const citedAt = `${path.relative(process.cwd(), site.file)}:${String(site.line)}`
      return [
        {
          rule: EXEMPTION_RULE,
          ruleId: 'crossval/scenario-exemption-stale',
          element: `${s.relPath} › ${s.title}`,
          file: s.file,
          line: s.line,
          message: `scenario "${s.title}" is exempt but ${citedAt} already cites it`,
          because:
            'an exemption that has outlived its reason is a silent hole in the coverage gate',
          suggestion:
            'if the scenario is genuinely done, remove the exempting tag; if the exemption is ' +
            'still intentional (flaky, partial, tracked elsewhere), narrow isExempt to exclude it',
        },
      ]
    })
  return finishPreset(violations, options)
}

/** Count citing tests / scenarios for a caller's non-vacuity summary line. */
export function scenarioTestStats(
  project: ArchProject,
  set: FeatureSet,
  options: ScenarioTestsResolveOptions = {},
): { citations: number; scenarios: number } {
  const extract = options.extract ?? defaultExtract
  return {
    citations: itTitles(project).filter((s) => extract(s.title) !== undefined).length,
    scenarios: set.scenarios().length,
  }
}

// Referenced by tests to keep the default convention itself under test.
export { defaultExtract }
