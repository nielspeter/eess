---
'@nielspeter/eess-ts': minor
---

Presets enforce again when called with no `report` option, and the
builder-returning form gains an explicit name: `report: 'builders'`.

**Relative to published `eess-ts`, the default is unchanged** — a preset called
with no options runs its rules, emits once, and throws if anything failed, as
ADR-008 states and as `0.2.1` behaves. No adopter action is needed. What is new
is `report: 'builders'`, which builds the rules and runs none of them, for
callers who want to run them themselves (pair it with `checkAll()`).

**Why this changeset exists at all.** Between releases, the default had become
the builder-returning form — not by decision, but as a side effect of overload
ordering when `report` was restored "additively". The effect was that the shape
`docs/getting-started.md` teaches, a bare

```ts
it('enforces layered architecture', () => {
  layeredArchitecture(p, { layers: {…}, strict: true })
})
```

constructed rules, ran none of them, and **passed unconditionally on any
codebase, forever**. TypeScript could not catch it: the return value was already
discarded, so the change was type-invisible at exactly the call site the docs
prescribe. Every other mode — `'throw'`, `'return'`, `'warn'` — had a name; only
this one was reachable by saying nothing.

Naming it restores the default and keeps the capability. All five presets are
affected: `recommended`, `layeredArchitecture`, `strictBoundaries`,
`dataLayerIsolation`, `agentGuardrails`.

Measured: re-introducing the old behaviour now fails **112 tests**. It shipped
green.
