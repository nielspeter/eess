# Migrating to eess-ts 0.6

> Written for the release tagged `v0.6.0`, from `@nielspeter/eess-ts` 0.5.x. **Only eess-ts moves** —
> the kernel and the other dialects keep their versions, so this tag carries eess-ts's number, not the
> kernel's. Check what you have with `npm ls @nielspeter/eess-ts`.

| package                          | from  | to    |
| -------------------------------- | ----- | ----- |
| `@nielspeter/eess-ts`            | 0.5.1 | 0.6.0 |
| `@nielspeter/eess`               | 0.5.1 | 0.5.1 |
| `@nielspeter/eess-md`            | 0.6.1 | 0.6.1 |
| `@nielspeter/eess-mermaid`       | 0.4.1 | 0.4.1 |
| `@nielspeter/eess-gherkin`       | 0.4.0 | 0.4.0 |
| `@nielspeter/eess-crossvalidate` | 0.5.1 | 0.5.1 |

Eleven of this release's changes are breaking, and every one of them is the same kind: **a rule that
passed code it should have failed now fails it.** No export is removed or renamed. The security rules
read more spellings of a global, the class rules read all the code a class runs, `functions()`
collects the members of a class, and the body and call searches stop dropping matches they found. So
the likeliest thing you will see is a build that passed on 0.5 reporting findings on 0.6 with your
source untouched.

That is the upgrade doing its job. **Read the new findings before you regenerate a baseline** —
regenerating accepts all of them, and each is a place a rule you configured was not looking.

This page collects the changes in the order you are likely to meet them. Each links the changelog
entry's bug number; `packages/ts/CHANGELOG.md` has the full text.

## What to do

1. Upgrade `@nielspeter/eess-ts` to 0.6.0. Nothing else in the family needs to move with it: the
   kernel is unchanged, and `eess-crossvalidate`'s optional peer range on eess-ts, `>=0.5.1`, admits
   0.6.0.
2. Run your gates. Most new findings are real; the sections below say where each kind comes from.
3. If a **requirement** over `functions()` now fails on a constructor or an accessor, narrow it
   (section 1 below).
4. If you keep a baseline, read "Baselines" before regenerating it — two rules changed their
   descriptions, so their baselined findings come back.

## Changes you may have to make

### 1. A requirement over `functions()` now judges constructors and accessors

`functions()` collects a class's constructor, getters, setters and function-valued properties (bug
0315), named `Class.constructor`, `Class.get x`, `Class.set x` and `Class.handler`. A **prohibition**
reading them is the point. A **requirement** now judges them too, and some cannot comply: a constructor
cannot `beAsync()`, and an accessor's name holds a space. Narrow the rule with the new kind predicate:

```ts
import { functions } from '@nielspeter/eess-ts'

functions(p).that().areNotOfKind('constructor', 'getter', 'setter').should().beAsync()
```

`areOfKind(...)` and `areNotOfKind(...)` take `'function'`, `'method'`, `'constructor'`, `'getter'`,
`'setter'` or `'property'`, and throw `ArchConfigError` on a string that is not a kind.

Also from this change: `includeMethods: false` now leaves out every class member, not only methods;
`noEmptyBodies` reports an empty accessor, an empty function-valued property and an empty constructor
that does nothing (a constructor whose every parameter is a parameter property, or a non-public one
that takes no parameter, is not reported); and `resolvers()` in `@nielspeter/eess-ts/graphql` leaves
out constructors and accessors.

### 2. Two rule descriptions changed, so their baselined findings come back

A baseline identity includes the rule's description.

- `noMagicNumbers` is now `have no magic numbers in member code` (was `… in method bodies`), because it
  reads constructors, accessors, property initializers and static blocks, not only methods (bug 0306).
- `noFunctionConstructor` is now `Function constructor` (was `new 'Function'`), because it also matches
  `Function(…)` called without `new` (bug 0301).

Every baselined finding of these two rules is reported again. Regenerating the baseline accepts them —
and, for `noMagicNumbers`, the genuinely new findings in positions it did not read before. Review the
new entries before you commit the baseline.

## Builds that can go red on their own

Nothing here needs a code change from you. Each one makes eess report something it previously stayed
silent about.

### The security rules read more spellings of a global

`noEval`, `noFunctionConstructor`, `noConsole`, `noConsoleLog` and `noProcessEnv`, in every variant, and
the `recommended` floor, which uses the first two:

- **More spellings** (bugs 0297, 0301): `globalThis.eval(…)`, `window['eval'](…)`, the indirect
  `(0, eval)(…)`, `Function(…)` without `new`, `console['log'](…)`, `process['env']` and
  `globalThis.process.env` — through `globalThis`, `window`, `self` and `global`.
- **Through a cast** (bug 0308): `as`, `<T>`, `satisfies` and `!`, so `(globalThis as any).process.env`,
  `process!.env` and `(eval as any)('1')`; and through more than one global object,
  `window.self.eval(…)`.

A member of an ordinary object that shares the name, `obj.eval()`, is not reported. The rules read
names, not bindings (bug 0305): a global bound to a local first, `const { env } = process`, is still not
reported, and a local named like a global object is read as the global.

