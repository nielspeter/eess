# Metrics

Built-in metric rules for complexity, size, and method count thresholds. These rules catch the slow creep of large classes, long functions, and tangled control flow before they become entrenched. Use them as guardrails in CI -- they are cheaper than code review for objective limits.

```typescript
import {
  maxCyclomaticComplexity,
  maxClassLines,
  maxMethods,
} from '@nielspeter/eess-ts/rules/metrics'

classes(p).should().satisfy(maxCyclomaticComplexity(15)).check()
classes(p).should().satisfy(maxClassLines(300)).warn()
classes(p).should().satisfy(maxMethods(15)).warn()
```

## Class-Level Rules

Class-level metric rules enforce upper bounds on complexity, size, and member counts for class declarations. They prevent individual classes from growing into "god objects" that are hard to test and reason about.

| Rule                         | What it checks                                           |
| ---------------------------- | -------------------------------------------------------- |
| `maxCyclomaticComplexity(n)` | No method/constructor/getter/setter exceeds complexity N |
| `maxClassLines(n)`           | Class has no more than N code lines                      |
| `maxMethodLines(n)`          | No method/constructor/getter/setter exceeds N code lines |
| `maxMethods(n)`              | Class has no more than N methods                         |
| `maxParameters(n)`           | No method/constructor has more than N parameters         |

```typescript
import {
  maxCyclomaticComplexity,
  maxClassLines,
  maxMethodLines,
  maxMethods,
  maxParameters,
} from '@nielspeter/eess-ts/rules/metrics'

// Hard rule: no method may exceed complexity 15
classes(p).should().satisfy(maxCyclomaticComplexity(15)).check()

// Advisory: flag large classes
classes(p).should().satisfy(maxClassLines(300)).warn()

// Scoped: only services must have short methods
classes(p)
  .that()
  .haveNameEndingWith('Service')
  .should()
  .satisfy(maxMethodLines(50))
  .because('service methods should be focused')
  .warn()

// Enforce small parameter lists
classes(p)
  .should()
  .satisfy(maxParameters(4))
  .because('use an options object for >4 parameters')
  .check()
```

## Function-Level Rules

Function-level rules apply the same kind of guardrails to standalone functions and arrow functions. Use these in codebases that are primarily functional or when you want to enforce limits on functions outside of classes.

| Rule                       | What it checks                         |
| -------------------------- | -------------------------------------- |
| `maxFunctionComplexity(n)` | Function complexity does not exceed N  |
| `maxFunctionLines(n)`      | Function has no more than N code lines |
| `maxFunctionParameters(n)` | Function has no more than N parameters |

```typescript
import {
  maxFunctionComplexity,
  maxFunctionLines,
  maxFunctionParameters,
} from '@nielspeter/eess-ts/rules/metrics'

functions(p).that().resideInFolder('src/**').should().satisfy(maxFunctionComplexity(15)).check()

functions(p).should().satisfy(maxFunctionLines(40)).warn()

functions(p).that().areExported().should().satisfy(maxFunctionParameters(4)).check()
```

## Metric Predicates

Metric predicates let you use thresholds as filters in the `.that()` phase rather than as conditions. This is useful when you want to combine a metric filter with a structural assertion -- for example, "complex classes must be exported" or "classes with many methods should not exist."

For composition with other rules, metric predicates filter elements by threshold in `.that().satisfy()`:

```typescript
import { haveCyclomaticComplexity, haveMoreMethodsThan } from '@nielspeter/eess-ts'

// "Complex service classes must be exported"
classes(p)
  .that()
  .satisfy(haveCyclomaticComplexity({ greaterThan: 10 }))
  .should()
  .beExported()
  .check()

// "Classes with >10 methods must not exist"
classes(p)
  .that()
  .satisfy(haveMoreMethodsThan(10))
  .should()
  .notExist()
  .because('split large classes into focused services')
  .check()
```

Available predicates:

| Predicate                                      | Entry Point    | Description                            |
| ---------------------------------------------- | -------------- | -------------------------------------- |
| `haveCyclomaticComplexity({ greaterThan: n })` | `classes(p)`   | Class has a method with complexity > n |
| `haveMoreLinesThan(n)`                         | `classes(p)`   | Class has more than n code lines       |
| `haveMoreMethodsThan(n)`                       | `classes(p)`   | Class has more than n methods          |
| `haveComplexity({ greaterThan: n })`           | `functions(p)` | Function has complexity > n            |
| `haveMoreFunctionLinesThan(n)`                 | `functions(p)` | Function has more than n code lines    |

## How Lines Are Counted

eess-ts counts **code lines** — the distinct lines within the element that carry at least one token. Comments (including JSDoc) and blank lines are not counted. A line holding only `}` is: this is a physical-source-lines count, not a statement count.

Comments are excluded structurally rather than by matching comment syntax in text — they are trivia, so they are never tokens.

> **Changed in 0.4.** This used to count **span lines** (`end - start + 1`), which counted comments and blank lines. That made a well-documented element read as a large one, and it collided head-on with a JSDoc-coverage rule: requiring a doc block on every public method drove the same class over its line budget. If you tuned a threshold against the old behaviour, expect the new numbers to be substantially lower — on eess's own source, seven of nine oversized classes turned out to be over on documentation alone.

## Custom Metric Rules

The raw `cyclomaticComplexity()` calculator is exported for use in custom rules:

```typescript
import { cyclomaticComplexity, defineCondition, createViolation } from '@nielspeter/eess-ts'

const maxComplexityWithContext = defineCondition('have reasonable complexity', (elements, ctx) => {
  // Custom logic using cyclomaticComplexity()
})
```

## Common Thresholds

| Metric                | Typical threshold | SonarQube default | Notes                                                        |
| --------------------- | ----------------- | ----------------- | ------------------------------------------------------------ |
| Cyclomatic complexity | 10-20             | 15 (cognitive\*)  | \*SonarQube defaults to cognitive complexity, not cyclomatic |
| Class lines           | 300-500           | 500               |                                                              |
| Method/function lines | 30-60             | 60                |                                                              |
| Method count          | 10-20             | 20                |                                                              |
| Parameters            | 3-5               | 7                 |                                                              |
