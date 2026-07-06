// Ambient declaration so the fixtures below can call `forbiddenFn()` without an
// import — keeping each fixture's line numbers trivial to reason about (the
// exclusion-comment matcher is line-sensitive: a single-line comment must sit
// directly above the violation's reported line).
declare function forbiddenFn(): void
