---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `functions()` collects every named function (bug 0315). A class's
constructor, its accessors and its properties whose value is a function are collected beside its
methods, named `Class.constructor`, `Class.get x`, `Class.set x` and `Class.handler`. A variable or
property whose function sits behind parentheses, `as`, `<T>`, `satisfies` or `!` is collected too.
None of these was read by any function rule, so `eval` in a constructor, a getter or an
arrow-function property passed `functionNoEval` and the `recommended` preset.

Affected, because they are built on the collection:

- every rule written with `functions(p)`;
- the `recommended` and `agentGuardrails` presets;
- `resolvers()` in `@nielspeter/eess-ts/graphql`;
- the `duplicateBodies` and `inconsistentSiblings` smells.

Measured on NestJS, TypeORM and PixiJS sources and the NestJS sample apps, no finding reported today
is lost, and the additions are real code in the new positions: generic `Error`s thrown in constructors
and getters, over-long or over-complex constructors, and constructors with many parameters.

`noEmptyBodies` does not report an empty constructor that still does something: one with a parameter
property, `constructor(private readonly db: Db) {}`, or a `private` or `protected` constructor. An
empty public constructor without either is reported. Without this, the same measurement reported 199
dependency-injection constructors as empty bodies.

`includeMethods: false` now leaves out every class member, not only methods. A set accessor is read
by `acceptParameterOfType` and `notAcceptParameterOfType` on functions as its own function.
