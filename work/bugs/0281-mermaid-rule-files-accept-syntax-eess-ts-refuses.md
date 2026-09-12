# Bug 0281: `eess-mermaid` rule files accept syntax `eess-ts` refuses

## Status

- **State:** Parked — the divergence is sanctioned by
  [ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md) and
  the alignment work is deferred until the break is worth taking.
- **Severity:** Low-to-medium — not a false green. A rule file that compiles for
  one dialect and not the other, with nothing documenting either rule.
- **Origin:** self-found · adversarial validation of ADR-015, then corrected by
  an architecture review that falsified this record's first premise.

## This record was filed on a premise that turned out to be false

It was first titled "every `eess-mermaid` rule file loads into a second
registry", and argued that `packages/mermaid/src/cli/load-rules.ts` calling
`jiti.import()` unconditionally gives each rule file its own copy of the kernel.
An architecture review measured it. Under the pinned `jiti` 2.7.0 it does not:
the transpiled rule file is `jiti`'s, and every bare specifier it names resolves
to the instance the host already holds.

Re-measured here with controls, all through the real loader:

| probe                                                 | result      |
| ----------------------------------------------------- | ----------- |
| kernel error class, host vs `jiti`-loaded file        | same object |
| `instanceof` across the boundary                      | holds       |
| dialect's exported function                           | same object |
| a write inside the loaded file, read by the host      | visible     |
| the same under fresh mode (the watch path)            | same object |
| **control:** a duplicate nested install of the kernel | **splits**  |

So the split is a property of installation topology, not of the loader, and
`packages/mermaid/src/cli/commands/check.ts`'s comment — "class identity is
unreliable across jiti boundaries because the rule file may load its own copy of
the kernel" — names the wrong cause. The duck-type it justifies is still worth
keeping, for the duplicate-install case that no loader choice fixes.

Plan 0165 measured a real split on an older `jiti`. This is ground that moved.

## What is actually true, measured

`jiti` transpiles, so it accepts TypeScript that Node's strip-only mode refuses.
The same rule file, in both dialects:

| a rule file containing | `eess-ts`       | `eess-mermaid` |
| ---------------------- | --------------- | -------------- |
| `enum`                 | refused, exit 1 | loads, exit 0  |
| `namespace`            | refused, exit 1 | loads, exit 0  |
| a parameter property   | refused, exit 1 | loads, exit 0  |

Consistent across `"type": "module"` and `"type": "commonjs"` — Node raises the
syntax error before the format refusal, so `eess-ts`'s `jiti` fallback is never
reached.

**Nothing documents either rule.** This repo's own `mermaid.rules.ts` is
erasable-only, and no page under `docs/` or `packages/mermaid/README.md` shows
any of the three. An adopter review found the one sentence in the corpus that
speaks to loading — `docs/agent-integration.md:11`, which says the CLI loads rule
files via `jiti` — is now false for `eess-ts`, so the position is worse than
silence: the only available guidance points the wrong way.

## Ruling — 2026-09-12: sanctioned, and re-derived once

`eess-mermaid` rule files remain a transpiled population. Aligning the loader
would break rule files using syntax nothing taught and the sibling dialect
already refuses, and the cost of the divergence is a wider accepted language
rather than a broken registry.

**The first ruling reached the same answer from the wrong evidence** — it
weighed "one duck-typed function that works" against the break, on the premise
that a registry split existed. It did not. The answer survives; the reasoning is
replaced rather than left standing.

## The corruption that must produce a violation

Two, and they are different:

- **Documented here, gated:** the premise. If `jiti` ever does split the kernel,
  `scripts/lib/module-registry-identity.test.mjs` reds and ADR-015's reasoning is
  re-derived rather than drifting. Its duplicate-install case is the control that
  shows the probe can observe a split at all.
- **Not gated:** the language divergence itself. Nothing asserts the two dialects
  agree about what a rule file may contain, because today they do not — a gate
  would have to ship red. That is the work below.

## Verification ledger

- [x] The premise re-measured with controls, and the record corrected in place
      rather than quietly retitled.
- [x] The divergence measured in both dialects, across both project types.
- [x] ADR-015's Decision, Context and the affected Enforcement row re-derived on
      the measured ground.
- [ ] `deferred→this record` — the alignment itself: native-first loading for
      `eess-mermaid` rule files, the `importFresh` equivalent for watch, and a
      migration note for the syntax that would stop loading.
- [ ] `deferred→this record` — `docs/agent-integration.md:11` says the CLI loads
      rule files via `jiti`, which is false for `eess-ts` since ADR-015. An
      adopter looking for the rule is told the opposite of it.
- [ ] `deferred→this record` — `packages/mermaid/src/cli/commands/check.ts`'s
      duck-type comment names `jiti` as the cause; the cause is a duplicate
      install.

Deferred: three, all to this record, held open by its own gate.
