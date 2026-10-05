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
