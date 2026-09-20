---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the function collection reaches three more positions, and the
security rules read a name through its binding.

**Positions a function rule reads (bug 0321).** `eval` passed `functionNoEval` — and the
`recommended` floor — in a class EXPRESSION's members, anywhere inside a NAMESPACE, and an object
literal's ACCESSORS, because the collection asked the source file for its top-level functions,
variables and classes and nothing else. It now reads a namespace as it reads a file, a class
expression as it reads a class, and an accessor as it reads a method. A namespace's members carry
its path (`N.Inner.m`), a class expression's carry the binding that holds it (`Expr.m`), and an
object literal's accessors are named by their key (`o["get x"]`). `classes()` selects every class
declaration in a file, its namespaces included, not only the top-level ones.

Ruled out, and unchanged: a static block and a class field that holds no function are code a CLASS
runs, and the class rules read both; a function passed to a call or chosen by a conditional, and a
callback handed to a call outside any function, are anonymous inline functions the module rules
read. The `recommended` preset builds every rule with `functions()`, so those positions are still
not checked by the floor — recorded as a known gap rather than implied to be covered.

**A global is read through its binding (bug 0305).** `functionNoEval`, `functionNoFunctionConstructor`,
`functionNoConsole` and `functionNoProcessEnv` (and their class and module variants) read the name at
the site of use, which failed both ways. A global bound to a local name first — `const ev = eval`,
`const { log } = console`, `import { env } from 'node:process'` — was missed; a local that keeps a
global's name — `function Function() {}`, `const console = {…}`, a parameter called `process` — was
reported as the global. Both directions now follow the binding, as far as the file spells it out. A
declaration that is ambient — the lib, a `.d.ts`, a `declare` in a source file — IS the global, and a
binding that cannot be resolved falls back to the name as written, so a missing type definition
cannot turn a rule off.

**What changes for a green build.** A rule may report findings it could not see: a global under an
alias, and any code in the three newly collected positions. A rule may STOP reporting a local that
shadows a global — if a baseline accepted one of those, it is now an unmatched baseline entry.
Resolving a binding asks the type checker, measured at about 1.5ms per file on the floor gate over
270 files. Messages are unchanged. Within a file, the newly collected functions are appended after
the ones collected before, so a finding a baseline accepted keeps its identity; across a rule whose
subjects now include a namespace's functions, review the findings before regenerating a baseline.
