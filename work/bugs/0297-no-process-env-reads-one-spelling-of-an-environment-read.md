# Bug 0297: `noProcessEnv` reads one spelling of an environment read

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green.** The rules documented as "No direct
  `process.env` access" (`docs/standard-rules.md:100`, `docs/api-reference.md:646`)
  pass four other reads of the same value.
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo.
- **Reported:** 2026-09-14

## Symptom

Over one module, with `process` and `node:process` declared ambiently so the
reads resolve:

```ts
export function viaDot() {
  return process.env.A
}
export function viaBracket() {
  return process['env'].B
}
export function viaDestructure() {
  const { env } = process
  return env.C
}
export function viaGlobalThis() {
  return globalThis.process.env.D
}
import { env as nodeEnv } from 'node:process'
export function viaNodeProcess() {
  return nodeEnv.E
}
```

`functionNoProcessEnv()` reports `viaDot` only. `moduleNoProcessEnv()` reports the
`process.env.A` read only. `noProcessEnv()` on a class whose methods use the same
five spellings reports the `process.env.A` method only.

`import.meta.env` is **not** in that count. It is a bundler convention, not Node's
environment, and in bundler projects it is often the sanctioned configuration
channel; a rule named `noProcessEnv` should not claim it. A CONTROL test pins that
it stays unreported. If "no ambient environment reads" is wanted, that is a
separate, separately named rule.

A read in a class **field initializer**, static field or parameter default is
missed by the class variant whatever its spelling — a different root cause,
[0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md).

## Root cause

All three rules are `notContain(access('process.env'))` — `noProcessEnv`
(`packages/ts/src/rules/security.ts:40`), `functionNoProcessEnv` (`:83`) and
`moduleNoProcessEnv` (`:105`). `access()` (`packages/ts/src/helpers/matchers.ts:140`)
matches a `PropertyAccessExpression` whose text equals the chain:

| spelling                             | why it escapes                                                  |
| ------------------------------------ | --------------------------------------------------------------- |
| `process['env']`                     | an `ElementAccessExpression`, not the kind the matcher reads    |
| `const { env } = process`            | a binding pattern; no node's text is `process.env`              |
| `globalThis.process.env`             | the texts are `globalThis.process` and `globalThis.process.env` |
| `import { env } from 'node:process'` | the environment arrives as an import binding                    |

## Why it matters

ADR-009's inherited evidence table carries the shape — its `onlyImportFrom` row:
blind to `export … from` and `import()`, with **0** violations on edges that do
cross the boundary. Destructuring `process` is an ordinary refactor; the agent this
project ships for needs no intent to escape the rule.

The same matcher shape recurs across `security.ts`:
[0301](./0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md).

## Fix

Not decided, but three things are:

- **Where it lives.** In the rules in `security.ts`, or a new, separately named
  matcher. Not in `access()`: its docstring and `docs/body-analysis.md` promise a
  text match, and adopters' own `access('this.db')` rules depend on that.
- **An unresolved binding falls back to the lexical match**, never to "no match".
  The fixture declares `process` so a resolving fix can be tested; a fix that
  requires `@types/node` must load it into the fixture.
- **Release.** The fix turns existing green gates red: a behavioural break, marked
  on `0.x`, with a migration line. After it, the rule docs should list the spellings
  covered rather than promise "no direct access" — a static matcher still misses
  `const p = process; p.env`.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/process-env-reads-one-spelling.test.ts` ·
      `it('KNOWN GAP — functionNoProcessEnv reports process.env.X and none of four equivalent reads')`,
      `it('KNOWN GAP — moduleNoProcessEnv reports process.env.X and none of four equivalent reads')` and
      `it('KNOWN GAP — noProcessEnv on a class reports process.env.X and none of four equivalent reads in its methods')`.
      Each asserts the dot form IS caught, so none can pass over a rule that catches
      nothing, and each variant is pinned separately, so a fix to one reds only its own.
- [x] `it('CONTROL — import.meta.env is outside noProcessEnv')`
- [ ] the fix in the rules, KNOWN-GAP tests inverted into red-first tests
- [ ] the rule docs list the spellings covered, and say `import.meta.env` is not one
- [ ] `npm run validate` green.

Deferred: none.
