# Bug 0305: the `eval`, `Function`, `console` and `process.env` rules read names, not bindings — they miss an alias and report a shadow

## Status

- **State:** Fixed — the four rules read a name through its binding, in both directions: a global
  reached through a local alias, a destructuring or the `node:process` import is reported, and a
  local that keeps a global's name is not. Red test first.
- **Severity:** High — **false green.** `const F = Function; F('return 1')()` passes the
  `recommended` floor every adopter installs, and `const { log } = console` passes
  `noConsole` and `const { env } = process` passes `noProcessEnv`, each an ordinary refactor
  rather than an evasion. The other direction is a **false red**: a local declaration that
  shadows a global is reported as the global.
- **Origin:** self-found · split from
  [0301](./0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md) when it
  was fixed, because this half needs a design decision and that half did not. The
  false-positive direction was added from 0301's independent review. The environment reads
  were split from [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)
  the same way, when it fixed the bracketed and global-object spellings.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-20 (PR #148)

## Symptom

**A global bound to a local name is missed.** One function per spelling; each rule's direct
spelling is reported, the aliased one is not:

| rule                            | reported         | not reported                                |
| ------------------------------- | ---------------- | ------------------------------------------- |
| `functionNoEval`                | `eval('1')`      | `const ev = eval; ev('1')`                  |
| `functionNoFunctionConstructor` | `new Function()` | `const F = Function; F('return 1')()`       |
| `functionNoConsole`             | `console.log(1)` | `const { log } = console; log(1)`           |
| `functionNoProcessEnv`          | `process.env.A`  | `const { env } = process; env.B`            |
| `functionNoProcessEnv`          | `process.env.A`  | `import { env } from 'node:process'; env.C` |

**A local name that shadows a global is reported.** None of these touches a global:

| rule                            | reported, wrongly                                                    | since       |
| ------------------------------- | -------------------------------------------------------------------- | ----------- |
| `functionNoFunctionConstructor` | `function Function(a: number) { … }; Function(1)`                    | 0301's fix  |
| `functionNoFunctionConstructor` | `class Function { … }; new Function(1)`                              | before 0301 |
| `functionNoConsole`             | `const console = { log: (n: number) => n }; console.log(1)`          | before 0301 |
| `functionNoProcessEnv`          | `function f(process: { env: Env }) { return process.env.E }`         | before 0297 |
| `functionNoProcessEnv`          | `function f(global: { process: Env }) { return global.process.env }` | 0297's fix  |
| `functionNoProcessEnv`          | `const self = host; self.process.env`                                | 0297's fix  |

The `process.env` rows were measured in 0297's reviews. A local named `global`, `window` or `self`
became reportable when 0297 read `process.env` through a global object. Since 0308 drops every leading
global object, a local named like one and followed by another global name is read as the global too:
`function f(self: any) { return self.window.eval('1') }` is reported. The
bare call is new: before 0301 only `new Function(…)` was matched, so a call to a local
`Function` was never checked. The class and module variants share the matchers, so they share
both directions.

## Root cause

Since 0301 the rules in `packages/ts/src/rules/security.ts` read the global's name structurally
at the site of use — through a global object, a string-keyed bracket, an indirect call. They do
not ask what the name is bound to. A local binding changes the name at the site of use to one
that is not the global's (`ev`, `F`, `log`), so an alias is missed; and a local declaration keeps
the global's name while binding something else, so a shadow is reported.

## Fix

**Ruled: a name is read through its binding, as far as the file spells the binding out.**
`helpers/global-binding.ts` holds it, and `security.ts` keeps the one definition of what a name
chain is. Four cases, answering the record's "how far":

- **no declaration, or an ambient one** — `declare function eval`, a `.d.ts`, the lib — the name IS
  the global. The ordinary case, and the one that must not change.
- **a local bound to a global expression** — `const ev = eval`, `const { log } = console`,
  `const { log: write } = console`, `import { env } from 'node:process'` — reads as what it is bound
  to, through as many hops as the file spells (`const ev = eval; const ev2 = ev`).
- **anything else local** — a function, a class, a parameter, a variable holding something else — is
  not the global, and nothing is reported.
- **a binding that cannot be resolved** falls back to the name as written. A missing type definition
  must never turn a rule off (ADR-009), so an unresolvable name errs toward reporting.

A `let` is read through its initializer like a `const`. It can be reassigned later, so the answer is
not certain — and for a prohibition the uncertain direction to take is the one that reports.

**"Anything else local" had to be narrowed, and the first version of this fix was a fail-open.** An
IMPORT is not a shadow: it is a binding this file does not spell out, which the rule above sends to
the fallback. The first version treated every unresolved declaration as a local, so
`import process from 'node:process'; process.env.A` — the form Node's ESM documentation recommends —
reported **nothing** where 0.6.0 reported it, and the suite did not catch it because only the named
import was pinned. Now only a declaration that positively names a local value — a function, a class,
a parameter, an enum, a method, a property — says "not the global"; an import from the process
module resolves to `process`, named, default or namespace; and any other binding falls back to the
name as written. A `process` imported from somewhere else is therefore still reported, as it was at
0.6.0: a false red this fix keeps rather than guess.

**What these matchers do not read**, measured and left: they read a member ACCESS, so a global
stored as a property of something else and reached through that thing — `const o = { console };
o.console.log(1)` — is not followed, as it was not before.

**The access matchers had to learn to read a bare NAME.** `const { log } = console; log(1)` has no
property access to match at the use site, and neither has `env.B` once `env` is the root. So
`console` and `process.env` are matched at an identifier too, with the positions that are not reads
excluded — a name being declared, and the property half of `console.log` — or the same global would
be reported twice and once again at its declaration.

Measured, one function per row:

| shape                                          | before | after |
| ---------------------------------------------- | ------ | ----- |
| `eval('1')` (control)                          | 1      | 1     |
| `const ev = eval; ev('1')`                     | **0**  | 1     |
| `const ev = eval; const ev2 = ev; ev2('1')`    | **0**  | 1     |
| `let ev = eval; ev('1')`                       | **0**  | 1     |
| `new Function('…')` (control)                  | 1      | 1     |
| `const F = Function; F('…')()`                 | **0**  | 1     |
| `console.log(1)` (control)                     | 1      | 1     |
| `const { log } = console; log(1)`              | **0**  | 1     |
| `process.env.A` (control)                      | 1      | 1     |
| `const { env } = process; env.B`               | **0**  | 1     |
| `import { env } from 'node:process'; env.C`    | **0**  | 1     |
| `function Function(a) {…}; Function(1)`        | **1**  | 0     |
| `class Function {…}; new Function()`           | **1**  | 0     |
| `const console = {…}; console.log(1)`          | **1**  | 0     |
| `function f(process: {env}) { process.env.E }` | **1**  | 0     |
| `const self = host; self.window.eval('1')`     | **1**  | 0     |

**What it costs, measured rather than assumed.** Resolving a binding asks the type checker for a
symbol, and the access matchers now ask it per identifier. Over this repository's 270 source files
the `recommended` floor gate measured **0.50s, 0.51s, 0.51s and 0.86s before; 0.92s, 0.93s, 0.99s
and 1.02s after** — so between 0.2ms and 2.0ms per file depending which ends are paired, around
1.6ms at the medians. The single figure this record first gave was the minimum-to-minimum pairing,
which the method review named; the runs are here instead. Recorded at all because a check that
becomes slow enough to switch off is a fail-open by another route.

The architecture review measured the same cost one level down: **83,764 `getSymbol()` calls against
17,142 distinct nodes** over five rules, which a memo would serve. That is filed as
[0335](../0335-the-binding-resolver-asks-the-checker-once-per-identifier.md) rather than added here,
because a stale symbol is a wrong verdict and a cache's invalidation is its own decision.

## Verification

- [x] KNOWN-GAP tests pinned today's behaviour, one per direction, and the environment reads split
      from 0297 with them. All four were red against the fix before the file was replaced.
- [x] a ruling on how far a binding is followed, for all four rules — see **Fix**.
- [x] the fix, with every KNOWN-GAP test inverted into an assertion of the fixed behaviour —
      `packages/ts/tests/rules/security-rules-read-a-global-through-its-binding.test.ts` ·
      `it('reports a global reached through a local alias or a destructuring')`,
      `it('reports an environment read through destructuring or the node:process import')`,
      `it('reports nothing for a local named process, global, window or self')` and
      `it('reports nothing for a local declaration that shadows Function or console')`.
- [x] the fail-closed fallback and the double-report guard pinned —
      `it('reads an ambient declaration as the global, however it is declared')` and
      `it('reports a global once, not once per name it is read under')`. The first is the shape that
      regressed while this fix was built: `declare const process` carries its keyword on the
      STATEMENT, and asking the declaration alone took the `process.env` control to zero.
- [x] Sabotage matrix over this PR's two test files, sources restored by sha256 and verified. R7,
      the name read instead of the binding: five tests red. R8, ambient asked of the declaration
      alone: two red. R9, a bare name not a candidate: two red. R10, a name being declared counted
      as a read: one red. R11, a destructured binding not followed: three red. R12, the
      `node:process` import not followed: one red.
- [x] the architecture review's findings closed — the import fallback above, with
      `it('reports the environment however the process module is imported')` covering the default,
      namespace, renamed and foreign-module shapes; the ambient-ancestor walk pinned with a global
      the rules actually match, `it('reads a global declared inside a declare global block as the global')`;
      the value-wrapper list taken from `core/through-wrappers.ts` instead of a third copy; and the
      member-access limit pinned by
      `it('reads a global through a variable that holds it, and not through an object that wraps it')`.
- [x] `npm run validate` green.
- [x] the cost this fix adds is `deferred→`
      [0335](../0335-the-binding-resolver-asks-the-checker-once-per-identifier.md), where the
      architecture review's call counts live: a memo is a cache, and a stale symbol is a wrong
      verdict, so its invalidation is a decision this PR did not make.

Deferred: 0335.
