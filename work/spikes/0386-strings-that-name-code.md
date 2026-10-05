# Spike 0386: strings that name code — should eess resolve them or refuse?

Measured 2026-10-05, prompted by
[spike 0385](./0385-what-makes-an-exclusion-switch-a-rule-off.md) and a question from the
maintainer: patterns and globs look like a main source of errors — should eess remove them and
follow another path?

## The question

Every eess rule takes strings that name code: a folder glob, a base class, an import target,
an exclusion, a cited test title. When such a string means something other than its author
intended, the rule does not fail — it checks the wrong thing, or nothing, and reports green.
That is the false green eess exists to prevent. The candidate path was **resolve or refuse**:
every string that names code must resolve to something the checker can see, or the rule
refuses with a finding.

This spike asks whether that is the answer, input by input, rather than as a slogan.

## Inventory

Every public input that takes a string, glob or regex (about 140 functions across all
packages, from the builder, predicate, condition and helper signatures), grouped by **what the
string names** — because that decides whether the checker can know the set of possible targets.

| group                      | examples                                                                                                                           | names                     | can the target set be known?                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ |
| **A. path globs**          | `resideInFolder/File`, `havePathMatching`, `layer(name, glob)`, `withStringArg(i, glob)`                                           | files                     | yes — the project, and the disk                  |
| **B. import-target globs** | `importFrom`, `notImportFrom`, `onlyImportFrom`, `dependOn`, `typeOnlyFrom`                                                        | modules, paths, packages  | partly — a package can be external or absent     |
| **C. exact symbol names**  | `extend`, `implement`, `extendType`, `haveDecorator`, `haveMethodNamed`, `call('x')`, `newExpr`, `jsxElement`, mermaid class names | declarations              | mostly — not a symbol from an untyped dependency |
| **D. naming conventions**  | `haveNameMatching`, `…StartingWith/EndingWith`, `…Matching(re)`                                                                    | an open set of names      | not applicable — the pattern _is_ the rule       |
| **E. exclusions**          | `.excluding()`, `eess-exclude` comments                                                                                            | the rule's own violations | yes — at run time                                |
| **F. doc references**      | ADR paths, `it()` titles, `path:line` pointers, links                                                                              | files, tests, lines       | yes                                              |
| **G. content matchers**    | `comment(re)`, `expression()`, `access(chain)`                                                                                     | code text                 | not applicable                                   |

## How much each group is used

Counted as call sites:

|                                           | A   | B   | C   | D   | E   | G   |
| ----------------------------------------- | --- | --- | --- | --- | --- | --- |
| this repo's `*.rules.ts` (6 files)        | 17  | 8   | 2   | 0   | 7   | 1   |
| shipped presets and rule packs (17 files) | 29  | 11  | 15  | 6   | 2   | 4   |
| docs and READMEs (54 files)               | 195 | 40  | 280 | 68  | 36  | 15  |

Path globs are what real rule files mostly say; the docs teach exact names most.

## Where the bugs came from

Bug records whose **title** names the group (approximate — a keyword match over 265 records;
it undercounts, since many records name a symptom rather than the input):

| group             | bugs | High  | open |
| ----------------- | ---- | ----- | ---- |
| A. path globs     | 20   | 6     | 8    |
| B. import globs   | 1    | 0     | 1    |
| C. exact names    | 12   | **8** | 6    |
| E. exclusions     | 10   | 3     | 6    |
| F. doc references | 16   | 4     | 12   |

## What each group already does, and what is missing

**A — already resolve-or-explain.** A dead glob is reported (ADR-010 floor, dead-glob findings,
the disk walk, the route table). The 20 bugs are bugs in that machinery — and the machinery is
expensive because of **absence rules**: `.notExist()` must be allowed to match nothing,
because nothing is the point. Resolve-or-refuse cannot apply to them as stated, and the work
since bug 0355 is how eess tells "nothing because the code is gone" from "nothing because the
glob is broken". **Removing globs** would remove the main way adopters say where a rule
applies, break every rule file, and still leave the absence question. Not recommended.

