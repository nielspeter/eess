/**
 * The Gherkin dialect's element model — features and scenarios as first-class
 * elements (plan 0069 Phase 1).
 *
 * Deliberately a *line-grammar* reading, not a full Cucumber AST: eess needs
 * the parts a spec corpus cites (feature title, scenario titles, their
 * locations, tags) — steps and tables stay opaque text. A full parser would be
 * mechanism the clause doesn't need.
 */

/** A single scenario (or scenario outline / example) in a feature file. */
export interface GherkinScenario {
  /** Scenario title — the text after the keyword's colon, trimmed. */
  readonly title: string
  /** The keyword that introduced it. */
  readonly keyword: 'Scenario' | 'Scenario Outline' | 'Example'
  /** Title of the containing feature ('' if the file declares none). */
  readonly feature: string
  /** Absolute file path. */
  readonly file: string
  /** Root-relative POSIX path — the form citations use. */
  readonly relPath: string
  /** 1-indexed line of the scenario keyword. */
  readonly line: number
  /** Tags immediately preceding the scenario (e.g. `@wip`), without `@`. */
  readonly tags: readonly string[]
}

/** A parsed `.feature` file. */
export interface GherkinFeature {
  /** Feature title — '' when the file declares no `Feature:` line. */
  readonly title: string
  /** Absolute file path. */
  readonly file: string
  /** Root-relative POSIX path. */
  readonly relPath: string
  /** 1-indexed line of the `Feature:` keyword (0 when absent). */
  readonly line: number
  /** Tags immediately preceding the feature, without `@`. */
  readonly tags: readonly string[]
  /** The file's scenarios, in source order. */
  readonly scenarios: readonly GherkinScenario[]
}
