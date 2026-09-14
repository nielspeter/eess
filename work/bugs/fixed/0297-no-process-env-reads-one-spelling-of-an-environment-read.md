# Bug 0297: `noProcessEnv` reads one spelling of an environment read

## Status

- **State:** Fixed — the three rules read `process.env` through a string-keyed bracket or a
  global object; the two spellings that need a binding followed moved to
  [0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md). Red test first.
- **Severity:** High — **false green.** The rules documented as "No direct `process.env`
  access" passed four other reads of the same value — bracketed, destructured, through `globalThis`, and
  imported from `node:process`.
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported, over one module, with `process` and `node:process` declared ambiently so the
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

`functionNoProcessEnv()` reported `viaDot` only. `moduleNoProcessEnv()` reported the
`process.env.A` read only. `noProcessEnv()` on a class whose methods used the same five
spellings reported the `process.env.A` method only.

`import.meta.env` is **not** in that count. It is a bundler convention, not Node's
environment, and in bundler projects it is often the sanctioned configuration channel; a rule
named `noProcessEnv` should not claim it. A CONTROL test pins that it stays unreported.

A read in a class **field initializer**, static field or parameter default was missed by the
class variant whatever its spelling — a different root cause,
[0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md).

## Root cause

All three rules were `notContain(access('process.env'))`, and `access()` matches a
`PropertyAccessExpression` whose text equals the chain:

| spelling                             | why it escaped                                                  |
| ------------------------------------ | --------------------------------------------------------------- |
| `process['env']`                     | an `ElementAccessExpression`, not the kind the matcher reads    |
| `const { env } = process`            | a binding pattern; no node's text is `process.env`              |
| `globalThis.process.env`             | the texts are `globalThis.process` and `globalThis.process.env` |
| `import { env } from 'node:process'` | the environment arrives as an import binding                    |

The line pointers this record carried were removed at close: the calls they named were
replaced.

## Why it matters

ADR-009's inherited evidence table carries the shape — its `onlyImportFrom` row: blind to
`export … from` and `import()`, with **0** violations on edges that do cross the boundary.
Destructuring `process` is an ordinary refactor; the agent this project ships for needs no intent
to escape the rule.

## Fix

The three rules use `processEnvAccess()`, a matcher private to `packages/ts/src/rules/security.ts`
built on the name reading
[0301](./0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md) added there. It reads
a property access or a string-keyed element access, drops one leading global object —
`globalThis`, `window`, `self`, `global` — and matches when what remains is `process.env`. So
`process.env`, `process?.env`, `process['env']`, `globalThis.process.env` and
`globalThis['process']['env']` are reported, and `settings.env` is not. It did not read through a type assertion, a
non-null assertion or a second global object — [0308](./0308-security-rules-miss-a-global-read-through-a-cast.md), since fixed — and, since it reads
names rather than bindings, it reads a local named `global`, `window` or `self` as the global
object — [0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md).

The three things the record had decided before the fix:

- **Where it lives** — in the rules, not in `access()`, whose docstring promises a text match that
  adopters' own `access('this.db')` rules depend on. `access()` is unchanged.
- **An unresolved binding falls back to the lexical match** — not reached: nothing here resolves a
  binding. The two spellings that would need it were split to 0305, which carries the same
  constraint for all four rules.
- **Release** — a `minor` changeset marked breaking for `@nielspeter/eess-ts`. The description is
  unchanged, `access to 'process.env'`, so messages are unchanged and a baseline keeps its count of accepted findings. Which read an
  accepted entry covers can move: identities are numbered in document order within a member, so a
  newly reported bracketed read above an accepted dot read takes its ordinal — the renumbering
  `match-identity.ts` documents, measured in the method review. The changeset says so. The rule
  docs and the `noProcessEnv` JSDoc now list the spellings covered, and say which are not.

**Split, not half-fixed.** `const { env } = process` and `import { env } from 'node:process'`
reach the environment under a local name, which is 0305's question — how far a binding is
followed — for `eval`, `Function` and `console` already. They are pinned there by a KNOWN-GAP test
and named in 0305's symptom table.

## Verification

- [x] Red test first — `packages/ts/tests/rules/process-env-rule-spellings.test.ts`, the KNOWN-GAP
      tests inverted into the target behaviour with the destructured and imported spellings taken
      out of the fixture and `globalThis['process']['env']` and `settings.env` added, and run before
      the fix: of the four environment reads the fixture then held, `functionNoProcessEnv` reported
      `{viaDot}`, `moduleNoProcessEnv` line `{1}` and `noProcessEnv` line `{2}`; the
      CONTROL passed.
- [x] The fix turns them green —
      `it('functionNoProcessEnv reports process.env read through a bracket or a global object')`,
      `it('moduleNoProcessEnv reports process.env read through a bracket or a global object')` and
      `it('noProcessEnv on a class reports process.env read through a bracket or a global object')`,
      each an exact set that excludes `settings.env`, with
      `it('CONTROL — import.meta.env is outside noProcessEnv')` still green. The enforcement
      review found `process?.env` and a template-literal key claimed but unpinned; both, and
      `global['process']`, are now in the fixtures, and the assertions are sorted lists, so a read
      reported twice shows. The full `packages/ts` suite passes.
- [x] The rule docs list the spellings covered, and say `import.meta.env` is not one —
      `docs/standard-rules.md`, `docs/api-reference.md` and the `noProcessEnv` JSDoc.
- [ ] deferred→[0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md) —
      `const { env } = process` and `import { env } from 'node:process'`, which need the binding
      followed. Pinned by
      `it('KNOWN GAP — an environment read through destructuring or the node:process import is not reported')`.
- [ ] deferred→[0308](./0308-security-rules-miss-a-global-read-through-a-cast.md) —
      a read through a type assertion, a non-null assertion or a second global object; found by
      the enforcement review. Fixed there; its KNOWN-GAP test became
      `it('functionNoProcessEnv reads process.env through a type assertion, a non-null assertion and a second global object')`.
- [x] Sabotage matrix in the 0297 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `security.ts` restored by sha256
      after every row, verdicts read by test title over this file, 0305’s tests, the body-finding
      anchor tests and 0308’s pin): **15 rows, 0 mismatches**, run again after rebasing onto
      0300’s merge and after the reviews. Baseline green. The old text match, re-implemented in
      place, reds the three target tests and 0305’s global-object shadow pin. Leaving element
      access unread reds the three; not dropping a leading global object reds the three and the
      shadow pin. Over-broad — any chain ending in `.env` — reds the three through `settings.env`
      and 0308’s pin through `window.self.process.env`; counting `import.meta.env` reds the
      function and module tests and the CONTROL. Disconnecting one variant reds only that
      variant’s tests: the function variant also reds 0305’s environment and shadow pins, 0308’s
      pin and the function anchor test, the module variant the module anchor test, the class
      variant the class anchor test. A changed description reds the class and function anchor
      tests, which assert the message. Leaving the optional chain or a template-literal key unread
      reds the three target tests; dropping only `globalThis` reds the three and the shadow pin;
      reporting every chain that starts with `process.env` — each read twice — reds the three
      target tests, both message anchor tests and 0308’s pin. A total break reds all but the
      `import.meta.env` CONTROL and 0305’s two other pins. One first-run mismatch was the
      matrix’s: the message row also expected the module anchor test, which asserts where a
      finding is anchored, not its message; the expected set was corrected and the row re-run.
      The four rows for the enforcement review’s findings passed as predicted on their first run.
- [x] `npm run validate` green.

Deferred: [0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md),
[0308](./0308-security-rules-miss-a-global-read-through-a-cast.md)
