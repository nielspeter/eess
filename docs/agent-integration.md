# Agent integration recipes

eess's output is designed to be consumed **inside the agent loop** — every
violation carries the rule id, the rationale (`because`), a `Fix:` suggestion,
and `file:line`, in terminal, `--format json`, or `--format github` form. These
three recipes wire that signal into the places agents actually meet it. Each
snippet was executed against a real project before being written down.

_Prerequisite for all three: eess is ESM-only ([ADR-004](../adr/004-esm-only-package.md)) —
your project needs `"type": "module"` in `package.json` (`npm pkg set
type=module`) and Node >= 24._

## 1. CI gate — GitHub Actions

Violations render as inline PR annotations via `--format github`
(`::error file=…,line=…` — shown on the exact offending lines in the diff
view):

```yaml
name: arch
on:
  pull_request:
    branches: [main]
jobs:
  arch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx eess-ts check arch.rules.ts --format github
```

That's the whole job for a normal consumer project: `@nielspeter/eess-ts`
ships prebuilt, so `npm ci` links the `eess-ts` bin directly.

**Monorepo caveat** (only if eess-ts is a _workspace package built from
source_, as in this repo): `npm ci` cannot link a workspace bin whose build
output doesn't exist yet at install time. Build first, then `npm rebuild` to
re-link the bins — this repo's own [`ci.yml`](../.github/workflows/ci.yml)
shows the working order.

## 2. In-loop gate — Claude Code hook

CI feedback arrives after the agent has moved on. A [Claude Code
hook](https://docs.anthropic.com/en/docs/claude-code/hooks) runs the gate
_while the agent works_, so a violation reaches it with `because`/`Fix:` in
the same session that introduced it. In `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx eess-ts check arch.rules.ts --changed 2>&1 | tail -40"
          }
        ]
      }
    ]
  }
}
```

`--changed` scopes the run to files touched on the current branch (`--base
main` to change the comparison branch), keeping the hook fast on large repos.
A non-empty result lands in the agent's context as feedback; the agent fixes
the violation using the `Fix:` line instead of waiting to fail in CI. In this
repo the equivalent fast loop is `npm run check:fast` (spec + corpus + arch,
skipping build and tests).

## 3. Standing instructions — the AGENTS.md sentinel block

`explain --format agent` renders the _actual rules_ as an imperative block
("Do NOT …"), wrapped in sentinel markers, with a check-in-your-loop preamble.
Regenerating it whenever rules change means the agent's standing instructions
**cannot drift from what CI enforces** — eess's own drift-prevention applied
to the prompt layer.

```bash
#!/usr/bin/env bash
# update-agents-block.sh — regenerate the eess block in AGENTS.md (idempotent)
set -euo pipefail

npx eess-ts explain arch.rules.ts --format agent > /tmp/eess-agent-block.md
# Guard: a failed/empty explain must never wipe the existing block.
[ -s /tmp/eess-agent-block.md ] || { echo "explain produced no output — AGENTS.md untouched" >&2; exit 1; }

if grep -q 'eess-ts:start' AGENTS.md 2>/dev/null; then
  # Replace everything between the sentinels with the fresh block.
  awk '/<!-- eess-ts:start -->/{while((getline l < "/tmp/eess-agent-block.md")>0) print l; skip=1; next}
       /<!-- eess-ts:end -->/{skip=0; next}
       skip{next} {print}' AGENTS.md > AGENTS.md.tmp && mv AGENTS.md.tmp AGENTS.md
else
  printf '\n' >> AGENTS.md
  cat /tmp/eess-agent-block.md >> AGENTS.md
fi
```

First run appends the block after your existing content; every later run
replaces only what's between `<!-- eess-ts:start -->` and
`<!-- eess-ts:end -->`. Verified idempotent: running it twice yields one
sentinel pair and identical content, with the surrounding file untouched. Run
it from a git hook, from CI (fail if `git diff` is non-empty afterwards — the
committed block drifted from the rules), or just whenever `arch.rules.ts`
changes.

---

The three compose into one loop: the **sentinel block** tells the agent the
rules before it writes, the **hook** corrects it while it works, and **CI**
is the backstop that makes the rules non-negotiable. Same rules, three
delivery points, zero drift between them.
