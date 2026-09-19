---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the call conditions — `haveArgumentContaining`,
`notHaveArgumentContaining`, `haveCallbackContaining` and `notHaveCallbackContaining` — now test an
argument, and a concise callback's body, itself too (bug 0323). Before, they searched only below it,
so an argument that is the match, or a concise arrow whose body is the match, was not seen, under
`call()` as under `expression()`. Newly reported, for example:

- `use(legacy(1))` under `notHaveArgumentContaining(call('legacy'))`;
- `app.get('/', () => db.query(sql))` under `notHaveCallbackContaining(call('db.query'))`.

`haveArgumentContaining` and `haveCallbackContaining` stop failing such a call. A callback's block
body is still searched below its braces, as a function's own body is, and a broad match inside a
concise body is reported once, not beside the body around it. No shipped rule or preset uses these
conditions.

A green rule may report new findings. Messages are unchanged. As with any rule that reports more, a
newly reported match above an accepted one in the same declaration takes its ordinal in a baseline:
the accepted match is reported as new, and the new one is hidden until the baseline is reviewed.
Review that declaration's findings before regenerating it.
