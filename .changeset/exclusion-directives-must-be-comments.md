---
'@nielspeter/eess': patch
---

An `// eess-exclude` directive is only read where a comment can actually appear.

The parser scanned raw source line by line, so text that merely looked like a
directive — inside a string, a template literal, or a block comment describing
the grammar — was parsed as a real waiver and **silently suppressed a genuine
finding on the next line**. A suppression nobody wrote is the worst direction a
suppression system can fail in.

Strings, templates, regex literals and block comments are now blanked before
directives are read (length- and line-preserving, so reported positions are
unchanged), a directive must open the line's first `//` comment, and the
HTML-comment forms apply only to non-code files. Measured: the parser read its
own documentation as 12 waivers; it now reads 0. Real directives are unaffected —
this repo's own 20 live waivers still apply.

A directive must also **state a reason**, and block directives **nest**. A
reason-free `// eess-exclude <rule-id>` used to suppress with only a line on
stderr — a working kill switch for any rule, on any line, that did not fail the
build. It now reports instead of suppressing. And `-end` closed _every_ open
block, so an inner one silently ended the outer; blocks are a stack and `-end`
pops the innermost. Nesting was previously refused outright rather than
supported.

Audited this repo's own 25 files carrying directives: 24 exclusions, 0 warnings —
every waiver already stated a reason, so nothing here changed behaviour.
