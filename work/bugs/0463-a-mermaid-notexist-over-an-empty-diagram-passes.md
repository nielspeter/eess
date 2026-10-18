# Bug 0463: eess-mermaid's `notExist` over an empty diagram passes

## Status

- **State:** Draft — recorded 2026-10-18; measured on main while reworking plan 0456. No red test yet.
- **Severity:** Medium — a ratchet over a diagram that lost its content stays green.
- **Origin:** self-found · plan 0456's rework, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

eess-mermaid reports no empty source. Over a diagram holding only `classDiagram`, measured on main:

| rule                                                     | result                                 |
| -------------------------------------------------------- | -------------------------------------- |
| `classes(diagram('classDiagram\n')).should().notExist()` | 0 findings, examined 0 → green         |
| a positive rule over the same diagram                    | 1 finding, the generic "examined zero" |

The cardinality exemption (`packages/core/src/terminal-builder.ts:318`) applies because nothing tells
the kernel the source itself was empty. eess-ts reports an empty project as a source fact (ADR-013);
eess-mermaid does not. This is not bug 0460: mermaid's selectors are class names, not paths.

## Fix

eess-mermaid reports an empty diagram as an empty source, as plan 0456 does for an empty eess-md
corpus, so the kernel's empty-source finding outranks the exemption.

## Verification

- [ ] Red first: the `notExist` row above passes today
- [ ] Green: it reds as an empty source; a diagram with one class and no match stays green

Deferred: none
