---
'@nielspeter/eess-ts': patch
---

A migration guide for `@nielspeter/ts-archunit` users:
https://nielspeter.github.io/eess/migrating-from-ts-archunit

Docs only — nothing in the package changes.

Most projects change one import line. Four things do change, and the page leads with
the one that is silent: **a preset call in a rule file needs `report: 'builders'`.**
ts-archunit's presets returned builders; eess-ts's enforce by default, so
`export default [...recommended(p)]` spreads the preset's _result_. On a codebase
with violations that fails loudly. On a clean one it spreads an empty array, and
every rule disappears.

The other three: inline `// ts-archunit-exclude` comments are `// eess-exclude` now
(spread across your whole codebase, so the page gives you the grep);
`correspondence()` is `crossProject()` — the only two exports that moved; and the
CLI and config file are renamed.

**Your baseline transfers unchanged** — same filename, same hash version, verified
end-to-end rather than assumed.
