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

_A `// eess-exclude` comment pinned to a declaration line stops covering the finding._ A single-line
directive covers the next line only, and for these two rules the reported line is now the **match's**
line, not the enclosing declaration's — so an exclusion moves out from under its finding even when the
element name does not change. This is the same break `docs/migrating-to-0.7.md` §2 recorded for
`recommended`'s three rules, now in a second preset. The run names each one with `file:line`
(`Exclusion comment for '<id>' at …:8 suppressed nothing`). Move the comment to the line the finding
names, or wrap the region with `eess-exclude-start` / `eess-exclude-end`.

**Watch the order.** A stale exclusion on its own does **not** fail the build — it prints as a
`[eess]` warning and the run exits 0. So if you answer the red by regenerating the baseline first, you
end up green with exclusion comments that no longer suppress anything and never will. Fix the
exclusions before you regenerate.

_Two weak buckets merge._ A top-level match and an object-literal match in the same file now share one
ordinal sequence, where only the object-literal ones did before. Adding a top-level `eval` therefore
renumbers the object-literal one and unmatches its baseline entry.

_An element name can be the file._ A match with nothing named enclosing it is reported
against the file (`a.ts`), and a match inside an object-literal handler is too — measured,
a throw in `const routes = { objectHandler: () => … }` was `routes.objectHandler` under the
function subject and is `handlers.ts` under the module subject. The finding is still
reported; what weakened is the **name you read**, not the identity — `moduleNotContain` sets an
`identity`, which supersedes element and message in the hash, and for this shape that identity was
already positional under the function subject too. So the finding is no weaker than it was; it simply
reads worse. Its baseline entry still unmatches, like every entry for these two rules, because the
identity carries the subject kind and `function-body::` becomes `module-body::`.

**Known limit, measured on this change.** Two findings in one file that share a weak element
name are told apart by position, so a baseline can accept the wrong one. Measured: baseline
two top-level `eval`s, fix the first and add a different one below — **both entries match and
the new call is reported as nothing**, where the same edit across two named functions
correctly reports one new. This is
[bug 0338](https://github.com/nielspeter/eess/blob/main/work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md),
which this change makes reachable through a second preset; it is not fixed here because the
fix is a decision about what makes a finding identifiable.
