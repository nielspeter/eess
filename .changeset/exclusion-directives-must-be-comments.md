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