**F — already resolve-or-refuse**, since 0111 left title resolution to the test AST. Its open
bugs are edge cases of resolution (0380–0382), not the absence of it.

**D and G — patterns by nature.** A naming convention is meant to match an open set; the guard
is the ADR-010 floor (a selection that matches nothing is reported). Nothing to resolve.

**B — rarely a source of bugs** (one, open). Absence-shaped by nature (`notImportFrom`), like A.

**C — the worst ratio: 8 High of 12.** Every one compared a name as **text** where it should
have resolved it — 0295, 0296, 0376 and 0383 this week. Each fix has moved toward resolving the
name to a declaration and following the relation from there. What is still missing is the
refusal: a name that resolves to **no declaration** — a typo in a selector inside an `.and()`
chain, a base class that does not exist — is not reported; only a fully empty selection is.
Resolving needs a fallback for names the checker cannot see (an untyped dependency, bug 0373):
there the honest answer is to disclose, not refuse.

**E — the one group with no resolution at all.** An exclusion is never checked against
anything that makes it fail:

- names **nothing** (stale): a stderr warning, which ADR-009 says agents do not read;
- names **everything** (`/.*/`): silent — bug 0233, the shape measured in production;
- names **more than it says** (one pattern absorbing several subjects): silent — bug 0298.

Measured on this repo: **0** stale exclusions across `check:arch`, `spec`, `family`, `diagram`,
`baseline` and `guardrails`; **0** universal patterns in any rule file, preset or doc
([spike 0385](./0385-what-makes-an-exclusion-switch-a-rule-off.md)). So making both a finding
costs this repo nothing; what it costs adopters is not measured.

## Conclusion

**Resolve-or-refuse is the right principle, but not as one rule.** It already holds where the
target set is knowable and an empty match is wrong (F, and A outside absence rules). It cannot
hold for absence rules (A, B) or conventions (D), which match nothing or an open set by design.
It is missing exactly where the bugs say it is missing:

1. **Exclusions (E): resolve against the rule's own violations.** A stale exclusion (matches
   none) and a universal one (matches a probe it could not have been written for — spike 0385)
   are configuration findings, not warnings or silence. A stale exclusion red after its finding
   is fixed is the ratchet closing: the manifesto's "ratchet it closed", enforced. Whether a
   pattern absorbing several subjects must say so stays with 0298.
2. **Exact names (C): resolve, and refuse what resolves to nothing — disclose what cannot be
   seen.** A name that matches no declaration anywhere the checker can see is a finding; a name
   behind an unresolvable boundary (an untyped dependency) is disclosed, per ADR-016's "a bound
   limits knowledge, never the verdict". The relation-walking bugs (0373, 0375, 0377, 0383)
   are the same principle's backlog.
3. **Path globs (A, B): keep them.** They already resolve or explain; absence rules are why the
   explanation is needed. Their bugs are fixed where they are, not by a new path.
4. **Patterns that are the rule (D, G): out of scope**; the ADR-010 floor guards them.

**Not answered here, and needed before a build:** what (1) and (2) cost adopters — how often a
real codebase carries stale exclusions, or names a symbol that resolves to nothing on purpose.
This repo's rule files say "nothing", but they are written by the people who wrote eess.

## Proposed next steps

- A **Proposed** ADR stating the principle per group, as above — so 0233, 0298, 0373 and the
  heritage bugs point at one decision instead of each carrying a version of it.
- After the ruling: 0233 built as point 1 (it is the measured production case), with the stale
  half as its own change, since it turns an existing warning into a finding.

## Review — 2026-10-05: not ready to rule as drafted

Architecture, product and enforcement review read this spike, spike 0385 and the draft ADR-018.
All three: **do not accept as drafted.** What they found, verified where cheap:

