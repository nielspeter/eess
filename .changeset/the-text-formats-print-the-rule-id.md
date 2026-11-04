---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': patch
---

The terminal and plain formats print a violation's rule id (bug 0606). `formatViolations` (the terminal output of `reportViolations`, `finishPreset`, `.check()` and `.warn()`, and so of every dialect CLI) prints `Rule: <ruleId> — <description>` when the rule has an id, and `formatViolationsPlain` prefixes `[<ruleId>] ` to the violation's line. The id is the handle an `// eess-exclude` comment and a preset's `overrides` name, and only JSON and GitHub output carried it. A finding whose description is its id (the `emitter/*` findings) prints it once; a rule without an id reads as before. `eess-ts baseline` lists a vacuous rule by its id when it has one, as `check --fix` already did. A caller that parses the text output must expect the id.
