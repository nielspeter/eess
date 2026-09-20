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
excluding by file name. A module finding's identity is keyed on the file and the matcher, so
baselines built on module rules are unaffected.

**What an adopter has to do.** A baseline built on the floor must be regenerated for the three
rules that changed subject: a baseline entry carries the subject kind, so their existing entries no
longer match. Expect new findings too — that is the point of the change.

**`expectEmpty` no longer applies to those three rules.** A matched file is always a subject, so
they are never empty. This does not go quiet: a declaration on one of them now fails as the
assertion it is — _"asserted this rule examines nothing, and it examines …"_ — telling you to
remove it.
