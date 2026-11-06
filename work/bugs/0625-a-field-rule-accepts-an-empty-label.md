# Bug 0625: a field rule accepts an empty label

## Status

- **State:** Draft — measured 2026-11-05 on `main` (eess-md 0.14.0) against the built packages; no
  red test yet.
- **Severity:** Low — no false green measured: the condition forms fail closed, by reporting every
  document. But the message misleads, and in selector position the empty label selects nothing.
- **Origin:** self-found · the review of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md), 2026-11-05.
- **Reported:** 2026-11-05

## Symptom

Over a document holding `**Status:** open`, measured:

| call                                                                   | result                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `docs(c).should().haveField({ label: '', forms: ['bold'] })`           | `no  field (read as bold); its labels: Status`, on every document |
| the same with `label: ' '`                                             | `no   field (read as bold); …`                                    |
| `predicateHaveField({ label: '', forms: ['bold'] }).test(doc)`         | `false` on every document, so a `.that()` selects nothing         |
| `fields(c, { label: '', forms: ['bold'] }).should().resolveAgainst(…)` | only "this rule examined zero units"                              |

None names the cause, an empty label, and none is an `ArchConfigError`. `forms: []` is accepted too,
and reports the field "in a form this rule does not read".

Note 2026-11-06: an empty alias is accepted the same way, and a plain-JavaScript caller gets no
`ArchConfigError` for a made-up form (`forms: ['bld']` reads as "a form this rule does not read") or a
missing `forms` (a `TypeError`). [Plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s
`resolveFieldValue` refuses an empty label or alias and `forms: []`; the existing builders are this
bug's. So are the reader's own remaining gaps, the same two as the builders': a made-up form and a
missing `forms` from a plain-JavaScript caller (its method re-check, 2026-11-06).

## Root cause

The field builders validate the region (`checkRegion`, `packages/md/src/model/fields.ts:63`, called by
each builder) but not the label or the forms. [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 makes both required with no default;
an empty value defeats that the same way an omitted one would.

## Fix

Not designed. The field builders refuse an empty or whitespace-only label and an empty `forms` with an
`ArchConfigError` naming the option, beside `checkRegion`. [Plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)
refuses them in its new reader only, to leave `haveField`'s behaviour unchanged; this bug carries the
same refusal to the existing builders, and it is a behaviour change (a rule that reported every
document now throws), so its changeset says so.

## Verification

- [ ] Red first: each row above throws `ArchConfigError` naming the option.
- [ ] `forms: []`, likewise.
- [ ] A made-up form and a missing `forms` throw `ArchConfigError`, in the builders and in
      `resolveFieldValue`.
- [ ] A changeset naming `@nielspeter/eess-md`, the break marked.
- [ ] `npm run validate` green.

Deferred: none
