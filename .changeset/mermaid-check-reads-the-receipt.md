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
| `export default [{ violations: () => [] }]` | same                                                             |
| `export default []`                         | `✓ eess-mermaid — 0 rules across 1 file · 0 failing`, **exit 0** |

**The receipt was already there.** Every builder in this dialect extends the kernel's
`TerminalBuilder`, whose `violations()` has returned a `CollectResult` since ADR-014 — a real rule
with a dead selector already reddened. What was missing was that the CLI never asked for it, and
that its loader keyed on `check`, which any hand-rolled object satisfies.

**What changed.** The loader requires `violations()`; the command loads per rule file, consults the
evidence gate, and names the rule file a finding came from; and a rule file that contributes no rules
reds with its own finding instead of ticking over a zero denominator.

**What breaks.** A rule file exporting a hand-rolled object with only a `check` method — or exporting
nothing — used to pass and now fails. That is the point: it was certifying nothing. **What to do:**
export the builders you meant to check. A builder produced by this package's fluent API already
carries its receipt and is unaffected; this repository's own `mermaid.rules.ts` passes unchanged.
