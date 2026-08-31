---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
---

eess now runs its own `agentGuardrails` preset against its own source
(`check:guardrails`, in the validate chain and in CI). It used to dogfood only
`recommended`; the preset written for "the mistakes AI coding agents make most
often" was the one exempted, in a repo written by AI coding agents.

The exemption lived as a comment claiming the rules fired on legitimate style —
"18 `throw new Error`, 270 by-design-similar rule-wrapper bodies". That rationale
was self-sealing: it was the reason not to run the preset, so nothing ever tested
it. Run, it reported 84 copy-paste findings rather than 270 — most of them true
duplicates — and all 17 bare `Error`s were a real finding.

**New: `ArchConfigError` and `isArchConfigError` on `@nielspeter/eess`** (re-exported
from `@nielspeter/eess-ts`). Thrown when a RULE is misconfigured — bad arguments to
a condition, a malformed rule file — as distinct from `ArchRuleError`, which means
the architecture under test is wrong. It carries `subject`, naming what was
misconfigured.

This is not cosmetic. `rule-file-findings.ts` already branched on
`isArchRuleError(error)` and routed everything else down one generic "rule file
failed" path, so a rule author who mistyped an argument saw the same surface as an
unhandled crash. The 17 sites that threw a bare `Error` — argument validation in
`conditions/`, rule-file loading in `cli/load-rules.ts`, project resolution,
GraphQL schema loading — now throw `ArchConfigError`. `ErrorOptions` is forwarded,
so the `cause` chain that distinguishes "graphql is missing" from "graphql failed
to load" is preserved.

The preset asked for this type and the repo did not have it. That is what
dogfooding is for.

Remaining honestly: 84 `no-copy-paste` warnings. They ship as warnings by design,
they are real duplication rather than by-design similarity, and plan 0188 owns
them — with a measured inventory now recorded there. The gate blocks on errors and
prints the warnings; it does not call them clean.
