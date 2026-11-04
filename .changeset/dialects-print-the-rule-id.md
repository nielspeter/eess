---
'@nielspeter/eess-mermaid': patch
'@nielspeter/eess-gherkin': patch
---

The text output carries the rule id (bug 0606, in the kernel). `eess-mermaid check` and eess-gherkin's rules print through the kernel's formatter, so their terminal output prints `Rule: <ruleId> — <description>` for a rule with an id, and the plain format prefixes `[<ruleId>] `. None of their own code changes. A caller that parses the text output must expect the id.
