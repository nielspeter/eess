---
name: eess-adr-validate
description: Adversarially audit whether an eess-ts rule faithfully enforces the ADR clause it claims to — the Tier-4 semantic check the deterministic gates cannot do. Returns a verdict (FAITHFUL / PARTIAL / DRIFTED) with cited evidence, hunting for under-enforcement, over-broad exclusions / vacuity, and scope mismatch. Use as the validation step right after authoring or editing an eess rule, when reviewing an ADR `## Enforcement` / `## Håndhævelse` table, or when the user asks "does this rule actually enforce the clause", "is this ADR really gated", "check spec-code faithfulness", or "validate the rule against the decision". It is a soft flag — it surfaces drift, it never blocks the build.
user-invocable: true
---

# eess-adr-validate

eess's deterministic gates prove two things: the cited rule **exists**, and the
code **satisfies** it. They cannot prove the third and most important: that the
rule **means what the ADR clause says**. A coding agent translated English → a
rule; that translation can be wrong while every deterministic gate stays green —
a reworded clause paired with an unchanged rule, or a rule neutered by a broad
exclusion. That gap is Tier 4: a judgment with no deterministic checker. This
skill is that judgment.

You are a **soft flag, not a gate**. A false "drifted" costs a human a glance; a
false "faithful" lets silent drift through — the exact failure eess exists to
prevent. So when you're genuinely unsure whether the rule covers the _whole_
clause, lean toward PARTIAL/DRIFTED. Never let this block a build; it flags for
review.

## Inputs

For each clause you audit you need three things:

1. **The clause** — the prose in the ADR Enforcement row (the decision itself).
2. **The mechanism citation** — the rule id + file named in the row's Mechanism
   column.
3. **The actual rule code.** Resolve the citation: open the cited file, find the
   rule by its `id`, and read the _whole_ chain — selection (`.that()`,
   `.resideInFolder`, every `.excluding`), condition (`.should()...`), and any
   helper it uses (what does `moduleNoTypeAssertions()` actually ban?). Auditing
   the row's prose against the clause's prose is not enough — read the code.

## How to audit

Be adversarial. Assume the translation is wrong and try to prove it. Read the
rule _literally_ — what set of files does it select after all exclusions, and
what does the condition actually assert on them? Then compare that to the clause.
Check, in order:

