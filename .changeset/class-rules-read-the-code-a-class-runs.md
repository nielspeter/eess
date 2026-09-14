---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** three class rules that walked their own list of members now read
what the class body conditions read (bug 0306).

- `noSilentCatch` now reports a silent `catch` anywhere a class runs code — member bodies, parameter
  defaults, property initializers (an arrow-function event handler included), static blocks,
  decorators, computed names and `extends`. It read methods, constructors and accessors only.
- `noMagicNumbers` now reports a magic number anywhere a class runs code, in the same positions. It
  read methods only, and not even constructors or accessors. A finding names the member the number
  sits in — `Class.constructor`, `Class.static` for a static block, the class alone for a class
  decorator or `extends` — and a number in a method keeps its message. A number that is the whole
  value of a property or a parameter default — `private timeout = 5000`, `retry(attempts = 3)` — is
  named by it and is not reported; a number inside a larger initializer or default is. The rule's description changes
  from `have no magic numbers in method bodies` to `have no magic numbers in the code the class runs`,
  and a baseline identity includes the rule's description, so every baselined `noMagicNumbers`
  finding is reported once more: review it and regenerate the baseline.
- `maxCyclomaticComplexity`, `maxMethodLines` and `maxParameters` now measure a property whose value
  is a function — `onClick = () => {…}`, `onLoad = function () {…}` — as a callable member, named
  `Class.onClick`. They measured methods, constructors and accessors only. A static block, a
  parameter default or a property holding anything else is not a callable member and is still not
  measured; `maxClassLines` counts it.

A green rule may report findings in those positions. Existing findings keep their identity: the
declared members are measured and read first, and a method's message and qualified name are
unchanged.
