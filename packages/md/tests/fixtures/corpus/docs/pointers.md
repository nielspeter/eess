# Pointers

- ok full path: `src/app.ts:3`
- stale full path: `src/app.ts:99`
- broken full path: `src/missing.ts:1`
- ok bare basename: `app.ts:2`
- ambiguous bare basename: `dup.ts:1`

```ts
// fenced pointer must be ignored: src/app.ts:1000
```
