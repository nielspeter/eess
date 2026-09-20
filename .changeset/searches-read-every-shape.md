---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** two searches now read shapes they passed over in silence.

**The callback conditions read every callback a call passes (bug 0324).** `haveCallbackContaining`
and `notHaveCallbackContaining` took an argument as a callback only when it WAS an arrow function or
a function expression, so a handler in an options object — `use({ handler: () => … })`, the shape
the builder's own example is written for — a method shorthand, and a callback behind parentheses
were searched by nothing: the prohibition passed and the requirement failed, both green. They now
take their callbacks from the same definition `within()` uses, which also reads an argument through
parentheses, `as`, `<T>`, `satisfies` and `!` (as the function collector already read a variable's
initializer). `within()` gains the wrapped shapes with them.

That wrapper list now lives in one module, so it composes with the object-literal walk:
`use({ handler: (() => …) as H })` is read by the callback conditions, by `within()` **and** by
`functions({ includeObjectLiteralFunctions: true })` — the last a behaviour change to a shipped
collection, which tested a property's raw initializer before. Four limits remain, named in
`docs/calls.md` rather than left to be found: a callback a NAME refers to, one in an array or other
collection, one held by a getter, and one nested deeper than three object literals.

**A class comment rule reads the comments in a member's parameter list (bug 0325).** The class
search read a parameter as code — its default, and a destructured parameter's defaults and keys — so
`m(g = /* TODO */ 1)` and a `// TODO` on its own line before a parameter passed
`classes().should().notContain(comment(/TODO/))` while the function rules reported both on the same
member. A member's own docstring is still not read — on a class, a comment above a member is
documentation, not code (bug 0307) — and a comment inside a parameter's decorator does not satisfy a
must-contain rule, for the same reason the decorator's code does not.

A green rule may now report findings it could not see, and a requirement — `haveCallbackContaining`,
`contain` — may now be met by a callback or a comment that was invisible. Messages are unchanged.
Both searches read the new shapes LAST — the callback extractor returns an unwrapped argument's
callbacks before a wrapped one's, which `within()` inherits — so within one call and one class
member a finding a baseline accepted keeps its identity and a newly read one is numbered after it. Across declarations that
share an identity scope, a newly reported finding above an accepted one takes its ordinal, as with
any rule that reports more — review those findings before regenerating a baseline.
