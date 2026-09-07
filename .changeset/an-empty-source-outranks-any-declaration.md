---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** an empty source can no longer be declared away, and it gets its own finding

ADR-014 §4 states the precedence: "an empty source (`sourceEmpty`) outranks any declaration and names
the source." The evidence gate honoured `declaredEmpty` before it ever read `sourceEmpty`, so a
hand-assembled receipt could set both and pass. Measured before this change:

```js
finishPreset(collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }))
// -> green
```

That is a verdict declaring away a source that loaded nothing — the escape hatch the comment beside
that branch claimed this ADR had closed. It now reds, and so does the same receipt with `notRun`.

**New finding id: `emitter/source-empty`.** An empty source previously produced the generic
`emitter/pass-without-evidence`, whose remedy is "widen the selection, or declare it" — both wrong
here, because no declaration can make an absent source into evidence. The new finding names the
source and says so: fix the project, the tsconfig, or the glob. If you match on `ruleId`, this case
moves from `emitter/pass-without-evidence` to `emitter/source-empty`.

**The zero-examined message no longer names a preset's option.** It said `expectEmpty: true in a
preset's report options`, which ADR-014 §4 forbids at a seam that is frequently not a preset — the
same defect that made `checkAll([])`'s remedy unreachable. It now names what a hand-assembled receipt
can actually do: `collectResult(violations, { examined, declaredEmpty: true })`, or `.expectEmpty()`
on a builder.

**Every dialect is named at `minor` because every dialect ships this break.** They depend on the
kernel, so an adopter installing one of them takes the new precedence without asking — and
changesets propagates a dependency bump as a patch regardless, which is the release a `^0.x` range
accepts silently (bug 0185's shape).

**Not affected:** every builder-produced verdict. A terminal that loaded nothing already carried its
own source finding and exits before this gate. The population this changes is the hand-assembled
receipt, which is what ADR-014's gate exists for.
