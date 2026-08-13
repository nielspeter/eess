# Bug 0135: `haveMatchingResolver` greps concatenated file text — a Tier-1 claim that cannot go red for a common field name

## Status

- **State:** Draft — read from the source and confirmed against the shipped
  tests. No red test yet.
- **Severity:** Medium — filed knowing the argument for High. It is a **shipped
  public condition in the flagship dialect** whose red is unreachable for most
  real schemas, which is the "green that examined nothing" class this project
  exists to forbid. It is Medium rather than High because no gate in this repo
  runs it (see _Why it matters_) — nobody here is relying on it today. For an
  adopter who wired it into CI, it is High.
- **Origin:** self-found · enforcement review of
  [proposal 003](../proposals/003-future-dialect-candidates.md), whose GraphQL
  entry listed this capability as unbuilt
- **Reported:** 2026-08-13

## Symptom

`packages/ts/src/graphql/schema-conditions.ts:88-126`. The docstring at `:80-84`
promises a cross-reference: _"A field 'users' on type 'Query' is matched if any
resolver file exports a function/variable named 'users' or contains a property
assignment 'Query.users'."_ The implementation is a substring search over every
resolver file's text concatenated into one string:

```ts
const allText = [...resolverFileTexts.values()].join('\n')
// …
const patterns = [
  new RegExp(`\\b${fieldName}\\b`),
  new RegExp(`${element.typeName}\\.${fieldName}`),
]
const hasResolver = patterns.some((p) => p.test(allText))
```

Nothing here reads an export, a declaration, or a property assignment. Four
consequences, each independently disqualifying:

1. **Red is unreachable for common field names.** To report a violation, the
   field name must appear nowhere in the concatenated text of the entire resolver
   corpus — not in a comment, not in a string literal, not in a type annotation,
   not as an unrelated local, not as a different type's identically-named field.
   For `id`, `name`, `status`, `total`, `user`, `email` that never happens.
   Deleting every resolver and leaving `// TODO: implement users, user, posts`
   keeps the check green.
2. **The second pattern is dead code.** Any text matching `Query\.users` also
   matches `\busers\b`, and the combinator is `.some()`. The specific half can
   never be the deciding matcher, so only the loose half is ever in force.
3. **Half the documented drift class has no mechanism.** The loop iterates schema
   elements only (`:97`). A resolver for a field the schema no longer declares —
   the orphan that rots _after_ a field is deleted — is not detected by anything
   in this module.
4. **Attribution points at the wrong file.** `packages/ts/src/graphql/schema-rule-builder.ts:187`
   computes `const firstFile = this.loaded.documents[0]?.filePath` and stamps it
   onto every element (`:202`, `:213`); all three conditions hard-code `line: 1`
   (`schema-conditions.ts:32`, `:65`, `:118`). `loadSchemaFromGlob` is explicitly
   a multi-file loader (`schema-loader.ts:97-121`), so in its designed use case
   every violation reports line 1 of whichever `.graphql` file sorted first,
   regardless of where the field is declared.

