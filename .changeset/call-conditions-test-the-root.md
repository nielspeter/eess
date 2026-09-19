---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the call conditions — `haveArgumentContaining`,
`notHaveArgumentContaining`, `haveCallbackContaining` and `notHaveCallbackContaining` — now test an
argument, and a concise callback's body, itself too (bug 0323). Before, they searched only below it,
so an argument that is the match, or a concise arrow whose body is the match, was not seen, under
`call()` as under `expression()`. So does a module's `notContain`/`contain` under
`{ scopeToModule: true }` for a top-level initializer. Newly reported, for example:

- `use(legacy(1))` under `notHaveArgumentContaining(call('legacy'))`;
- `app.get('/', () => db.query(sql))` under `notHaveCallbackContaining(call('db.query'))`;
- `const env = process.env` under `modules(p).should().notContain(access('process.env'), { scopeToModule: true })`.

`haveArgumentContaining`, `haveCallbackContaining` and `contain` stop failing such code. The callback
conditions still search a block body below its braces, as a function's own body is searched; the
argument conditions read a callback argument whole, as before. A broad match inside a concise body is
reported once, not beside the body around it. A `call()` or `access()` given a regex can now match an
argument and a call or access inside it, as it already did one level down: `call(/legacy/)` reports
both `legacy(1).then()` and `legacy(1)` in `use(legacy(1).then())`. No shipped rule or preset uses
these conditions or `scopeToModule`.

A green rule may report new findings. Messages are unchanged. A newly reported match on an argument,
a callback body or an initializer itself is numbered after the matches below it, so a finding a
baseline accepted keeps its identity and the new one is reported as new.
