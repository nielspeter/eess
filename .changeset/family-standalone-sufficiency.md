---
'@nielspeter/eess-md': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

New kernel re-exports closing real standalone-sufficiency gaps — plan 0089 Phase 1.

**Fixed (0.x — minor signals the addition, not a 1.0 stability claim):** each
sibling dialect promises to be a complete tool on its own — a user installing
only one package gets everything they need, with no second, direct
`@nielspeter/eess` install. A new `family.rules.ts` dogfood gate
(`check:family`) now asserts this mechanically, and running it against the
real repo for the first time surfaced genuine gaps in every dialect:

- **`@nielspeter/eess-mermaid`** was missing `marksAssertsCardinality` — the
  one kernel symbol `conditions/class.ts` used internally that its own
  `core/index.ts` barrel didn't carry.
- **`@nielspeter/eess-gherkin`** had **zero** kernel re-exports before this
  fix, despite its own `builder.ts` importing `RuleBuilder`, `Condition`,
  `Predicate`, and `ArchViolation` directly. All four are now re-exported.
- **`@nielspeter/eess-crossvalidate`** — the family's binding tool, and the
  one dialect with no allowlist exception — had none of its 7 flat entry
  files (`mermaid-ts`, `md-ts`, `md-mermaid`, `files`, `md-gherkin`,
  `gherkin-ts`, `md-mermaid-er`) re-exporting the kernel symbols each one
  imports (`correspondence`, `finishPreset`, `ArchViolation`, `Direction`,
  `Selection`, `ElementInfo`, `PresetReportOptions`). Each subpath now
  re-exports exactly what it itself imports.
- **`@nielspeter/eess-md`** had **zero** kernel re-exports before this fix,
  despite `rules/ledger.ts`/`rules/adr.ts` using `RuleBuilder`, `Predicate`,
  `Condition`, `ConditionContext`, `ArchFix`, `PresetReportOptions`,
  `PresetBaseOptions`, `finishPreset`, `generateCodeFrame`, `not`,
  `dispatchRule`, `validateOverrides` internally. All now re-exported. Also:
  `correspondence`/`CorrespondenceBuilder` — required by this package's own
  README example (`rows()` + `correspondence()`, the flagship way to bind a
  markdown table to code) but never actually re-exported, so that documented
  example did not compile against `@nielspeter/eess-md` alone; found in
  review, fixed the same way.
- **`@nielspeter/eess-ts`** gained its whole preset-authoring toolkit
  (`reportViolations`, `dispatchRule`, `validateOverrides`,
  `throwIfViolations`, `finishPreset`, `presetConstructsNothingViolation`,
  `RuleSeverity`, `PresetBaseOptions`, `PresetReportOptions`, `ReportMode`,
  `ReportOptions`) at the package root — a convenience, not a gap fix: these
  were already reachable via the `/presets` subpath, and 0088 already
  ratified "root or presets" as satisfying standalone sufficiency for this
  package. No second install was ever required here.

**Migration:** none needed — every change here is a new, additive re-export.
Nothing that worked before stops working.