- **The universal probe is weaker than claimed.** It catches a pattern that matches arbitrary
  text (`/.*/`, `/./`, `/^[\s\S]*$/`). It misses patterns that match every real violation
  without matching arbitrary text: a pattern on every file path (`/\//`, `/\.ts$/`), a pattern
  on a message template (`notImportFrom` words every finding "… which matches forbidden …", so
  `.excluding(/forbidden/)` switches it off), and a string equal to a common element
  (`.excluding('CatchClause')`, recorded in the 0.7 migration notes). The production case in
  proposal 007 says "a catch-all", not which pattern — calling it universal was an inference.
  Refusing `/.*/` teaches the next-shortest path.
- **The stale half reverses a recorded decision.** The kernel's `isFaultPosition`
  (`packages/core/src/glob-site.ts`) and proposal 006 hold that an exclusion matching nothing is
  remedy-optional and never a fault, and `silent()` exists for exclusion lists shared across
  workspaces (`docs/recipes.md`). An unsuppressable stale finding with `silent()` exempting
  nothing removes that public API and gives the shared-list recipe no achievable remedy. This
  repo has the shape too: `GENERATED` and `ENTRY_POINTS` are shared by two rules each.
- **Rule 2 contradicts itself and ADR-016.** `call()`, `newExpr()` and `jsxElement()` are text
  matchers (`packages/ts/src/helpers/matchers.ts`), mostly used in bans — `notContain(call('eval'))`
  — where matching nothing is the goal, the same absence case rule 3 exempts for globs. Position
  and combinator decide whether "matches nothing" is a fault (`or(dead, live)` is a working
  rule), which the kernel's glob-site tree already encodes. "Disclosed, not refused" contradicts
  ADR-016 clause 1, which bug 0373 names as its standard. And none of the group-C bugs is a case
  a refusal would have caught: they are relation-walking bugs ADR-017 already decided.
- **Group C mixed populations.** Its "8 High of 12" combines symbol references (`extend`,
  `implement`) with text matchers that belong beside group G, so the headline does not stand.

