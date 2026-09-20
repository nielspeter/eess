# Bug 0321: function positions no function rule reads — a class expression, a namespace class, an object accessor, a static block, a call, a conditional

## Status

- **State:** Fixed — the collection reads a namespace as it reads a file, a class expression as it
  reads a class, and an object literal's accessors as it reads its methods; the class builder reads
  every class declaration, not only a file's top-level ones. The positions that are not functions
  are ruled out, each with a test. Red test first.
- **Severity:** High — **false green** on the floor. `eval` in any position below passes
  `functionNoEval`, which the `recommended` preset runs over the same collection
  (`packages/ts/src/presets/recommended.ts:152`). The class rules miss two of the positions as well.
- **Origin:** #140's method and enforcement reviews, 2026-09-15, reviewing
  [0315](./0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md)'s
  fix, which collects a class declaration's function members; split from it rather than widening
  that fix.
- **Reported:** 2026-09-15 · **Fixed:** 2026-09-20 (PR #148)

## Symptom

One file, on 0315's build: `functions()` with object-literal functions asked for, as the presets ask,
and `classes()`, each with its `eval` rule.

| position                                                                                      | `functions()` · `functionNoEval` | `classes()` · `noEval` |
| --------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------- |
| control: `export function control() { eval('…') }`                                            | reported                         | —                      |
| a class expression's method: `export const Expr = class { m() { eval('…') } }`                | **no**                           | **no**                 |
| a namespace class's method: `export namespace N { export class Inner { m() { eval('…') } } }` | **no**                           | **no**                 |
| an object literal's accessors: `{ get x() { return eval('…') }, set x(v) { eval(v) } }`       | **no**                           | —                      |
| a static block: `class S { static { eval('…') } }`                                            | **no**                           | reported               |
| a class field that holds no function: `class F { x = eval('…') }`                             | **no**                           | reported               |
| a function passed to a call a variable holds: `const memoised = memo(() => eval('…'))`        | **no**                           | —                      |
| a function a conditional chooses: `const chosen = flag ? () => eval('…') : () => 0`           | **no**                           | —                      |
| a callback at module level: `app.get('/', () => eval('…'))`                                   | **no**                           | —                      |

Two positions near these are read, measured the same way: a class declared inside a function, as
part of that function's body, and a default-exported class, whose method is collected as
`<anonymous>.m`.

## Root cause

`collectFunctions` (`packages/ts/src/models/arch-function.ts:344` on `main` at 4c84df7, the code
this record describes — every pointer below is pinned to that revision, because the fix moved all of
them):

- collected class members from `sourceFile.getClasses()` (`:374`), a file's top-level class
  declarations, so neither a class expression nor a class inside a namespace;
- collected a variable whose initializer is a function behind at most parentheses, `as`, `<T>`,
  `satisfies` or `!` (`:366`), so not one behind a call or a conditional — and a callback passed to a
  call outside any function belonged to no collected function;
- collected an object-literal value that is an arrow function, a function expression or a method
  (`:399`), so not an accessor;
- collected nothing for a static block, or for a class field whose value is not a function: neither
  is a function.

Everything inside a `namespace` was invisible for the same reason as the first point:
`getFunctions()`, `getVariableDeclarations()` and `getClasses()` answer for the node they are asked,
and only the source file was asked.

The class rules missed a class expression and a namespace class too; where their walk starts was for
the fix to establish.

## Fix

**Ruled, position by position, and measured from both sides.** Three of them are functions the
collection simply could not reach, and they are now collected:

- **a class expression's members** — the same members bug 0315 collects, in a class the walk did not
  reach. Named by the binding that holds it: `const Expr = class { m() {} }` reports `Expr.m`.
- **anything inside a namespace** — measured while fixing, and wider than this record first said: a
  namespace's function declarations and arrow consts were invisible too, not only its classes. A
  namespace is a scope that holds what a file holds, and `getFunctions()`, `getVariableDeclarations()`
  and `getClasses()` answer only for the node they are asked. Members carry the namespace path
  (`N.Inner.m`), so two namespaces may hold a class of one name without their findings colliding —
  bug 0010's collision, which the object-literal collection already prefixes against.
- **an object literal's accessors** — the counterpart of the class accessors 0315 collected. The
  shared object-literal traversal takes them behind an option, because whether a rule about
  CALLBACKS should read a function that runs on access rather than on call is an open ruling
  ([0331](../0331-the-callback-definition-reads-an-object-literal-and-nothing-else.md)), and the two
  readers must not drift into one decision by accident.

**Three are not functions, and stay with the rules whose subject they are:**

- **a static block** and **a class field that holds no function** are code a CLASS runs. Neither has
  a name, parameters or a return type; making them subjects of `functions()` would hand a function
  rule a subject that is not one. Measured: the class rules read both.
- **a function passed to a call, chosen by a conditional, or handed to a call outside any function**
  is an anonymous inline function, which 0315 left out on purpose so that every inline callback does
  not reach rules written for named functions. Measured: the module rules read the module-scope ones.

**A class inside a function, and a namespace inside a function, are left to the enclosing
function.** Its body already covers them, and collecting them again reported one `eval` twice —
pinned in both shapes.

**A namespace is code; a declaration is not.** `ModuleDeclaration` is three declarations wearing one
node kind, and the first version of this fix took all three: the architecture review measured
subjects named `global.gf` and `'virtual:mod'.mg` — a module specifier, quote and colon included, in
an element name — and an ordinary adopter rule about function names reporting them. The filter is
the ambient test, and only that: `declare global {}` and `declare module 'x' {}` carry the keyword
and go, while `namespace N {}` and the legacy `module N {}` hold code and stay. Filtering by
declaration KIND instead dropped the legacy spelling — a false green found by the sabotage matrix,
not by the review — and two further filters that guarded the other forms could not be made to fail,
so they are not in the code.

Measured, one position per row, `functionNoEval` over `functions(p, { includeObjectLiteralFunctions: true })`:

| position                              | before | after | where it is read instead      |
| ------------------------------------- | ------ | ----- | ----------------------------- |
| a function declaration (control)      | 1      | 1     | —                             |
| a class expression's method           | **0**  | 1     | —                             |
| a namespace class's method            | **0**  | 1     | —                             |
| a namespace's function declaration    | **0**  | 1     | —                             |
| a namespace's arrow const             | **0**  | 1     | —                             |
| an object literal's getter and setter | **0**  | 1 + 1 | —                             |
| a static block                        | 0      | 0     | the class rules (measured 1)  |
| a class field that holds no function  | 0      | 0     | the class rules (measured 1)  |
| a function passed to a call           | 0      | 0     | the module rules              |
| a function a conditional chooses      | 0      | 0     | the module rules              |
| a callback at module level            | 0      | 0     | the module rules (measured 1) |
| a class inside a function             | 1      | 1     | one finding, not two          |

**What this fix does not close**, each filed rather than left:

- [0333](../0333-the-recommended-floor-reads-functions-only.md) — the `recommended` floor builds
  every rule with `functions()`, so the three positions ruled out above are checked by no rule an
  adopter installs. That is the severity claim of this record, and it survives the ruling.
- [0334](../0334-classes-cannot-select-a-class-expression.md) — `classes()` is typed on
  `ClassDeclaration` from its predicates to `searchClassBody`, so a class EXPRESSION is still not a
  subject of a class rule, though its members are now read by the function rules.

## Verification

- [x] KNOWN-GAP tests pinned today's behaviour — the two filed with this record, one for the
      function rules and one for the class rules. Both were red against the fix before the file was
      replaced.
- [x] a measured ruling per position — see **Fix**, with the table measured before and after.
- [x] the fix, the KNOWN-GAP tests inverted, a sabotage matrix —
      `packages/ts/tests/rules/function-positions-the-builder-collects.test.ts` ·
      `it('reads a class expression, a namespace, and an object literal accessor')`,
      `it('leaves a static block, a class field and an inline callback to the class and module rules')`,
      `it('reads a namespace class with the class rules too')` and
      `it('reports one finding for a class or a namespace inside a function, not two')`.
- [x] Sabotage matrix over this PR's two test files, sources restored by sha256 and verified, the
      tree unchanged. R0, as built: nothing red. R1, namespaces not a scope; R2, a class expression
      not a class; R3, an accessor not a function; R4, a namespace member unqualified; R5, a nested
      namespace collected again; R6, the class builder reading top-level classes only — each reddens
      its own test.
- [x] the architecture review's findings closed — ambient declarations are not scopes, pinned by
      `it('collects nothing from an ambient module, a global augmentation or a declare namespace')`,
      which names the subjects rather than counting them; the class walk goes through the shared
      walk cache as every other walk in the package does; and the new name collision
      (`class Expr`, `const Expr = class`, `namespace Expr` all reporting `Expr.m`) is named in the
      code beside the one the prefix removes.
- [x] `npm run validate` green.
- [x] the severity's other half re-homed, not closed: the floor still runs only `functions()`, so
      the three ruled-out positions pass the preset an adopter installs — `deferred→`
      [0333](../0333-the-recommended-floor-reads-functions-only.md), pinned there. The class-rule
      half of this record's last paragraph is `deferred→`
      [0334](../0334-classes-cannot-select-a-class-expression.md).

Deferred: 0333, 0334.
