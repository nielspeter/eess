---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** five class rules that walked their own list of members now read
more of a class, each as below (bug 0306).

- `noSilentCatch` now reports a silent `catch` anywhere a class runs code — member bodies, parameter
  defaults, property initializers (an arrow-function event handler included), static blocks,
  decorators, computed names and `extends`. It read methods, constructors and accessors only.
- `noMagicNumbers` now reports a magic number anywhere in a class's member code — method,
  constructor and accessor bodies, parameter defaults, property initializers and static blocks. It
  read methods only, and not even constructors or accessors. Decorators, computed names and
  `extends` are not read: a number in `@Max(150)` or `@Column({ precision: 12 })` is named by the
  decorator that takes it.
  - A finding names the member the number sits in — `Class.constructor`, `Class.static` for a static
    block, `Class.limit` for an accessor — and a number in a method keeps its message.
  - A number that is the whole value of one of the class's own properties or its members' parameter
    defaults — `private timeout = 5000`, `retry(attempts = 3)`, `static readonly LIMIT = 5000 as const`
    — is named by it and is not reported. It is read through a `-` or `+` sign, parentheses, `as`,
    `<T>`, `satisfies` and `!`.
  - A number named any other way is reported, and these are the new findings to expect most: a value
    in a keyed table a property holds (`static readonly Status = { OK: 200 }` reports 200), an array
    element, the default of a function-valued property's parameter, and a local constant in a member
    (bug 0317). A number inside a larger initializer or default is reported
    (`constructor(x = 4444 * 2)`), and so is one in a function or class nested inside a member, as it
    was before.
  - A number is read by its value: `5_000` is reported as 5000 and matches `allowed: [5000]`. It was
    reported as `NaN` and matched nothing.
  - The description changes from `have no magic numbers in method bodies` to
    `have no magic numbers in member code`: the old one names a scope the rule no longer has.
- `maxCyclomaticComplexity`, `maxMethodLines` and `maxParameters` now measure a property whose value
  is a function — `onClick = () => {…}`, `onLoad = function () {…}`, also inside parentheses or behind
  `as`, `<T>`, `satisfies` or `!` — as a callable member, named `Class.onClick`. They measured
  methods, constructors and accessors only. A static block, a parameter default, a function nested in
  a property's value such as `debounce(() => {…})`, and a property holding anything else are not
  callable members and are still not measured; `maxClassLines` counts them. Their descriptions,
  `have no method with …`, are unchanged: a function-valued property is still read as a method there.

**Baselines.** A baseline identity includes the rule's description, so every baselined
`noMagicNumbers` finding is reported again, and eess-ts's notice says a description change is not new
rot. For this upgrade that is not the whole story: the rule now also reads constructors, accessors,
property initializers and static blocks, so regenerating the baseline accepts genuinely new findings
along with the returning ones. Review the new entries before committing it.

Findings `noSilentCatch` and the metrics rules already reported keep their identity: declared members
come first, and a member's message and qualified name are unchanged.
