---
'@nielspeter/eess-ts': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': patch
---

**Breaking** — the published barrels stop re-exporting 37 internal helpers.

These were on the entry point but were never API: nothing outside their own
package's `src/` referenced them, no `docs/` page or README taught them, and every
test that used one reached past the barrel into the source module already. Measured
before the change: 253 of 664 exported symbols appeared in no documentation at all,
and these 37 were the subset that no reader could have found and no consumer could
have learned to use.

`eess-mermaid` loses the free predicate/condition functions — `haveNameMatching`,
`areAbstract`, `notDependOnStereotype` and the rest of that block. The documented
surface is the fluent builder that wraps every one of them
(`classes(d).that().areAbstract()`), per ADR-003; the free functions were the
plumbing behind it. Names like `haveNameMatching` looked documented only because
`docs/classes.md` and `docs/api-reference.md` are the **TypeScript** dialect's pages
and the names collide.

`eess-ts` loses glob-evaluator, disk-set, project-registration and diagnosis
internals. `eess-md` loses nothing (`presentExternalRoots` was removed and then
restored — see below).

Kept deliberately, because "unreferenced in this repo" is not the same as
"accidental" for a library: `taskItems()` and `TaskItemRuleBuilder` are a builder
entry point exactly like `docs()` and `links()`, `RowMatchOptions` is a **required**
argument to `rows()`, and `parseClassDiagram` throws the already-documented
`MermaidUnitParseError`. Seven more went back on the barrel because removing them
turned them from undocumented API into dead code, which is a different decision than
this one — they stay visible as undocumented surface in `check:docs-code` rather
than being quietly deleted.

`eess-crossvalidate` is named here because it peer-depends on all three dialects.
It imports none of the removed symbols and needs no change — but a consumer reading
its changelog should see the break named, not "Updated dependencies" (bug 0185).

## Removed with no replacement — the full list

These 37 are dialect-local. They were never kernel symbols, so
`@nielspeter/eess/internal` does **not** have them and no import path reaches them any
more. If you used one, the fluent builder is the supported route.

**`@nielspeter/eess-ts` (19)** — FAULT_ADVICE, ON_DISK_ADVICE, buildDiskSet, collectCalls, collectObjectLiteralFunctions, diagnoseGlob, emptyProjectAdvice, fromObjectLiteralFunction, globSitesOf, isDeadGlobTree, isDeadSite, isStrictFamily, isTypeOnlyReExport, loadedNothing, registerProjectRoots, registerRootCompilerOptions, resolveFlag, splitGlobArgs, verbatimModuleSyntaxFor

**`@nielspeter/eess-mermaid` (18)** — areAbstract, conditionHaveStereotype, dependOn, extendClass, extendName, haveAtLeastOneMethod, haveMemberNamed, haveMethodNamed, haveNameEndingWith, haveNameMatching, haveNameStartingWith, haveNoMembers, notDependOn, notDependOnStereotype, notExist, notExtendStereotype, notHaveStereotype, predicateHaveStereotype

The mermaid list is the free predicate/condition block in full. Every one is available
as a builder method (`classes(d).that().areAbstract()`, `.should().notHaveStereotype(x)`)
— that is the documented surface per ADR-003, and it is unchanged.

Two eess-ts entries are worth calling out because their siblings survived:
`collectCalls` went while `fromCallExpression` from the same module stayed, and
`fromObjectLiteralFunction` went while `fromFunctionDeclaration` and
`fromMethodDeclaration` stayed. In both cases the survivor is reachable from a
documented path and the removed one was not.
