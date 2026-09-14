---
'@nielspeter/eess-ts': none
'@nielspeter/eess': none
---

Nothing ships. KNOWN-GAP test files pin bugs 0295, 0296, 0297, 0298, 0300, 0301 and
0304 — each test asserts today's behaviour, so fixing its bug turns it red — and one
green test commits the reproduction attempt behind 0299. The kernel gains one of those
test files, for 0298's half in `applyFilters`.

One source comment is corrected: it attributed "the primary consumer does not read
warnings" to ADR-008, which is ADR-009's. Bug 0303 records the other sites.

Behaviour is unchanged, which is why this is `none`.
