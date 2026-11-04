# Bug 0619: ledger findings carry no rule id

## Status

- **State:** Draft — measured 2026-11-04 on `fix/0604-0606-adopter-asks`; no red test yet.
- **Severity:** Low — a finding still names its rule in `rule`, and nothing is missed. But the text
  formats now print a rule id only from `ruleId`, so a ledger finding prints none.
- **Origin:** self-found · the review of [bug 0606](./fixed/0606-the-terminal-formats-never-print-a-rule-id.md), 2026-11-04.
- **Reported:** 2026-11-04

## Symptom

`honestyAtClose` reports, for example, `ledger/state-folder-mismatch` with that id in `rule` and
`ruleId` unset (`packages/md/src/rules/ledger.ts:731` is one of them; no finding in the file sets
`ruleId`). Since [bug 0606](./fixed/0606-the-terminal-formats-never-print-a-rule-id.md) the terminal
format prints `Rule: <ruleId> — <rule>` and the plain format a `[<ruleId>]` prefix, both only when
`ruleId` is set. A ledger finding prints neither, so its id appears only as the rule's text, and a
reader filtering by the `[id]` prefix misses it. The JSON `ruleId` field is empty too.

## Root cause

The ledger builds its findings by hand with the id as `rule`, which predates `ruleId`. Other eess-md
findings (links, vocabulary, code blocks, the unread findings) set `ruleId`.

## Fix

Not designed. Either the ledger sets `ruleId` to its id and `rule` to a description, as the other
eess-md findings do, or both carry the id. The fix measures what the JSON and GitHub formats print,
since an agent reads `ruleId` from JSON.

## Verification

- [ ] Red first: a ledger finding through the plain format carries its `[ledger/…]` prefix.
- [ ] Every finding `ledger.ts` builds sets `ruleId`.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
