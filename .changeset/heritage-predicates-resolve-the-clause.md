---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `extend()`, `implement()`, `extendType()`, `haveDecorator()`
and `haveDecoratorMatching()` now match a direct base however it is written (bug 0296): through
an aliased import (`extends Base`, where `Base` is `BaseRepository` imported under another name),
a namespace member (`extends base.BaseRepository`) or a mixin call
(`extends Scoped(BaseRepository)`), as well as by its written name.

Used as a selector, each can now select classes it used to skip, so a green rule may report new
findings. Used as a condition, `extend()` and `implement()` stop reporting classes whose base was
written through an alias. The `dataLayer` preset's base-class rule uses `extend()`.

Only the direct base is read. A class that reaches the base through an intermediate class is still
not matched; that is bug 0295.
