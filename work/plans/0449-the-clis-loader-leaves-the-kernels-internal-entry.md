# Plan 0449: the CLI's loader leaves `@nielspeter/eess/internal`

## Status

- **State:** Draft — recorded 2026-10-17 at [plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md)'s close, as that plan's Out of scope promised ([plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md)).
- **Priority:** Low — no defect today: since [plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md) the family loads under Bun, and its guard keeps
  it so. This is about what a library entry links.
- **Effort:** Small to medium — a move of symbols plus a minor release.
- **Created:** 2026-10-17

## Problem

`packages/core/src/cli-config.ts` holds the CLI's module-loading policy, including
`enableTypeScriptSpecifierResolution`, which registers a resolve hook on the host process.
`@nielspeter/eess/internal` re-exports it, and the dialects reach the kernel's internals through
that entry, so a library call such as eess-md's `corpus()` links CLI code. That is how [bug 0439](../bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md) broke
`corpus()` under Bun. [Spike 0438](../spikes/0438-what-the-family-does-under-bun.md) recommended moving the loader off `/internal` before fixing the
import; [plan 0448](./completed/0448-a-bun-load-guard-and-bug-0439s-fix.md) fixed the import alone, which [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md) allows, and left this.

## Design

To be worked out: where the loader goes (a separate kernel subpath only the dialect CLIs import, or
into each dialect's CLI), and what stays re-exported from `/internal` for compatibility. Moving a
symbol out of a public subpath is a minor under [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md), and a break for any adopter importing it.

## Out of scope

- Any change to what the loader does.

## Progress ledger

- [ ] Design decided and reviewed

Deferred: none