### The class rules read all the code a class runs

- **The class body conditions** — `contain`, `notContain` and `useInsteadOf` on `classes()`, and every
  rule built on them in `rules/security`, `rules/errors`, `rules/typescript` and `classMustCall` — now
  read property initializers (arrow-function properties included), static blocks, every parameter's
  default, and the defaults and computed keys inside a destructured parameter (bugs 0300, 0309).
- **A prohibition reads the class's own definition too** — decorator expressions, computed member
  names and the `extends` expression (bug 0307) — so `@Module({ path: process.env.X })` is now
  reported. A **requirement** does not: a decorator or `extends` does not satisfy `classMustCall`.
- **Five rules that kept their own member list** read more (bug 0306): `noSilentCatch` everywhere a
  class runs code; `noMagicNumbers` in all member code; and `maxCyclomaticComplexity`, `maxMethodLines`
  and `maxParameters` measure a function-valued property, `onClick = () => {…}`, as a method.

`noMagicNumbers` does not report a number that is the whole value of the class's own property or a
parameter default — `private timeout = 5000`, `retry(attempts = 3)` — but does report one in a keyed
table (`static readonly Status = { OK: 200 }`), an array, or a local constant (bug 0317 asks whether
it should).

### `functions()` collects class members and wrapped functions

Beyond section 1: every function rule — `functionNoEval`, `functionNoSilentCatch`, `noStubComments`,
the ceilings `maxFunctionComplexity`, `maxFunctionLines` and `maxFunctionParameters`, the `recommended`
and `agentGuardrails` presets, and the `duplicateBodies` and `inconsistentSiblings` smells — reads a
class's constructor, accessors and function-valued properties, and a function behind parentheses, `as`,
`<T>`, `satisfies` or `!` (bug 0315). Measured on eess, NestJS, TypeORM and PixiJS: no finding reported
before was lost, and the additions were mostly duplicate bodies, generic errors and the ceilings.

### Heritage predicates resolve the base however it is written

`extend()`, `implement()`, `extendType()`, `haveDecorator()` and `haveDecoratorMatching()` match a
direct base written through an aliased import, a namespace member or a mixin call, as well as by name
(bug 0296). As a selector each can pick up classes it skipped; as a condition, `extend()` and
`implement()` stop reporting a base written through an alias. The `dataLayer` preset's base-class rule
uses `extend()`.

### `expression()` stops dropping a match that shares its span

A broad matcher — `expression()`, or any `ExpressionMatcher` naming no syntax kind — used to drop a
match that covered exactly the same text as another node (bug 0322). Newly reported: a call or
assignment written as a statement without a semicolon, a shorthand property, a destructured binding, a
variable declared without a value, a type annotation, and a call's only argument or an array's only
element, with or without a semicolon. The requirements (`contain`, `haveArgumentContaining`, …) stop
failing a body that holds such a match. No shipped rule or preset uses `expression()`, so this reaches
only rules you wrote.

### The call conditions test what they search, not only below it

`haveArgumentContaining`, `notHaveArgumentContaining`, `haveCallbackContaining` and
`notHaveCallbackContaining` now test an argument, and a concise callback's body, itself (bug 0323), with
`call()` as with `expression()`: `use(legacy(1))` and `app.get('/', () => db.query(sql))` are newly
reported. A module's `notContain` under `{ scopeToModule: true }` reads a top-level initializer the
same way. No shipped rule or preset uses these conditions.

## Baselines

Most of these changes number a new finding **after** the ones a baseline already holds, so an accepted
finding keeps its identity and only the new one fails: the class body search (0300, 0307, 0309) and
the new `functions()` members (0315).

Five number a new finding **in place**: the security rules (0297, 0301, 0308), `expression()`
(0322) and the call conditions (0323) — which keep the order within one call, not across the calls of
a declaration. A newly reported match above an accepted one in the same declaration takes its ordinal, so the
accepted finding is reported as new and the new one is hidden until the baseline is reviewed. Read that
declaration's findings before regenerating.

And the two description changes in section 2 bring every baselined `noMagicNumbers` and
`noFunctionConstructor` finding back.

## Still not covered

Known gaps this release does not close, each filed:

- a class that reaches its base through an intermediate class is not matched by `extend()` (bug 0295);
- a global bound to a local name, `const { env } = process`, is not read as the global (bug 0305);
- the function rules read no parameter default (bug 0314);
- a class expression's members, a namespace class's, an object literal's accessors, a static block, and
  a function a variable holds through a call or a conditional are not collected by `functions()` (bug
  0321);
- the callback conditions do not search a callback inside an object literal, `{ handler: () => … }`, or
  behind parentheses — use `haveArgumentContaining` or `within()` for those (bug 0324).

## If something here is wrong

The `ts` fences on this page have their import lines compiled on every CI run, so a specifier that does
not resolve fails the build rather than reaching you. That compiles against this repo's workspace build,
not the tarball npm serves you.

Everything else here is unchecked: the prose and the lists. If a claim does not match what you find,
that is a bug worth filing.
