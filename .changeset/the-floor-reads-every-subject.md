---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the `recommended` floor reads code outside function bodies.

Every rule the preset built read a FUNCTION, so the floor said nothing about anything else.
Measured over eleven positions, ten reported nothing — including a bare `eval('x')` written at the
top of a file, under a rule named `no-eval`. Also silent: `eval` in a class's static block, in a
field initializer, in a callback handed to a call, and a silent catch in any of those places.

Each rule now reads the broadest subject its condition has a variant for: `no-eval`,
`no-function-constructor` and `no-silent-catch` read the module — the whole file — and
`no-empty-bodies` keeps its function subject, because an empty body is a fact about a function and
has no meaning at module scope. The subject kinds nest, so a rule reads exactly one of them and no
call is reported twice. `moduleNoFunctionConstructor` is new and exported for callers who want it
directly.

**A module finding now names the declaration that contains the match** — `c`, `S`, `F.x` — and the
file only when nothing does. `element` is what `.excluding()` keys on, so this keeps working for
the rules that changed subject; it is also a change for anyone using `modules()` rules directly and
excluding by file name. A module finding's identity is built by the same code as before, so no
existing module-rule baseline entry moves because of this change — but it does carry the match's
scope, so renaming an enclosing declaration moves that entry, as it always has.

**What an adopter has to do, in this order.**

1. **Run the check and read the new findings first.** They are the code this floor never looked at:
   a call at top level, in a class's static block or field initializer, in a callback.
2. **Fix or exclude what matters.**
3. **Regenerate the baseline last.** A baseline entry carries the subject kind, so the entries for
   the three rules that changed subject no longer match and their findings return as new.

Regenerating FIRST accepts everything — measured: `eess-ts baseline` on an upgraded project prints
`+7, −1` and goes green, having silently accepted the bare top-level `eval` this release exists to
report. The count is not the finding.

**Two more things move for the three rules that changed subject**, both toward reporting rather than
away from it:

- **A finding's `line` is now the match's line, not the enclosing declaration's** (measured, 2 → 5
  on one fixture). An `// eess-exclude` comment placed on the declaration line no longer covers it;
  move it to the line the finding names.
- **`element` can be LESS qualified than the function subject gave** for shapes the function
  collection named richly — `g.m` → `m`, `N.n` → `n`, `<anonymous>` → the file. An `.excluding()`
  pattern written against the old name may stop matching; the check reports an unused exclusion
  when it does, rather than dropping it silently.

**`expectEmpty` no longer applies to those three rules.** A matched file is always a subject, so
they are never empty. This does not go quiet: a declaration on one of them now fails as the
assertion it is — _"asserted this rule examines nothing, and it examines …"_ — telling you to
remove it.
