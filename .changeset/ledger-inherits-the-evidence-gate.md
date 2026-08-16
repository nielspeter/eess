---
'@nielspeter/eess-md': minor
---

`honestyAtClose` is now expressed through the builder DSL (`docs()` / `taskItems()`), not raw corpus iteration — bug 0131.

**Breaking (0.x — minor signals it, not a 1.0 stability claim):** a corpus that
previously passed `honestyAtClose` silently on a dead or misconfigured selector
can now fail on upgrade with no code change of its own — this is the same
"a rule that examines zero units now throws by default" mechanism plan 0088
landed on the kernel, now reaching this preset.

- **The header/placement check (`ledger/state-folder-mismatch`) now inherits the fold's fail-closed evidence gate.** Previously `honestyAtClose` hand-iterated the corpus directly, calling no `RuleBuilder`/`TerminalBuilder` — invisible to every kernel-level guarantee, including the zero-examined guard plan 0088 landed. A dead selector (e.g. a `boardFiles` config that absorbed every real document) could pass silently forever. It is now caught by default: an examined-zero header selection fails loudly instead of reading as "nothing to report."
- **New option `expectEmptyHeaders`.** A corpus that may legitimately hold zero non-board documents right now — a freshly-bootstrapped lane before its first real item is authored — needs to declare this explicitly (it isn't inferrable). Per ADR-010 the declaration expires: the day a real document appears, it must be removed or the build fails on the stale declaration itself.
- **The two done-item-scoped checks (`ledger/silent-open-box`, `ledger/deferred-none-lie`) are also now protected against a broken selector** — but narrower than the header check: they're guarded against corruption of the specific predicates that scope them (`belongsToADoneItem`, `hasDeferredDisposedBox`), verified by independent sabotage-testing of both, not against corruption of the shared `isDoneItem`/`collectTaskItems` machinery all three checks ultimately depend on. A corpus with an established history (never legitimately zero done-items) should assert that on top, the way `scripts/check-ledger.mjs` now does for this repo's own corpus — see that file for the pattern.
- Detection logic and messages are unchanged — same regexes, same `findState`/`isDoneItem` helpers, same violation text. Only the iteration mechanism changed; output over the real corpus is byte-identical to before this fix.

**Migration:** if your own corpus has a lane that may legitimately be entirely board files right now (e.g. a `kit/`-seeded lane before its first item), pass `{ expectEmptyHeaders: true }` to `honestyAtClose` for that lane and remove it once the lane has real content. If a lane's done-item checks previously relied on a silently-broken `belongsToADoneItem`/`hasDeferredDisposedBox`, that's now reported rather than silent — fix the underlying selector.
