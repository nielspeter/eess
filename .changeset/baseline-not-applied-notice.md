---
'@nielspeter/eess-ts': patch
---

`eess-ts check --baseline` no longer fails in silence when a rule file reports its
own findings — bug 0199.

A rule file that enforces at module scope (a preset called without
`report: 'builders'`, whose ADR-008 default is `'throw'`) prints its violations
itself. Those lines are written by the rule file's **own** module instance — jiti
gives it a separate registry — so they never pass through the CLI's filters. With
`--baseline` in play the result is a red build listing violations the user has
already accepted, and nothing in the output mentioning the baseline at all.

Measured against a real `@nielspeter/ts-archunit` baseline: **all 5 entries
matched** and the build still exited 1 reporting 2 of them. The hashes were never
the problem; the printed output simply never reached the filter.

The run now says so, and names the one-line remedy:

```
  Rule: eess-ts: baseline

  This rule file reported findings itself, and `--baseline` was NOT applied to
  them … Fix: Pass `report: 'builders'` to the preset(s) in this file.
```

**Migrating from `@nielspeter/ts-archunit`?** This is the shape you will hit: its
presets returned builders and never enforced inline, so a rules file carried over
verbatim has no `report: 'builders'` and its first eess-ts run reds against a
baseline that is, in fact, still perfectly valid. Add `report: 'builders'` to the
preset calls. `eess-ts init` scaffolds that form already.

Baseline files themselves transfer unchanged — same `hashVersion`, same
`arch-baseline.json`, byte-identical hashing.

The underlying cause — CLI reporting state not crossing jiti's module registry,
which also affects `--changed` and comment suppression — is tracked separately and
not fixed here.
