---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `functions()` collects a class's constructor, accessors and
function-valued properties, and a function behind a wrapper (bug 0315). Beside a class declaration's
methods it collects the constructor with a body, each getter and setter, and each property whose value
is a function, named `Class.constructor`, `Class.get x`, `Class.set x` and `Class.handler`. A variable
or property whose function sits behind parentheses, `as`, `<T>`, `satisfies` or `!` is collected as
that function. No function rule read any of these, so `eval` in a constructor, a getter or an
arrow-function property passed `functionNoEval` and the `recommended` preset. A class expression's
members, a namespace class's, an object literal's accessors, a static block and a function a variable
holds through a call or a conditional are still not collected (bug 0321).

What changes for a rule you already run:

- **A prohibition** — `notContain(...)`, `functionNoEval`, `functionNoSilentCatch`, `noStubComments`
  and the like — reads the new members and reports what it finds there.
- **A requirement** judges the new members too: `beAsync()`, `contain(...)`,
  `acceptParameterOfType(...)`, `haveReturnTypeMatching(...)` (a constructor returns its class, a
  setter `void`), `haveNameMatching(...)` (an accessor's name holds a space, `Class.get x`) and
  `beExported()` (a member is exported when its class is). Where a constructor or an accessor cannot
  comply, narrow the rule: `functions(p).that().areNotOfKind('constructor', 'getter', 'setter')`.
- **The ceilings** `maxFunctionComplexity`, `maxFunctionLines` and `maxFunctionParameters` measure the
  new members.
- **`noEmptyBodies`** reports an empty accessor, an empty function-valued property such as a no-op
  `onChange = () => {}`, and an empty constructor that does nothing. It does not report an empty
  constructor whose every parameter is a parameter property, `constructor(private readonly db: Db) {}`,
  or a `private` or `protected` constructor that takes no parameter.
- **`resolvers()`** in `@nielspeter/eess-ts/graphql` leaves out constructors and accessors.
- The `recommended` and `agentGuardrails` presets and the `duplicateBodies` and `inconsistentSiblings`
  smells are built on the collection and see the new members. `includeMethods: false` leaves out every
  class member, not only methods.

New: `areOfKind(...)` and `areNotOfKind(...)`, as predicates and on the function builder, select by
`FunctionKind`: `'function'`, `'method'`, `'constructor'`, `'getter'`, `'setter'` or `'property'`.
Naming no kind throws `ArchConfigError`.

**Baselines.** Every function collected before keeps its name, so a finding reported before keeps its
identity. A finding in a new member is not in your baseline and fails the check; regenerating the
baseline accepts all of them, so read them first.

**Measured** on eess, NestJS's packages and its sample and integration apps, TypeORM and PixiJS, with
the presets' collection options, for the rules named here and duplicate bodies. No finding reported
before was lost, compared by file, element and message. Added across the five: duplicate bodies at 0.9
similarity 21, `functionNoGenericErrors` 19, `maxFunctionParameters(4)` 18, `maxFunctionLines(50)` 10,
`noStubComments` 9, `maxFunctionComplexity(10)` 6, `noEmptyBodies` 2, `functionNoSilentCatch` 1,
`functionNoEval` and `functionNoFunctionConstructor` 0. Without the `noEmptyBodies` exemption a
prototype reported 199 more, every one a dependency-injection constructor. `resolvers()`,
`inconsistentSiblings` and the requirement conditions were not measured.
