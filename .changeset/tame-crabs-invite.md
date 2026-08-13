---
'@nielspeter/eess-md': patch
---

Fix `honestyAtClose`/`ledgerStats` silently misreading a `**State:**` line when
`states` is an empty array — a legitimate config for a lane where nothing is
ever ledger-closed (a corpus-content vocabulary this repo now uses for its own
proposals lane, where the review outcome is a separate field, not a second
`State` token).

`stateMatcher([])` built its regex's capture group from zero alternatives —
`()`, a zero-width match that fires at almost any position — so every genuine
`State:`-shaped line was read as "readable, value `''`" instead of falling
through to the unreadable-token fallback. Callers passing a non-empty
`terminalStates` were never affected. A caller passing `terminalStates: []`
(the only way to trigger this) still got the right answer from `isDoneItem`,
but only because `[].includes('')` happens to be `false` — not because
`findState` reported "no known state" for the right reason. `ledgerStats`'s own
`withReadableState`/`unreadableState` counts were wrong for such a lane: a
directory full of `State:`-shaped records would report as `withReadableState`
instead of `unreadableState`, which matters to any caller distinguishing "has
state-shaped content" from "has content in my declared vocabulary" — exactly
the distinction a coverage-style check needs.

Fixed with a one-line guard: an empty vocabulary now never matches, forcing the
documented unreadable-token fallback for every path. No change to any existing
caller with a non-empty `states`/`terminalStates`.