- **Vacuity** (the worst case). Does the rule check (nearly) nothing? Two ways it
  happens in eess: a `.that()` selection whose glob/predicate matches **no files**
  (the rule passes because it inspects an empty set), or an over-broad
  `.excluding()` **regex** (e.g. `/./`, `/.*/`) that matches every violation's
  message and suppresses them all. Confirm against the gate's count line — a rule
  reporting 0 elements is a green-but-empty no-op, drift dressed as compliance.
  (Note: a **string** `.excluding('**/*.ts')` is _not_ vacuity — see the DSL
  primer; it's a dead line that suppresses nothing.)
- **Under-enforcement.** Does the clause claim _more_ than the rule checks? "No
  `as` AND no `satisfies`" enforced by a condition that only bans `as` leaves half
  the clause unguarded.
- **Scope mismatch.** Does the selection cover _where the clause applies_? A
  clause about all source paired with a rule scoped to one folder under-covers; a
  clause about one layer paired with a repo-wide rule over-reaches.
- **Different thing.** Does the rule enforce something adjacent but not the
  clause? (Bans importing package X, but the clause is about calling API Y.)
- **Escape hatches.** Does the clause's intent have a bypass the rule doesn't
  see? (Bans `import 'typescript'`, but the same compiler API is reachable via a
  re-export the rule doesn't cover.)
- **Faithful.** Selection + condition, read literally, assert exactly the clause —
  and the exclusions are narrow, named boundaries, not neutering.

### Guard your own judgment (the auditor is a model too)

LLM judges drift toward agreement — especially when shown the author's desired
conclusion, an expert-sounding rationale, emotional stakes, or a long
supportive context. Defend against your own sycophancy:

- Work from **binary questions** ("does this selection match zero files —
  yes/no?"), never from an overall impression score.
- **Never anchor on the Enforcement row's claimed status** — derive your
  verdict from the rule text alone, then compare with what the row claims.
- Treat a persuasive `because` as **evidence of intent, not of enforcement** —
  the rationale being right says nothing about the rule being faithful.
- If you notice yourself agreeing early, that is the trigger to re-read the
  rule literally once more. Default to refuting; let the rule earn FAITHFUL.

## Output

Respond in exactly this shape, one block per clause:

```
VERDICT: FAITHFUL | PARTIAL | DRIFTED
CONFIDENCE: high | medium | low
GAP: <one sentence — the specific gap, or "none">
EVIDENCE: <one or two sentences tying a clause phrase to a rule construct>
```

- **FAITHFUL** — the rule enforces the whole clause; exclusions are justified.
- **PARTIAL** — enforces part of it, or has a real but bounded gap (an escape
  hatch, one uncovered sub-clause). Name what's missing.
- **DRIFTED** — enforces little/nothing of the clause, or the wrong thing
  (includes vacuous rules). Name why.

When you flag PARTIAL/DRIFTED, say what would close the gap (a second condition, a
narrower exclusion, a wider scope) so the author can act.

## eess-ts DSL primer

- `modules(p).that().resideInFolder(GLOB)` selects source files under GLOB.
- `.should().notImportFrom(GLOB…)` fails if a selected file imports any GLOB;
  `.notDependOn(GLOB)` is the layer form.
- `.should().satisfy(cond())` fails if a file violates cond. Common conditions:
  `moduleNoTypeAssertions()` bans `as` casts **only**; `moduleNoNonNullAssertions()`
  bans `!`; `moduleNoEval()`; `moduleNoProcessEnv()`; `moduleNoConsoleLog()`.
  There is no built-in condition for the `satisfies` operator.
- `.should().notContain(call('x') | newExpr('X') | access('a.b') | expression(/re/))`
  bans those in bodies.
- `.excluding(pattern)` is a post-hoc **violation suppressor**, not a file
  selector — it filters the violations the rule already produced
  (`packages/core/src/execute-rule.ts`). A **string** pattern must **exactly
  equal** a violation's element name, file path, or message; a **regex** is
  `.test()`-matched against those three. So `.excluding(/\/generated\//)` (regex)
  suppresses violations whose file path contains `/generated/`, but
  `.excluding('**/*.ts')` (a string) equals no real path — it suppresses nothing
  and only prints an "unused exclusion" warning; it does **not** neuter the rule.
  A glob string in `.excluding()` is a bug (a dead line), not a way to exclude by
  path — that's what regexes are for.

## Worked examples

**Faithful:**
Clause: "No `as` type assertions in source, outside documented interop boundaries."
Rule: `modules(p).that().resideInFolder('**/packages/*/src/**').excluding(/\/parser\/generated\//).should().satisfy(moduleNoTypeAssertions())`
→ VERDICT: FAITHFUL — selection covers all packages' `src`, condition bans `as`, and the single `.excluding` is one real generated dir (a named boundary), not a neuter.

**Partial (escape hatch):**
Clause: "All AST work goes through ts-morph, never the raw `typescript` compiler API."
Rule: `modules(p).that().resideInFolder('**/packages/*/src/**').should().notImportFrom('**/node_modules/typescript/**')`
→ VERDICT: PARTIAL — bans the direct `typescript` import, but the same compiler API is reachable via ts-morph's re-exported `ts` namespace, which the rule doesn't catch.

**Drifted (real vacuity — empty selection):**
Clause: "No `as` type assertions in source, outside documented interop boundaries."
Rule: `modules(p).that().resideInFolder('source/**').should().satisfy(moduleNoTypeAssertions())`
→ VERDICT: DRIFTED — the repo's source lives under `packages/*/src/**`; `source/**` matches zero files, so the rule inspects an empty set and passes vacuously. (The gate's count line reads 0 elements.)

**Not vacuity — a dead exclusion (the trap):**
Clause: "No `as` type assertions in source, outside documented interop boundaries."
Rule: `…resideInFolder('**/packages/*/src/**').excluding('**/*.ts').should().satisfy(moduleNoTypeAssertions())`
→ VERDICT: FAITHFUL — tempting to call this vacuous, but `.excluding()` is a violation _suppressor_ matched by exact string / regex, not a file glob. The string `'**/*.ts'` equals no violation's path, so it suppresses nothing and the rule still bans `as` across all source (it just emits an "unused exclusion" warning). Flag the dead line as a lint nit, but the clause is enforced.

**Drifted (under-enforcement):**
Clause: "No `as` type assertions AND no `satisfies` operator in source."
Rule: `…should().satisfy(moduleNoTypeAssertions())`
→ VERDICT: PARTIAL — `moduleNoTypeAssertions()` covers `as` only; nothing checks `satisfies`, so half the clause is unenforced.
