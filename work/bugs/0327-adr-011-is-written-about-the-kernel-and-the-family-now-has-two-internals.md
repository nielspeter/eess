# Bug 0327: ADR-011 is written about the kernel, and the family now has two `/internal` entry points

## Status

- **State:** Draft — a decision to make, not a defect to fix. The mechanism half shipped with PR #145.
- **Severity:** Low — nothing is wrong today. It is a packaging contract that five dialects may now
  copy, resting on an ADR whose clauses name one package.
- **Origin:** self-found · architecture review of [0287](./fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md)'s
  fix (PR #145), which added the second `/internal`
- **Reported:** 2026-09-20

## Symptom

[ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) is titled "The Kernel's Public API Is
Explicit" and is written about `@nielspeter/eess` throughout: its Decision names the kernel root, and its
Enforcement rows are kernel-scoped — row 1 blocks on the kernel root only, and row 2's mechanism
(`packages/ts/tests/standalone-surface.test.ts`) checks eess-ts's barrel against the **kernel's**
internal.

PR #145 added `@nielspeter/eess-md/internal` — the same pattern, one layer down, cited to the same ADR
by `packages/md/src/internal.ts:1` and by that PR's changeset. Two consequences follow, both structural
rather than broken:

- `scripts/lib/public-surface.mjs:124` skips `subpath === './internal'` for **every** package, not just
  the kernel. It was written generically under a kernel-only clause. A dialect can now shrink its
  undocumented-export census by moving a symbol behind `/internal`, with no clause authorising the
  population it removes.
- Importing a **sibling's** `/internal` is new in the family. `packages/crossvalidate/src/md-mermaid.ts`
  and `mermaid-ts.ts` import siblings at runtime, but only from their public roots; `md-gherkin.ts:11`
  now crosses into another package's declared-private surface.

## What shipped with PR #145, and what did not

**Shipped:** the invariant that a barrel never re-exports its own `/internal` now has a mechanism for
every package that ships the subpath — `scripts/lib/internal-not-reexported.test.mjs`, run by
`check:family`. Before it, the kernel's clause and eess-md's copy of the sentence were both prose, which
is the shape ADR-009 rules out.

**Not shipped, and this record's subject:** whether ADR-011's Decision covers the family or only the
kernel. The options, none costed:

1. Amend ADR-011: scope "the kernel" to "every package in the family", and generalise row 2's mechanism
   from one barrel to all of them (`standalone-surface.test.ts` reads one package's barrel; the loop is
   the change). The architecture review's ask.
2. A separate ADR for dialect-level `/internal`, leaving ADR-011 about the kernel.
3. Decide that a dialect's `/internal` needs no ADR, and say so in ADR-011 so the next reader does not
   have to infer it — with the mechanism above standing as the family-wide clause.

## Why it is a decision and not a patch

[0257](./fixed/0257-path-suffix-resolution-is-implemented-twice.md), the precedent 0287's ruling
followed, settled a **placement** — one owner, in the kernel — which is bug-record-sized. This is a
packaging contract the whole family may use, and it changes what two gates measure. Different class,
and the ADR lane is where a binding decision belongs (see the working method's ADR-versus-plan line).

## Verification

- [x] Confirmed ADR-011's Decision and Enforcement rows name the kernel only.
- [x] Confirmed `public-surface.mjs:124` skips `./internal` for every package, and that the skip predates
      this use.
- [x] Confirmed the barrel invariant now has a mechanism, and that it reds on a planted leak.
- [ ] The decision, by the library author: amend, separate ADR, or declare no ADR needed.

Deferred: none.

## Related

- [0287](./fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md) — the fix that added the
  second `/internal`.
- [0328](./0328-a-sibling-peer-floor-is-a-manual-release-step.md) — the other half of the same seam:
  the version constraint that makes the new import resolvable.
