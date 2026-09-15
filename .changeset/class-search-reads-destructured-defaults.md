---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the class body search reads the code a destructured parameter of
a method, constructor or accessor runs at each call (bug 0309): each binding element's computed key
and default, at any depth — `m({ a = eval('x') } = {})`, `n([b = load()] = [])`,
`t({ [key()]: value } = {})`. Both reaches read it, because it runs on every call as a plain default
does. A computed key inside a destructured parameter is therefore member code, unlike a computed
member name, which runs once when the class is defined.

Affected, because they are built on the class body search: `contain`, `notContain` and
`useInsteadOf` on classes; `noEval`, `noFunctionConstructor`, `noProcessEnv`, `noConsoleLog`,
`noConsole` and `noJsonParse` in `rules/security`; `noGenericErrors`, `noTypeErrors` and
`noSilentCatch` in `rules/errors`; `noTypeAssertions` and `noNonNullAssertions` in `rules/typescript`;
`noMagicNumbers` in `rules/code-quality`; `classMustCall` in `rules/architecture`; and the
`dataLayerIsolation` preset's `preset/data/typed-errors` rule.

- A green class rule may report findings there — `constructor({ config = {} as Config } = {})` is now
  a `noTypeAssertions` finding.
- A red must-contain rule may turn green: a class whose only matching call sits in a destructured
  parameter now contains it, for `contain`, `classMustCall` and the replacement half of
  `useInsteadOf`.
- The `recommended` preset and `agentGuardrails` run function rules, which still read no parameter
  default (bug 0314), so this change does not change them.

`noMagicNumbers` names a number that is the whole default of a binding element in a parameter of one
of the class's own members, as it names a parameter's default: `retry({ attempts = 3 } = {})` is not
reported. A number inside a larger default is — `outer({ timeout } = { timeout: 5000 })` included —
and so is one in a computed key, or in a function nested inside a member.

This change moves no existing identity: the search reads these positions after everything it read
before, so a new match is numbered after the old ones in its member.
