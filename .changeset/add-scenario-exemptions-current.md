---
'@nielspeter/eess-crossvalidate': minor
---

Add `scenarioExemptionsCurrent` to `gherkin-ts` — detects a Gherkin
scenario whose exemption (e.g. a `@wip` tag paired with `scenariosCovered`'s
`include`) is still in force after a real test has already cited it, so a
stale exemption doesn't silently outlive its reason (proposal 005, plan
0145). Also exports `citedScenarioSites` and `TestCitationSite` (where a
citation lives, not just that one exists) and the `TestCitationExtractor`
type alias (replacing two duplicated inline signatures). Purely additive —
`scenariosCovered`/`scenarioTestsResolve`'s existing behavior is unchanged.