The shipped tests demonstrate the defect rather than catch it.
`packages/ts/tests/graphql/schema-rules.test.ts:170-181` ("passes when all fields
have resolvers") builds a resolver text that literally names all four fields — it
proves the grep can match. Nothing tests the direction that matters: a field name
present only in a comment.

## Reproduction

```ts
// schema.graphql:  type Query { users: [User!]! }
// resolvers/index.ts contains only:
//   // TODO: implement users
schema(p, 'schema/*.graphql')
  .queries()
  .should()
  .satisfy(haveMatchingResolver(resolverTexts))
  .check()
// → green. No resolver exists.
```

The inverse is equally reachable: a schema field named `id` is satisfied by any
resolver file that mentions `id` for any reason.

## Root cause

The condition was written against file **text**, not the AST, in a dialect whose
entire premise is that it reads the AST (ADR-002: ts-morph is the sole AST
engine). The resolver side is already loaded as real source files —
`resolvers()` at `packages/ts/src/graphql/index.ts:82-88` filters
`p.getSourceFiles()` — so the ts-morph nodes are in hand at the call site and
are flattened to strings before the condition sees them.

`line: 1` has the same shape of cause: `SchemaElement`
(`packages/ts/src/graphql/schema-predicates.ts:9-20`) carries no source position,
so there is nothing for a violation to report even though the loader keeps
per-file documents.

## Why it matters

This is a **published public condition** exported from
`@nielspeter/eess-ts/graphql`, documented at `docs/graphql.md`, and listed in the
flagship README's feature bullets. An adopter wiring it into CI gets a gate that
reports success while examining nothing — the precise failure
`packages/ts/src/cli/load-rules.ts:49-54` names as the thing "the whole point of
this tool is to forbid".

It is also **invisible to every honesty mechanism this repo has**. There is no
`check:graphql` in `package.json`, no fixture in `scripts/nonvacuity/`, and no
row in the gate list in `scripts/check-nonvacuity.mjs` — and because
`gateCoverage` enumerates only `check:*` package scripts, a shipped public
condition that no gate runs is not even counted as uncovered. So the family's
non-vacuity instrument reports full coverage over a surface it has never seen.

The GraphQL module is the one capability in the family with **no dogfood corpus**
— this repo has no `.graphql` file outside `packages/ts/tests/fixtures/`. Every
dialect eess ships as a package validates this repo's own artifacts first; this
sub-path does not, and it is also the lowest-fidelity mechanism in the family.
That is the correlation worth recording, and it is why proposal 003's Protobuf
caveat ("no dogfood corpus") is a sharper filter than that proposal realized.

## Fix

1. **Resolve resolvers through the AST, not text.** Match a schema field to an
   exported function/variable declaration or a property assignment on a resolver
   map object, using ts-morph via the existing `resolvers()` source files. Drop
   the `resolverFileTexts` map from the signature — it is the defect encoded in
   the type.
2. **Until (1) lands, the condition must not make a Tier-1 claim.** Either mark
   it `.warn()`-only or withdraw it from the public export. `.warn()` here is a
   severity, not an amnesty: it still has to be able to fire, and it still needs
   a fixture.
3. **Give `SchemaElement` a real position** — the loader already keeps per-file
   documents, so the field's own file and line are recoverable. Then remove the
   `firstFile` stamp and the three hard-coded `line: 1`s.
4. **Implement or explicitly drop the orphan-resolver direction.** The docstring
   and proposal 003 both claim it; nothing implements it. If it is out of scope,
   say so at the call site.
5. **Wire a gate and a fixture**, or record the hole. Either add a `check:graphql`
   over a real fixture schema so `gateCoverage` can see it, or add a stated
   waiver so "the graphql sub-path is ungated" is written down rather than
   rediscovered. This is the same harness blind spot recorded in
   [0134](./0134-explain-empty-green-wipes-the-agents-block.md).

## Verification

- [ ] Red test written first: a schema field whose name appears only inside a
      comment in the resolver corpus produces a violation. Green today.
- [ ] Red test: a field named `id` with no resolver anywhere produces a violation.
- [ ] `packages/ts/tests/graphql/schema-rules.test.ts:170` still passes (a genuine
      resolver still matches) — the fix must not invert into false positives.
- [ ] Violations report the field's own file and line, not `documents[0]` line 1.
- [ ] The orphan-resolver direction is implemented, or the docstring at
      `schema-conditions.ts:80-84` stops claiming it.
- [ ] A nonvacuity fixture reddens the graphql surface, or a stated waiver records
      that it is ungated.
- [ ] A changeset naming `@nielspeter/eess-ts` — public condition behaviour and
      possibly its signature.
- [ ] `npm run validate` green.

Deferred:

- **The `gateCoverage` blind spot itself** — that a shipped surface with no
  `check:*` script is not counted as uncovered — is broader than this module and
  is shared with [0134](./0134-explain-empty-green-wipes-the-agents-block.md).
  This record closes on the graphql condition; the instrument's blind spot needs
  its own number if it is not folded into 0134's fix (5).
