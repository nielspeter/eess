# Bug 0225: `check:family` is import-driven, so a type used only in a signature obliges no re-export

## Status

- **State:** Draft — narrowed 2026-08-24. The acute instances are guarded by a
  compile-checked consumer fixture (`examples/public-surface.test.ts`); the general
  gate question below is still open.
- **Priority:** Medium — a real standalone-sufficiency hole, but it fails loudly at the
  consumer's `tsc` rather than silently. No fake green.
- **Origin:** self-found, reviewing [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md).
  A reviewer installed `@nielspeter/eess-md` alone and could call `correspondence()` but
  not name its argument.

## Symptom

`family/re-export-complete` exists to guarantee that installing one dialect is enough —
"a standalone consumer of one dialect must never need a second, direct `@nielspeter/eess`
install". It holds for every symbol a dialect's source **imports**. It does not hold for a
kernel type that appears only in a **signature** the dialect re-exports.

Measured before the fix, with only `@nielspeter/eess-md` installed:

```
corr.rules.ts(2,15): error TS2724: '"@nielspeter/eess-md"' has no exported member
named 'CorrespondenceOptions'. Did you mean 'correspondence'?
```

`correspondence()` is eess-md's public surface. Its parameter type was not reachable from
eess-md at all — callable, unnameable, so no helper could be factored and no wrapper typed.

## Root cause

`kernelImportsOf` (`scripts/lib/family-re-exports.mjs:79`) collects the kernel symbols a
package's own `src/**` **imports or forwards**. eess-md's source never writes
`CorrespondenceOptions` — it re-exports `correspondence`, and the type rides along inside
that function's signature — so the rule has nothing to oblige and correctly reports no gap.

The rule asks "did you re-export what you imported?". The guarantee needs "did you
re-export what a consumer must be able to NAME?". Those differ exactly on types that
appear only in signatures.

## Repro

1. `npm run build`
2. Remove `export type { CorrespondenceOptions, RelationSpec, KeyBy }` from
   `packages/md/src/index.ts`
3. `npm run check:family` → exit 0, no finding
4. `packages/md/dist/index.d.ts` no longer names the type its own `correspondence()` takes

## Fix — undecided, and the choice matters

The instance found on the ADR-011 branch is repaired by hand (eess-md re-exports the three
correspondence types; eess-mermaid gained the glob constructors). This record is about the
**gate**, which would not catch the next one.

Two shapes, and they are not equivalent:

- **Signature-reachability.** For each symbol a dialect barrel re-exports, walk its type and
  require every kernel name in that type to be re-exported too. Correct, and it is the same
  closure `packages/core/tests/public-surface-is-nameable.test.ts` already runs for the
  kernel root — so the machinery exists. Costs a ts-morph pass per barrel in a gate that is
  currently a text scan.
- **Emitted-`.d.ts` reachability.** After build, require every `import … from
'@nielspeter/eess'` in a dialect's emitted declarations to be re-exported by its barrel.
  Cheaper and exact about what a consumer's `tsc` needs — but it makes `check:family` depend
  on build output, and this repo has already been burned once by measuring against `dist`
  (36 stale `.d.ts`, see the `prebuild` clean in the same branch).

## Narrowed, 2026-08-24 — what the fixture does and does not close

`examples/public-surface.test.ts` imports from the **published** specifiers and
**names** every type in an annotation, so `tsc -p examples/tsconfig.json` reds if
any becomes unreachable. Sabotage-verified in both directions: stripping
`CorrespondenceOptions`/`RelationSpec`/`KeyBy` from the kernel root reds, and
stripping them from eess-md's barrel reds with the same error a consumer sees —
`'"@nielspeter/eess-md"' has no exported member named 'CorrespondenceOptions'`.

That matters because it reaches the half nothing else could. Runtime tests cannot:
TypeScript erases types, so a test calls `correspondence({ left, right })` with an
object literal and never touches the options type — which is exactly how this
survived every gate. `standalone-surface.test.ts` says so itself: _"`import _ as
ns`only captures what exists at runtime, so type-only kernel exports aren't
covered here."* It also fixes a second, wider hole: 76 test files import`../src/index.js` and only 7 import the published specifier, so most of the suite
would pass with the barrels wrong.

**It does not close this record**, and the difference is the point. The fixture
guards the names someone remembered to write down. A signature-only type added
next month is caught only if a human adds a line — which is a discipline, not a
mechanism, and this repo's own history says disciplines lapse. The general fix
below (signature-reachability in `check:family`) is still the mechanism; what has
changed is that the acute cases are guarded and the record is no longer urgent.

## Verification

- [x] Red first: delete one of eess-md's three correspondence type re-exports and something
      reds, naming the symbol and the barrel.
      **done-otherwise** — not `check:family`, which is what this record proposes, but
      `check:examples`: the compile-checked consumer fixture reds with the consumer's own
      error text. The box is satisfied; the mechanism it named is not built.
- [ ] The existing import-driven cases still red (the four probes in
      `scripts/lib/family-re-exports.test.mjs` are the regression set).
- [ ] Non-vacuity: the fixture asserts the specific finding, not just a non-zero exit —
      `check:family` can be red for its own reasons.
- [ ] A control: a kernel type used only inside a dialect's implementation obliges nothing,
      so the widened rule does not drag plumbing back onto barrels — which is the exact
      thing ADR-011 removed.

Deferred: none.
