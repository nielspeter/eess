---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** five class rules that walked their own list of members now read
what the class body conditions read (bug 0306).

- `noSilentCatch` now reports a silent `catch` anywhere a class runs code — member bodies, parameter
  defaults, property initializers (an arrow-function event handler included), static blocks,
  decorators, computed names and `extends`. It read methods, constructors and accessors only.
- `noMagicNumbers` now reports a magic number anywhere in a class's member code — method,
  constructor and accessor bodies, parameter defaults, property initializers and static blocks. It
  read methods only, and not even constructors or accessors. Decorators, computed names and
  `extends` are not read: a number in `@Max(150)` or `@Column({ precision: 12 })` is named by the
  decorator that takes it. A finding names the member the number sits in — `Class.constructor`,
  `Class.static` for a static block — and a number in a method keeps its message. A number that is
  the whole value of one of the class's own properties or its members' parameter defaults, with or
  without a `-` or `+` sign — `private timeout = 5000`, `retry(attempts = 3)` — is named by it and is
  not reported. A number inside a larger initializer or default is reported, and so is one in a
  function or class nested inside a member, as it was before: `constructor(x = 4444)` is not
  reported, and `constructor(x = 4444 * 2)` is. The rule's description changes from
  `have no magic numbers in method bodies` to `have no magic numbers in the class member code`, and a
  baseline identity includes the rule's description, so every baselined `noMagicNumbers` finding is
  reported once more: review it and regenerate the baseline.
- `maxCyclomaticComplexity`, `maxMethodLines` and `maxParameters` now measure a property whose value
  is a function — `onClick = () => {…}`, `onLoad = function () {…}`, also inside parentheses or behind
  `as`, `<T>`, `satisfies` or `!` — as a callable member, named `Class.onClick`. They measured
  methods, constructors and accessors only. A static block, a parameter default, a function nested in
  a property's value such as `debounce(() => {…})`, and a property holding anything else are not
  callable members and are still not measured; `maxClassLines` counts them.

A green rule may report findings in those positions. Findings `noSilentCatch` and the metrics rules
already reported keep their identity: declared members come first, and a member's message and
qualified name are unchanged. `noMagicNumbers` keeps its messages too, but not its description, so
its baselined findings report once more, as above.
