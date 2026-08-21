# @nielspeter/eess

The dialect-independent **kernel** of the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family.

This package is the engine every eess dialect runs on. It knows nothing about TypeScript, Mermaid, or any specific artifact format; it is generic over the element type being validated.

## What's in here

- `RuleBuilder<T, P>` — the fluent `.that().should().check()` chain, generic over element type `T` and project handle `P`
- `Predicate<T>`, `Condition<T>`, `Matcher<V>` — the interfaces dialects implement
- `ArchViolation` — the violation model; each dialect supplies its own element→violation adapter
- Baseline mode, diff-aware filtering, exclusions, and the terminal/GitHub/JSON formatters
- `definePredicate` / `defineCondition` — extension points for advanced users

## Who uses it

You normally don't install this directly — you install a dialect:

- [`@nielspeter/eess-ts`](https://www.npmjs.com/package/@nielspeter/eess-ts) — TypeScript
- [`@nielspeter/eess-mermaid`](https://www.npmjs.com/package/@nielspeter/eess-mermaid) — Mermaid class diagrams

Install `@nielspeter/eess` directly only when authoring a new dialect or a cross-dialect tool on top of the kernel.

## License

MIT
