---
'@nielspeter/eess-mermaid': minor
---

**Breaking (@nielspeter/eess-mermaid):** `eess-mermaid check` now fails on a rule file that enforces nothing

ADR-014 requires every emitter to refuse a verdict it has no evidence for. This dialect's `check`
command called `builder.check()` and counted the throws, which never looks at what a rule examined.
Measured before this change, against the built binary:

| rule file                                   | before                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `export default [{ check: () => {} }]`      | `✓ eess-mermaid — 1 rule across 1 file · 0 failing`, **exit 0**  |
| `export default [{ violations: () => [] }]` | `✓ eess-mermaid — 0 rules across 1 file · 0 failing`, **exit 0** |
| `export default []`                         | `✓ eess-mermaid — 0 rules across 1 file · 0 failing`, **exit 0** |

**The receipt was already there.** Every builder in this dialect extends the kernel's
`TerminalBuilder`, whose `violations()` has returned a `CollectResult` since ADR-014 — a real rule
with a dead selector already reddened. What was missing was that the CLI never asked for it, and
that its loader keyed on `check`, which any hand-rolled object satisfies.

**What changed.** The loader requires `violations()`; the command loads per rule file, consults the
evidence gate, and names the rule file a finding came from; and a rule file that contributes no rules
reds with its own finding instead of ticking over a zero denominator.

**New on the package root:** `collectResult`, `finishPreset`, `reportViolations` and the
`CollectResult` type, re-exported from the kernel. They are the migration path for the break above —
`import { collectResult } from '@nielspeter/eess-mermaid'`, no second install — and the dialect's own
CLI now uses them, which `check:family` requires it to re-export.

**A non-builder in the array is now a loud error, not a silent skip.** A rule file holding a real
builder beside a hand-rolled object used to run the hand-rolled one; now the file is refused, naming
the offending entry by index (`cli/rule-file-misconfigured`). This matches `eess-ts`, and it exists
because the alternative was worse: dropping the entry silently turned a rule that ran and threw into
a green run under a denominator that still counted it.

**One JSON field changes.** `summary.reason` is now `null` where it previously carried the failing
rule's `because`. The per-violation `because` field is unaffected and carries the same text, so
nothing is lost — but a consumer reading `summary.reason` should read `violations[].because` instead.

**What breaks.** A rule file exporting a hand-rolled object with only a `check` method — or exporting
nothing — used to pass and now fails. That is the point: it was certifying nothing. **What to do:**
export the builders you meant to check. A builder produced by this package's fluent API already
carries its receipt and is unaffected; this repository's own `mermaid.rules.ts` passes unchanged.
