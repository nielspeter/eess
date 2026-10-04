---
'@nielspeter/eess-ts': minor
---

`extendType` selects a type alias that intersects the named type

**Breaking — a selector selects more.** Fixes
[bug 0376](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0376-extendtype-on-a-type-alias-reads-the-alias-name.md).

For a type alias, `extendType` tested its name against the alias's **printed** type, and for
most aliases that is the alias's own name. So `type X = BaseConfig & { b: 1 }` — the alias
shape most likely to mean "extends" — was never selected by `extendType('BaseConfig')`.

It now also reads the alias's type node: an intersection member counts, written as the name,
through an aliased import, or as an interface that reaches the type by its own chain. A rule
selecting with `extendType` can report new violations on a tree you did not change; they are
real. Every alias that matched before still matches, and one that only holds the type in a
property (`{ inner: BaseConfig }`) still does not.

Not yet covered: an alias of an intersection alias, a plain alias of a sub-interface, and a
wrapped member like `Partial<BaseConfig> & {…}`
([bug 0383](https://github.com/nielspeter/eess/blob/main/work/bugs/0383-extendtype-stops-at-one-alias-level.md));
and the older printed-type test can select by a module's file name or through some generic
arguments, like `Map<string, BaseConfig>`
([bug 0384](https://github.com/nielspeter/eess/blob/main/work/bugs/0384-extendtype-printed-type-matches-by-module-path.md)).
