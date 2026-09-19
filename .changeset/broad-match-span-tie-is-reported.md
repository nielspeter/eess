---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** a broad matcher — `expression()`, or any `ExpressionMatcher`
that names no syntax kind — now reports a match that covers exactly the same text as another node
(bug 0322). Before, both were dropped and nothing was reported. Newly reported in a function, class
or module body, for example:

- a call or an assignment written as a statement without a semicolon, `legacy(1)`;
- a shorthand property, `{ token }`, and a destructured binding, `const { token } = source`;
- a variable declared without a value, and a type annotation, `let x: Legacy`;
- a call's only argument or an array's only element, with or without a semicolon —
  `use(legacy(1));`, `log(config.secret);`, `[token]`.

Every search a broad matcher takes changes the same way: `notContain`, `contain` and `useInsteadOf`
on functions, classes and modules, and `haveArgumentContaining`, `notHaveArgumentContaining`,
`haveCallbackContaining` and `notHaveCallbackContaining` on calls — for a match inside the argument
or the callback. The requirements (`contain`, `useInsteadOf`'s good side, `haveArgumentContaining`,
`haveCallbackContaining`) stop failing a body that holds such a match, and the `inconsistentSiblings`
smell reads the same search. `call()`, `access()`, `newExpr()`, `property()` and the other matchers
that name a syntax kind are unchanged, and so is `comment()`.

Each match is reported once. A concise arrow whose body holds a broad match used to report the match
and the body around it; it now reports the match alone — `() => legacy(1)` under
`expression(/legacy/)` was two findings and is one.

A green rule may report new findings. As with any rule that reports more, a newly reported match
above an accepted one in the same declaration takes its ordinal in a baseline: the accepted match is
reported as new, and the new one is hidden until the baseline is reviewed. Review that declaration's
findings before regenerating it. Message wording is unchanged, but a class field or parameter default
whose only match was such a shape now names the match's line rather than the initializer's first
line; its identity is unchanged.
