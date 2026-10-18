# Bug 0471: the header region can read a body value past a label-shaped section heading, silently

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's review of plan 0468's header region
  (architect). It is a limit built into the design, not shipped code, so it has no failing test yet.
  It becomes reproducible once plan 0468 is built.
- **Severity:** Medium — a silent pass on one shape of record. Adopter 3 measured one such record in
  1,735, and it is frozen.
- **Origin:** self-found · PR #235's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

Plan 0468's `region: 'header'` ends the header at the first heading of depth 2 or more that is not
written as `## Label: value`. That is how a record's `## Status:`, `## Severity:` and `## Priority:`
headings stay one header. A section heading that only looks like a field, such as
`## ⚠️ RETRACTED: …`, therefore does not end the header.

If the header has no value for the field, and a body line below such a heading has one
(`- **Status:** open`), that body value is read as the header's value, and nothing is reported. If
the header does have a value, the same over-read gives a conflict, and that is reported.

## Fix

Not designed. One candidate was reporting "header read past `## X:` at line N" as its own cause. It was
not adopted in plan 0468, because it would have to tell a legitimate run of field headings apart from a
body value read too far, and nothing has measured that distinction. The fix starts by measuring it
over adopter corpora once plan 0468 is built.

## Verification

- [ ] Red first, once plan 0468 is built: a record with no header value, a `## Note: x` section, and
      `- **Status:** open` under it, read with `region: 'header'`, passes silently
- [ ] A fix that reports it, with a non-vacuity row

Deferred: none
