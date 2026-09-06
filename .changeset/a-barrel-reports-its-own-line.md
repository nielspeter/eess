---
'@nielspeter/eess-ts': patch
---

`haveNoUnusedExports()` anchors a finding about a re-exported name on the barrel's own export line

A barrel's finding named the barrel as `file` and took `line` from the declaring node in the
_other_ file, so a one-line `index.ts` reported its re-export at line 5 — a line that exists
only in `lib.ts`. The code frame pointed at nothing and an `// eess-exclude` on the barrel's real
line did not apply. The finding now carries the line of the `export { name } from` specifier,
the `export * as name from` statement, or the `export *` statement that forwards the name. An
own declaration keeps the line it always had. The verdict is unchanged; only the location moves
(bug 0265). Baseline hashes do not include the line, so no baseline entry changes.
