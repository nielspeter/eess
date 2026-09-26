---
'@nielspeter/eess-ts': minor
---

`agentGuardrails` reads the whole file, not only function bodies (bug 0337)

**Breaking (@nielspeter/eess-ts):** two rules change subject, so they report findings they
never reported, in positions whose element name may be the FILE rather than a declaration.
Existing baseline entries for them stop matching and their findings return as new.

`agentGuardrails` built every rule over `functions()`, so the preset sold to agent-focused
projects reported an `eval` inside a function and **nothing** for a bare top-level one.
Measured: `noInlineLogic: ['eval']` reported `["c"]` inside a function and `[]` for top
level, a class static block and a field initializer. This is
[bug 0333](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0333-the-recommended-floor-reads-functions-only.md)'s
defect in the sibling preset, and 0333's ruling is what fixes it: each rule reads the
broadest subject its condition has a variant for, and **exactly one**, because the subject
kinds nest.

- `preset/agent/no-inline-logic/<api>` now reads the module — `moduleNotContain(call(api))`.
- `preset/agent/no-generic-errors` now reads the module. The test that put it in scope is
  its own wording: the imperative is "Do NOT throw new Error()", not "…in a function", so a
  throw at module scope was a false green against the rule as written.
- `preset/agent/no-stubs` and `preset/agent/no-empty-bodies` **keep** their function subject.
  A `// TODO` above a class is genuinely unreported, and that is not a defect: this rule's
  imperative says "in a function body", so the wording and the reading agree.

## What you may see on upgrade

_New findings, in the positions that were silent._ A top-level `eval`, one in a static block
or in a field initializer, and a `throw new Error()` outside any function. Read them before
regenerating a baseline — each is a place a rule you configured was not looking.

_`expectEmpty` no longer applies to the two rules that moved._ A module subject exists
whenever the glob matches, so the declaration fails as the assertion it is. Delete it for
`preset/agent/no-inline-logic/<api>` and `preset/agent/no-generic-errors`; the failure names
the exact declaration.

_An element name can be the file._ A match with nothing named enclosing it is reported
against the file (`a.ts`), and a match inside an object-literal handler is too — measured,
a throw in `const routes = { objectHandler: () => … }` was `routes.objectHandler` under the
function subject and is `handlers.ts` under the module subject. The finding is still
reported; what weakened is the name, and the name is a baseline key.

**Known limit, measured on this change.** Two findings in one file that share a weak element
name are told apart by position, so a baseline can accept the wrong one. Measured: baseline
two top-level `eval`s, fix the first and add a different one below — **both entries match and
the new call is reported as nothing**, where the same edit across two named functions
correctly reports one new. This is
[bug 0338](https://github.com/nielspeter/eess/blob/main/work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md),
which this change makes reachable through a second preset; it is not fixed here because the
fix is a decision about what makes a finding identifiable.
