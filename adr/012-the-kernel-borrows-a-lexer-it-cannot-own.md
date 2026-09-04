# ADR-012: The kernel borrows a lexer it cannot own

## Status

**Accepted** — 2026-08-31.

Prerequisite for [plan 0188](../work/plans/0188-unify-the-duplicated-engine-modules.md),
which names it as one of two decisions it "cannot settle by writing code".

## Context

`parseExclusionComments` decides whether an `eess-exclude` directive is a real
directive or just text that looks like one. Getting that wrong is not cosmetic in
either direction:

- Honour a directive inside a string literal and any file containing that text
  can suppress a real violation — [bug 0154](../work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md).
- Miss a real directive and an author's waiver silently does nothing.

Knowing which spans of a file are comments requires knowing the language. **The
kernel does not know any language.** It declares zero dependencies (gated by
`check:integrity`) and has no AST, because four of the five dialects it serves —
`eess-md`, `eess-mermaid`, `eess-gherkin`, `eess-crossvalidate` — have no
TypeScript to parse.

So the family shipped two implementations:

|                                              | how it finds comments                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/core/src/exclusion-comments.ts`    | regex masking, routed on file extension (`CODE_LIKE` / `MARKDOWN_LIKE`)                |
| `packages/ts/src/core/exclusion-comments.ts` | a real `ts-morph` project, masking `StringLiteral` and `NoSubstitutionTemplateLiteral` |

They then diverged, which is the whole reason this decision is being made rather
than left implicit. [Bug 0227](../work/bugs/0227-eess-ts-is-silent-on-a-malformed-exclusion-start.md):
PR #88 fixed [bug 0158](../work/bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md)
in the kernel copy — a reason-free `eess-exclude-start` is reported against the
`-start` — and the eess-ts copy never received it. Measured, on the same input:

| input                     | kernel                         | eess-ts               |
| ------------------------- | ------------------------------ | --------------------- |
| bare `-start`, no rule id | names the fault, with a `Fix:` | **silent**            |
| bare `-start` + `-end`    | blames the `-start`            | **blames the `-end`** |

eess-ts is the dialect adopters install.

## Decision

**One parser, in the kernel. It takes the lexer as an optional capability, and
its default is the conservative one.**

```ts
parseExclusionComments(text, filePath, options?: { mask?: MaskNonComment })
```

A **masker** — `(sourceText, filePath) => string`, blanking non-comment spans,
length- and line-preserving — rather than the span-finder this ADR first
described. Both existing implementations already are one; the name was written
before the seam was read, and the seam is a single `mask(sourceText)` call.

Three properties, and each is the decision rather than an implementation detail:

1. **Optional.** A dialect that passes nothing gets the kernel's regex masker.
2. **The default is conservative** — when it cannot prove a span is a comment, it
   does not treat it as one. A directive is dropped rather than a violation
   silently suppressed.
3. **The dialect supplies accuracy, never correctness**, and this is enforced by
   composition rather than trusted: the kernel applies its own default masker to
   whatever the injected one returns. An injected masker can therefore only blank
   MORE, never less. It cannot expose a directive the default would have hidden,
   which is the only direction that can silently suppress a real finding.

`eess-ts` passes a `ts-morph`-backed finder, keeping exactly the accuracy it has
today.

## Alternatives rejected

**The kernel takes already-masked text.** This follows `PathUniverse`'s
established seam — the kernel takes materialized data, the dialect does the I/O —
and it was the first shape considered. Rejected because the obligation moves
outward: a dialect that forgets to mask passes raw text, and the parser then
honours directives inside string literals with nothing to notice. That is
bug 0154 reopened, per dialect, silently. **A default that is safe when a caller
does nothing is worth more here than consistency with a seam that has no such
hazard.**

**The kernel depends on `ts-morph`.** Refused by kernel purity — it would put a
TypeScript parser inside `eess-md`'s dependency tree, and it is gated.

**Leave both copies and gate that they agree.** A gate comparing two
implementations still has two implementations to fix, and bug 0227 shows the fix
lands on one of them. The copies are the defect, not the drift.

## Amended during implementation — what a reason-free waiver does

Unifying the parsers exposed a second disagreement this ADR had not anticipated,
and it could not be left to each dialect without re-creating the divergence.

|           | reason-free `// eess-exclude foo`                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `eess-ts` | **applies** the waiver; `execute-rule` replaces the suppressed finding with an unsuppressable one saying the waiver states no reason (bug 0039) |
| kernel    | **dropped** it; the author saw the violation they were waiving, plus a line on stderr                                                           |

Both were fail-closed. `eess-ts`'s is the better design — it tells the author what
to fix rather than showing them the thing they waived — so **the kernel adopts
it**, and the other four dialects gain it. That required the kernel's own
`execute-rule` to gain the promotion; applying without promoting would be the
fail-open, and is the one shape refused here.

