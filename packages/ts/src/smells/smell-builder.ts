import type { ArchProject } from '../core/project.js'
import type { ArchViolation } from '../core/violation.js'
import { TerminalBuilder, type CollectResult } from '@nielspeter/eess'

/**
 * Base class for smell detector builders.
 * Extends TerminalBuilder for shared terminal methods (check/warn/excluding/because/rule).
 *
 * SmellBuilder does NOT extend RuleBuilder — smell detectors have a
 * different chain grammar (no .that()/.should()) and execution model
 * (pairwise comparison rather than individual element evaluation).
 */
export abstract class SmellBuilder extends TerminalBuilder {
  protected _folders: string[] = []
  protected _minLines = 5
  protected _ignoreTests = false
  protected _ignorePaths: string[] = []
  protected _groupByFolder = false

  constructor(protected readonly project: ArchProject) {
    super()
  }

  /**
   * Independent copy of `_folders`/`_ignorePaths` — see
   * `SliceRuleBuilder.copy()` for why this override is required: without it,
   * two branches derived from the same held selection via the inherited
   * `.because()`/`.excluding()`/`.rule()`/`.expectEmpty()` would share one
   * mutable array by reference. Subclasses (`DuplicateBodiesBuilder`,
   * `InconsistentSiblingsBuilder`) add only primitives or wholesale-reassigned
   * fields, so they inherit this override rather than needing their own.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._folders = [...this._folders]
    clone._ignorePaths = [...this._ignorePaths]
    return clone
  }

  /** Scope detection to files matching the glob pattern. */
  inFolder(glob: string): this {
    this._folders.push(glob)
    return this
  }

  /** Ignore functions/files shorter than N lines. Default: 5. */
  minLines(n: number): this {
    this._minLines = n
    return this
  }

  /** Exclude test files (*.test.ts, *.spec.ts, __tests__/**). */
  ignoreTests(): this {
    this._ignoreTests = true
    return this
  }

  /** Exclude files matching the given glob patterns. */
  ignorePaths(...globs: string[]): this {
    this._ignorePaths.push(...globs)
    return this
  }

  /** Group violation output by directory. */
  groupByFolder(): this {
    this._groupByFolder = true
    return this
  }

  /**
   * Delegate to detect() for the terminal builder pipeline.
   *
   * `sourceEmpty` — ADR-010 part 3: the project itself loaded zero source
   * files, before any folder scope or minLines filter ran. Distinct from an
   * ordinary dead selector (e.g. `inFolder()` scoping to nothing in a
   * non-empty project), which `.expectEmpty()` can legitimately declare.
   */
  protected collectViolations(): CollectResult {
    return {
      violations: this.detect(),
      examined: this.examinedCount(),
      sourceEmpty: this.project.getSourceFiles().length === 0,
    }
  }

  /** Subclasses implement: run detection, return violations. */
  protected abstract detect(): ArchViolation[]

  /**
   * ADR-010: units this detector actually compared (bodies entering pairwise
   * comparison after `minLines` filtering, files grouped for the sibling
   * check — each detector names its own). Called after `detect()` in
   * `collectViolations()`, so implementations may cache their filtered set
   * during `detect()` rather than recomputing it here.
   */
  protected abstract examinedCount(): number

  /** Subclasses implement: human-readable rule description. */
  protected abstract describe(): string
}
