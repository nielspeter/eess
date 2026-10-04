---
'@nielspeter/eess-md': minor
---

`honestyAtClose` and `ledgerStats` refuse `states` without `terminalStates`, and the reverse

**Breaking.** Fixes
[bug 0284](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md).

The two options defaulted independently. Pass `states` alone — which is what
`ledger/unknown-state`'s advice leads to, "declare the token" — and the default
`terminalStates` stayed in force, so a closing token you added (`Promoted`, say) was readable
but never terminal. Its records were never treated as done, their open boxes were never
checked, and the gate reported a clean pass with a denominator: no finding at all. Pass
`terminalStates` alone and the mirror happened: the default `Done` stayed a known state that
no longer closed.

Now either one alone throws an `ArchConfigError` naming both options and how to keep the
defaults while adding your own:

```ts
honestyAtClose(corpus, {
  states: ['Draft', 'Ready', 'Open', 'Done', "Won't-do", 'Promoted'],
  terminalStates: ['Done', "Won't-do", 'Promoted'],
})
```

`docs/markdown.md`'s own example passed `terminalStates` alone, so a config copied from the
guide is the likeliest to be caught; it passes both now.

What this removes is the route where a default chose for you. If you pass both and leave a
closing token out of `terminalStates`, its records are still never treated as done — the tool
cannot tell that from a token that really does not close, so declare closing tokens there.

Passing neither, or both, behaves as before — including `terminalStates: []` for a lane where
nothing is ledger-closed by design. If your config passes only one of the two, it now fails on
the first run; add the other.