A configurable option was written first and rejected: it would have made the
divergence a supported setting, so two adopters could get two behaviours from one
tool. A general tool needs one answer.

## Consequences

- One implementation. Bug 0227's class cannot recur for this module.
- `MaskNonComment` and `ParseExclusionOptions` are on the kernel **root**, not
  `/internal`. This ADR first said the opposite — "family plumbing, a consumer
  never supplies one" — and that was wrong, caught by
  `packages/core/tests/root-surface.test.ts` the moment it was implemented:
  `parseExclusionComments` is itself a root export, so ADR-011 requires its whole
  signature to be nameable from the root. A root function whose options type is
  reachable only through `/internal` is exactly the misclassification that ADR
  exists to prevent. Who _supplies_ the value and where the type must _live_ are
  different questions.
- `eess-ts`'s parser is deleted. Its behaviour is preserved by the injected
  finder, not by keeping the file.
- A dialect can inject a bad masker, but not an unsafe one: composition means
  the worst outcome is over-masking, which hides a directive loudly rather than
  inventing one silently.

## Enforcement

| Clause                                                                    | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Status  |
| ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Exactly one `parseExclusionComments` exists in the family                 | 1    | `check:guardrails` (`scripts/check-guardrails.mjs`) runs the shipped `agentGuardrails` preset over `packages/*/src/**`. It reported this pair at 100% before the unification and does not now. **`warn`, not `gated`, and the distinction is real**: `no-copy-paste` ships `.warn()`, so a second copy reappearing is reported and does not fail the build                                                                                                                                                                                                                                                                                                                                                                                              | `warn`  |
| A dialect that injects nothing gets the conservative default              | 2    | `packages/core/tests/exclusion-reason-and-nesting.test.ts` and `packages/core/tests/exclusion-directive-position.test.ts` call `parseExclusionComments` with no options throughout, so every case in them asserts default behaviour; the option is additive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `gated` |
| An injected masker cannot make the parser accept what the default refuses | 2    | `packages/core/tests/exclusion-mask-injection.test.ts` — injects the identity function as a masker and asserts a directive inside a string literal is still refused. Verified by sabotage: replacing the composition with the injected masker alone reds exactly that test and no other. **Cited by file, not by `it()` title, and not by choice**: `check:crossval` resolves ADR test citations against `project('packages/ts/tsconfig.json')`, so no clause in any ADR can name a kernel test by title. The gap is the mechanism's, not this row's                                                                                                                                                                                                    | `gated` |
| `eess-ts` keeps its `ts-morph` accuracy after the parser moves            | 2    | `packages/ts/tests/helpers/exclusion-comments.test.ts` runs against the unified parser plus the injected masker, unchanged except where the reason-free decision below changed the answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `gated` |
| A reason-free waiver applies, and becomes an unsuppressable finding       | 2    | Three mechanisms, because one clause spans two engines. `packages/ts/tests/core/exclusion-comments-reach-every-condition.test.ts` · `it('an undocumented exclusion fails the build (bug 0039)')` pins the **`eess-ts` fork**, which has its own copy of the filter. `packages/core/tests/exclusion-reason-and-nesting.test.ts` pins the **kernel's** promotion by driving `applyFilters` with a reason-free directive and asserting the finding's severity and unsuppressability (cited by file — see the row above for why a kernel test cannot be cited by title). And `scripts/nonvacuity/bad-undocumented-waiver.mjs`, claimed by `check:corpus`, proves it end to end through `eess-md`, one of the four dialects that do **not** fork the filter. | `gated` |
| `MaskNonComment` is nameable from wherever `parseExclusionComments` is    | 1    | `packages/core/tests/public-surface-is-nameable.test.ts` — it failed on the first implementation of this ADR, which had put the type behind `/internal`; that is this row's own red-first evidence. By file, for the same reason as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `gated` |
| The kernel gains no dependency in the process                             | 1    | `check:integrity`'s phantom-dependency check: `@nielspeter/eess` declares no dependencies, so any bare import in its `src/` fails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `gated` |

### A correction, 2026-09-03

The row above previously cited the kernel test file as pinning "the kernel half
that all five dialects now share". It did not. That file tested the **parser** —
that a reason-free waiver applies and produces a warning — which is the
fail-**open** half. The promotion in `applyFilters` that makes the decision
fail-closed was asserted only by the `eess-ts` test, against `eess-ts`'s own
forked copy of the filter. So the clause was `gated` on the one dialect that does
not depend on the kernel's implementation, and unproven for the four that do.

Measured when it was found: deleting the promotion left the entire kernel suite
green, 206 tests passing. [Bug 0238](../work/bugs/fixed/0238-the-kernels-reason-free-waiver-promotion-is-untested.md)
records it and its fix; the row now names a mechanism per engine. This is
[bug 0189](../work/bugs/fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md)'s
shape a second time — a row green over a different path than the clause it
states — which is why the correction is recorded here rather than edited away.
