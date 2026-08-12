---
'@nielspeter/eess-md': minor
---

`honestyAtClose` now actually runs its state↔folder placement check, and lets a
corpus declare its own `State:` vocabulary (bugs 0118, 0119).

**Read this before upgrading — the placement check may have been silent in your
corpus too.** It located the `State:` token by scanning from the top of the
document and stopping at the **first** `##` heading. The common template puts it
one heading further down:

```markdown
# Plan 0060: …

## Status

- **State:** Done
```

For any document in that shape the token was never found, so the check returned
without a word. In the repo this preset was written for, that was **every single
record** — 55 of 55 with a `State:` line — and the gate reported `0 findings` for
its entire existence. The region is now the preamble **and the first section**,
so both shapes are read. Expect placement findings on first run; they are drift
that was always there.

**New: `states` and `terminalStates`.** The vocabulary was hard-coded to
`Draft | Ready | Open | Done | Won't-do`. A corpus with a different one — a bug
lane closing on `Fixed`/`Rejected`, say — can now declare it:

```ts
honestyAtClose(corpus, {
  states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
  terminalStates: ['Fixed', 'Rejected'],
})
```

**The value is matched against your declared vocabulary**, not grabbed as the
next whitespace-delimited run — so `**State: Done**`, `- **State:** Done.`,
`**State**: Done`, an emphasised `**Done**`, a lowercase `done` and a
smart-quoted `Won’t-do` all read as the states they obviously are. A colon is
required, so a prose line like `Stateless rendering is the default` is not a
state declaration. Multi-word states (`In progress`) work.

**New finding: `ledger/unknown-state`.** A `State:` token outside the declared
vocabulary is now reported rather than skipped. Previously an unrecognised token
looked identical to "no state at all" and disabled the placement check for that
document silently — a check that stops running without saying so is the failure
this preset exists to prevent. If you use tokens outside the default set, declare
them in `states` or correct them; do not expect silence.
