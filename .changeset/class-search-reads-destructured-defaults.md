---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the class body search reads the code a destructured parameter
runs (bug 0309): a binding element's default, a computed key, and the same inside a nested pattern —
`m({ a = eval('x') } = {})`, `n([b = load()] = [])`, `t({ [key()]: value } = {})`. Every class rule
over the search reads them: `notContain`, `contain`, `useInsteadOf`, `noSilentCatch`,
`noMagicNumbers` and the class security rules. They were not read, so a green class rule may report
findings there, and a must-contain rule may now be satisfied by a call there, as it is by a call in a
plain default.

`noMagicNumbers` names a number that is the whole default of a binding element in one of the class's
own members' parameters, as it names a parameter's default: `retry({ attempts = 3 } = {})` is not
reported. A number inside a larger default, in a computed key, or in a function nested inside a member
is.

Existing findings keep their identity: the search reads these positions after everything it read
before, so a new match is numbered after the old ones in the same member. The function rules still
read no parameter default (bug 0314).