**What survives:** spike 0385's lens — universal, scoped and named exclusions differ by whether
the rule can still fail — and the decision to keep path globs. **What is open is deeper than
drafted:** no static test separates a switched-off rule from a scoped one in general, because
`.excluding()` matches free text against element, file _and_ message. The real choice for
exclusions is between keeping free-text patterns and detecting the obvious catch-alls (with
gaps), and giving exclusions a structured form that resolves (an exact element or file, checked
against the rule's violations, with scoping done by resolved `.that()` selectors instead).
That is the maintainer's to decide; ADR-018 is rewritten after it.

The full reviews: architecture, product and enforcement, in the session's scratchpad.

## Research for the exclusions ruling — 2026-10-05

The maintainer chose **structured exclusions, with a regex allowed only alongside a reason** —
"if it is a well-researched answer". Four questions decide whether it is.

### 1. Can real exclusions be expressed structurally?

**This repo: 7 of 7.** `ENV_ADAPTERS` (2 files), `REGISTRY_HOMES` (2 files) and
`ENTRY_POINTS` (about 25 files) are regexes that spell out specific files — exact file lists.
`GENERATED` is a folder — the same file already scopes another rule out of a folder with
`.that().satisfy(not(inFolder('**/src/cli/**')))`. `eess/max-methods` excludes nine named
classes — exact element names.

**Docs, tests, presets and rule packs, 86 literal patterns:**

| shape                                         | count | structured form                                                       |
| --------------------------------------------- | ----- | --------------------------------------------------------------------- |
| exact element name (`'Asset.getImageUrl'`)    | 40    | exact element                                                         |
| exact file path (`'src/components/Icon.tsx'`) | 13    | exact file                                                            |
| exact cycle edge (`'a -> b'`)                 | 11    | exact element                                                         |
| name-shaped regex (`/Compat$/`, `/Helper$/`)  | 10    | a naming convention in `.that()`: `not(haveNameEndingWith('Compat'))` |
| path regex (`/\.d\.ts$/`, `/images\.ts/`)     | 6     | `.that()` folder scope, or a file list                                |
| partial-message regex (`/extractCount/`)      | 3     | **regex with a reason**                                               |
| universal (`/.*/`)                            | 3     | all in tests, on purpose                                              |

Leaving out the three deliberate `/.*/` test fixtures, **80 of the other 83** patterns have a structured form and 3 need the regex escape. (The 86 include test files, which use `.excluding()` the way an adopter would; they are a proxy for adopters, not a measurement of them.)

### 2. Can every dialect scope by selection?

The kernel's `not()` and `.satisfy()` work in every dialect; `resideInFolder` exists in eess-ts
and eess-md and composes with `not()`. eess-mermaid and eess-gherkin have no folders — their
subjects are diagram nodes and scenarios — so they scope by name, which they already support.
Moving scope into `.that()` also fixes ADR-010's denominator: the selection shrinks, so
`examined` counts what the rule actually checks, instead of a pre-exclusion count.

### 3. Is a violation's `element` something a person can name?

Only for named declarations. Measured: for a module rule, `element` is the generic
`'SourceFile'` and `file` is the absolute path. That exposed a live defect: `docs/recipes.md`, and the JSDoc example on `noDeadModules` in the
`hygiene.ts` rule pack, teach `.excluding('index.ts', 'main.ts')`, and a
string matches by equality, so it **never matches** — the entry points still report, with a
stderr warning. It fails closed, so it is not a false green, but it leaves an adopter reaching
for `/index/` or `/.*/`: the path from a free-text exclusion to a switched-off rule, shipped in
the docs. Filed as [bug 0387](../bugs/0387-a-basename-exclusion-never-matches.md). So the
structured form must be **a file path, resolved against the project**, or **an element name**
where the element is a declaration — not one string compared to three fields.

### 4. Prior art

Tools that faced this converged on the same pieces:

- **Scope in the rule, not an ignore list** — dependency-cruiser rules carve exceptions with
  `pathNot` inside the rule's `from`/`to` selection, "rather than … separate ignore lists".
- **No blanket suppression** — ESLint's `eslint-comments/no-unlimited-disable` forbids an
  `eslint-disable` that names no rule, because it "may cause to overlook some ESLint warnings
  unintentionally".
- **A suppression carries a reason** — `eslint-comments/require-description` requires
  `-- <why>` on every directive.
- **A suppression that suppresses nothing is reported** — TypeScript added `@ts-expect-error`
  (3.9) because `@ts-ignore` "does nothing if the line is valid"; ESLint's
  `reportUnusedDisableDirectives` does the same, at `warn` by default.
- **The counterexample is eess's current design** — ArchUnit's `archunit_ignore_patterns.txt`
  matches regexes against the violation message, and "if all violations match ignore patterns,
  the rule passes": the switched-off-rule shape, with no guard.

### Conclusion

The research supports the choice. Concretely:

1. **Scope moves to `.that()`.** A folder or a naming convention is a selection, resolved like
   any selector (dead-glob and ADR-010 floor included), and the denominator becomes honest.
2. **`.excluding()` takes exact targets** — a file path resolved against the project, or an
   element name — and a target that names nothing real is a finding (this would have caught
   0387). That is resolve-or-refuse, applied where the target set is knowable.
3. **A regex is an explicit escape carrying a reason**, reported with the finding it waives
   (as an `eess-exclude` comment's reason is), and probed for patterns that match arbitrary
   text. 3 of 83 measured patterns need it.
4. **Out of this ruling, still open:** whether a stale exclusion is a finding (the kernel's
   `isFaultPosition` says no today, and `silent()` depends on it — the ESLint and TypeScript
   precedents say report it; adopter cost unmeasured), and rule 2 of the draft ADR (names).

**Cost, measured:** all 7 of this repo's exclusions and 83 documented patterns migrate; the
regex-without-reason form becomes a configuration error, which is a breaking change in the
kernel and every dialect. **Not measured:** adopters' own exclusions.

Sources: [eslint-comments no-unlimited-disable](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-unlimited-disable.html),
[require-description](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/require-description.html),
[ESLint unused disable directives](https://eslint.org/docs/latest/use/configure/rules#report-unused-eslint-disable-comments),
[TypeScript 3.9 `@ts-expect-error`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html),
[ArchUnit user guide](https://www.archunit.org/userguide/html/000_Index.html),
[dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).

## Adversarial review of the research — 2026-10-05: not ready to rule

An independent reviewer tried to break the research above. It did, in four places, and the
claims above stand corrected by this section rather than being rewritten:

- **Bug 0387 was backwards.** The probe behind it used `notExist()`, whose `element` is
  `'SourceFile'`. The condition the docs pair with `'index.ts'`, `noDeadModules`, reports the
  **basename**, so the documented exclusion matches — and over-matches: it also waives every
  other `index.ts` (measured: an unnamed `src/feature/index.ts` disappears). Fail-open, not
  fail-closed; 0387 is rewritten and rated High. Point 2's claim that resolving targets "would
  have caught 0387" falls with it, and resolving `'index.ts'` as a path would red every adopter
  who copied the recipe.
- **Two prior-art claims were wrong.** The dependency-cruiser quote ("rather than … separate
  ignore lists") came from a page summary, not the page; the rules reference recommends the
  opposite — its `ignore-known` mechanism, a known-violations file made with `--baseline`,
  with `pathNot` as an alternative. ArchUnit was misquoted and miscast: its guide recommends
  narrowing the `that(..)` clause first, ships `FreezingArchRule` — record existing violations,
  shrink the store as they are fixed — and fails an empty `should` by default
  (`failOnEmptyShould`), the ADR-010 floor. The ESLint rules cited are a community plugin, not
  ESLint core.
- **"Exact targets" do not close 0233.** A real name can still switch a rule off: a **kind**
  (`'CatchClause'`, `'<button>'`), a **container** (a function's name waives every current and
  future `eval` in it — bugs 0159/0338's identity problem), a **shared name** (`TerminalBuilder`
  exists in core and ts; this repo's `max-methods` exclusion waives both), or the **only
  target** of a single-target rule (`tsconfig().excluding('strict')` cannot fail — 0233's own
  symptom). A narrow `.that()` scope that selects 1 of 1000 passes the floor, and
  `haveNameMatching(regex)` moves the unguarded regex into `.that()`.
- **The census understates the regex residue.** Dependency and slice edges carry the forbidden
  target only in the message; call-site families waive by argument prefix; positional
  identities (0338) cannot be named; `CorpusOptions.ignore` and `FilesOptions.ignore` exclude at
  load time with no reason. eess-md and eess-mermaid had no `.excluding()` sites, so "every
  dialect can scope by name" was asserted, not measured. `ENTRY_POINTS` is 29 files, derived
  from the packages' `exports`/`bin` maps.

**What the review points to instead.** The real question is not "pattern or name" but **what a
waiver identifies**: a container (a file, a class, a function — which waives the future too) or
a **violation** (which waives exactly what was found, and goes stale when it is fixed). The tools
that faced this for longest converged on the second for known violations — ArchUnit's
`FreezingArchRule`, dependency-cruiser's `ignore-known` — and on narrowing the selection for
scope. eess already has the violation-identity mechanism: the baseline. That reframes the choice:

- **scope** belongs in `.that()`, resolved and counted (the ADR-010 floor, which would need a
  "selected far less than the project" signal to catch a narrow scope);
- **known violations** belong in the baseline, waived by identity and ratcheted closed;
- `.excluding()` may then have no job left that one of those does not do better — or a small
  one (a waiver that must carry a reason) — and **its future is the decision**.

That depends on violation identity being trustworthy, which is exactly what bugs 0159 and 0338
say it is not yet. So the order is likely: settle identity (0159, 0338), then decide
`.excluding()`'s role. Not ready to rule on until that is laid out and measured.
