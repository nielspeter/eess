import {
  RuleBuilder,
  type ArchViolation,
  type Condition,
  type ConditionContext,
  type Predicate,
} from '@nielspeter/eess'
import { uniqueByCondition } from '@nielspeter/eess/internal'
import picomatch from 'picomatch'
import type { FeatureSet } from './load.js'
import type { GherkinScenario } from './model.js'

const haveTag = (tag: string): Predicate<GherkinScenario> => ({
  description: `have tag @${tag}`,
  test: (s) => s.tags.includes(tag),
})

const resideInFeatureFile = (glob: string): Predicate<GherkinScenario> => {
  const matches = picomatch(glob)
  return {
    description: `reside in feature file '${glob}'`,
    test: (s) => matches(s.relPath),
  }
}

/** gherkin's one finding constructor: a scenario, named by its file, line and title. */
const scenarioViolation = (
  s: GherkinScenario,
  message: string,
  ctx: ConditionContext,
): ArchViolation => ({
  rule: ctx.rule,
  ...(ctx.ruleId !== undefined && { ruleId: ctx.ruleId }),
  element: `${s.relPath}:${String(s.line)} › ${s.title}`,
  file: s.file,
  line: s.line,
  message,
  ...(ctx.because !== undefined && { because: ctx.because }),
  ...(ctx.suggestion !== undefined && { suggestion: ctx.suggestion }),
  ...(ctx.docs !== undefined && { docs: ctx.docs }),
})

// Duplicate titles within one feature file make a `file · 'title'` citation
// ambiguous — the same reason `check:crossval` demands unique it() titles. The
// kernel's condition (plan 0459) reports every member of a group, each naming
// the others; the key is per file.
const haveUniqueTitles = (): Condition<GherkinScenario> =>
  uniqueByCondition<GherkinScenario>({
    key: (s) => `${s.relPath}\0${s.title}`,
    locate: (s) => ({ name: `${s.relPath} › ${s.title}`, at: `${s.relPath}:${String(s.line)}` }),
    what: 'title',
    why: 'titles must be unique within a feature file, or a citation of one is ambiguous',
    toViolation: scenarioViolation,
  })

/** Rule builder over a feature set's scenarios. */
export class ScenarioRuleBuilder extends RuleBuilder<GherkinScenario, FeatureSet> {
  protected getElements(): GherkinScenario[] {
    return this.project.scenarios()
  }

  /** Filter to scenarios carrying the tag (without `@`). */
  haveTag(tag: string): this {
    return this.addPredicate(haveTag(tag))
  }

  /** Filter to scenarios whose feature file path matches the glob. */
  resideInFeatureFile(glob: string): this {
    return this.addPredicate(resideInFeatureFile(glob))
  }

  /** Assert titles are unique within each feature file (citation-resolvable). */
  haveUniqueTitles(): this {
    return this.addCondition(haveUniqueTitles())
  }
}

/** Entry point: build rules over the set's scenarios. */
export function scenarios(set: FeatureSet): ScenarioRuleBuilder {
  return new ScenarioRuleBuilder(set)
}
