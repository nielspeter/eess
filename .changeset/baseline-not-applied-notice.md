---
'@nielspeter/eess-ts': patch
---

`eess-ts check --baseline` / `--changed` no longer fail in silence when a rule file
reports its own findings — bug 0199.

A rule file that calls a terminal at module scope prints its violations itself,
before the CLI ever sees them, so no CLI-side filter can act on that output. With
`--baseline` in play the result was a red build listing violations the user had
already accepted, and nothing in the output mentioning the baseline at all.

Measured against a real `@nielspeter/ts-archunit` baseline: **all 5 entries matched**
and the build still exited 1 with every one of them printed. The hashes were never
the problem; the printed output simply never reached the filter.

The run now reports it as `eess-ts: reporting`, names the baseline **file** (not a
flag you may have set in `eess-ts.config.ts` and never typed), and gives the remedy:
move the rules into `export default [rule1, rule2]`, or — if they come from a preset
— pass `report: 'builders'`.

**Scope, stated because it is narrower than it sounds.** The notice fires only when
a CLI-side filter was actually in play (`--baseline` or `--changed`) _and_ the rule
file really did print something. A plain `eess-ts check` with no filter gets no
notice, even though the same underlying leak is present — that case shows up as
findings printed twice, and it is tracked separately, unfixed.

**Migrating from `@nielspeter/ts-archunit`?** Its presets returned builders and never
enforced inline, so a rules file carried over verbatim has no `report: 'builders'`
and will hit this. Baseline files themselves transfer unchanged — same
`hashVersion`, same `arch-baseline.json`, byte-identical hashing.
