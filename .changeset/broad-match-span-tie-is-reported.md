---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `expression()` now reports a match that covers exactly the same
text as another node (bug 0322). Before, both were dropped and nothing was reported. Newly reported
by `notContain`, `useInsteadOf` and `notHaveArgumentContaining`/`notHaveCallbackContaining`, for
example:

- a call or an assignment written as a statement without a semicolon, `legacy(1)`;
- a shorthand property, `{ token }`, and a destructured binding, `const { token } = source`;
- a variable declared without a value, and a type annotation, `let x: Legacy`;
- a call's only argument or an array's only element, with or without a semicolon —
  `use(legacy(1));`, `log(config.secret);`, `[token]`.

`contain` and `haveArgumentContaining` stop failing a body that holds such a match. Each match is
reported once. `call()`, `access()`, `newExpr()`, `property()` and the other matchers that name a
syntax kind are unchanged, and so is `comment()`.

A green rule may report new findings. Messages are unchanged. As with any rule that reports more, a
newly reported match above an accepted one in the same declaration takes its ordinal in a baseline:
the accepted match is reported as new, and the new one is hidden until the baseline is reviewed.
Review that declaration's findings before regenerating it.

A KNOWN-GAP test file pins bug 0323: the call conditions do not test an argument, or a concise
callback's body, that is itself the match. Behaviour there is unchanged.
