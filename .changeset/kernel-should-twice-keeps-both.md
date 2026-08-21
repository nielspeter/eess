---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess)** — a second `.should()` no longer discards the
first assertion (bug 0156, the kernel half). 0.x, so a minor signals it.

The kernel's `RuleBuilder.fork()` cleared the condition list, so
`.should().X().should().Y()` silently dropped `X`. A rule that asserted two
things asserted one, and nothing reported the loss — a false green in the
engine itself.

**Read this if you write rules with `eess-md`, `eess-mermaid` or
`eess-gherkin`.** All three extend the kernel's `RuleBuilder`, so all three
carried this. On upgrade, a rule spelled with two `.should()` calls starts
enforcing the assertion it was silently dropping, and **can report violations it
never reported before**. Those findings were always real; they were being
discarded. Check each one on its merits rather than re-baselining.

The dialects are named at `minor` rather than inheriting a `patch` because the
change is observable in their output (bug 0185).

**`eess-ts` is named too, and it is the one dialect this does not actually
change.** It carries its own copy of the builder stack, already fixed, so its
behaviour is identical before and after. `check:release` required it anyway and
is right to: the rule reads the dependency graph, and eess-ts really does depend
on `@nielspeter/eess`, so an adopter of eess-ts would otherwise inherit this
release as a silent patch. That the declaration over-states what changes _for
that one package_ is a consequence of the duplication, not of the rule — the
gate cannot know a dialect quietly stopped using the kernel module it depends
on. Recorded rather than waived.

**Why it was one-sided.** `eess-ts` got this fix when plan 0165 copied the
upstream engine in; the kernel did not, and nothing recorded the split. The
duplication that allows it is [plan 0188](https://github.com/nielspeter/eess/blob/main/work/plans/0188-unify-the-duplicated-engine-modules.md).
