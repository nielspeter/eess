/**
 * adr-enforce — make an ADR clause enforceable, with the author/verifier
 * separation ENFORCED (plan 0077).
 *
 * The two skills (eess-adr-author, eess-adr-validate) are inline today, so running
 * them in one session lets the validator see the author's reasoning — the
 * reward-hacking gap. This workflow closes it structurally: author and validator are
 * SEPARATE agent() calls (separate context windows — the validator cannot read the
 * author's reasoning, only the files) on DIFFERENT models. Bounded to 2 fix rounds;
 * on non-convergence it escalates (leaves the Enforcement row `pending` for a human
 * to ratify — Tier 5, adoption stays a human act).
 *
 * Invoke:
 *   Workflow({ scriptPath: '.claude/workflows/adr-enforce.mjs',
 *              args: { clause: '<the ADR clause prose>', adrPath: 'adr/NNN-....md' } })
 */

export const meta = {
  name: 'adr-enforce',
  description:
    'Make an ADR clause enforceable: an author agent writes the eess rule + Enforcement row, then an independent validator agent (separate context, different model) checks faithfulness; bounded fix loop, green-or-escalate.',
  whenToUse:
    'Making an ADR clause enforceable when you want the author/verifier separation enforced structurally, not left to discipline.',
  phases: [{ title: 'Author' }, { title: 'Validate' }, { title: 'Fix' }],
}

// --- config ---
const AUTHOR_MODEL = 'opus' // strong author
const VALIDATOR_MODEL = 'sonnet' // DIFFERENT model — independence (constraint 2), not weakness
const ROUND_CAP = 2 // Stripe's two rounds; unbounded iteration converges on satisfying the judge

// --- args (accept an object, or a JSON string — harnesses vary) ---
let a = args
if (typeof a === 'string') {
  try {
    a = JSON.parse(a)
  } catch {
    a = {}
  }
}
const clause = a?.clause
const adrPath = a?.adrPath
if (!clause || !adrPath) {
  log('adr-enforce needs args: { clause: "<prose>", adrPath: "adr/NNN-....md" }')
  return { error: 'missing args: need { clause, adrPath }' }
}

// --- schemas (force structured returns; no parsing) ---
const AUTHORED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ruleId', 'files', 'rowText', 'tier'],
  properties: {
    ruleId: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } }, // files created/edited (rule + ADR)
    rowText: { type: 'string' }, // the Enforcement-table row, left `pending`
    tier: { type: 'string' }, // tier chosen (1–5)
  },
}
const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'confidence', 'gap', 'evidence'],
  properties: {
    verdict: { type: 'string', enum: ['FAITHFUL', 'PARTIAL', 'DRIFTED'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    gap: { type: 'string' }, // one sentence — the specific gap, or "none"
    evidence: { type: 'string' }, // ties a clause phrase to a rule construct
  },
}

const authorPrompt = (extra) =>
  `Follow the eess-adr-author skill at skills/eess-adr-author/SKILL.md to make this ADR clause enforceable.\n\n` +
  `CLAUSE: ${clause}\n` +
  `ADR FILE: ${adrPath}\n\n` +
  `Write the eess-ts rule (or, if the clause is Tier 2+, name the real mechanism), add the Enforcement-table ` +
  `row to the ADR file, and — per the skill — leave the new row's Status \`pending\` (never \`gated\`): the ` +
  `independent validator confirms faithfulness first. Report the rule id, every file you created/edited, the ` +
  `row text, and the tier.${extra ?? ''}`

// --- author (Phase 1) ---
phase('Author')
let current = await agent(authorPrompt(), {
  label: 'author',
  phase: 'Author',
  model: AUTHOR_MODEL,
  schema: AUTHORED_SCHEMA,
})
if (!current) return { error: 'author agent produced nothing' }

// --- validate + bounded fix loop (Phase 2) ---
let verdict
let round = 0
while (true) {
  phase('Validate')
  verdict = await agent(
    `Follow the eess-adr-validate skill at skills/eess-adr-validate/SKILL.md. Adversarially audit whether the ` +
      `rule faithfully enforces the clause. Resolve the citation and read the ACTUAL rule code (selection, ` +
      `every .excluding, the condition), not just the row prose. Default to refuting; let the rule earn FAITHFUL.\n\n` +
      `CLAUSE: ${clause}\n` +
      `RULE ID: ${current.ruleId}\n` +
      `FILES: ${current.files.join(', ')}\n\n` +
      `Return the verdict in the schema.`,
    {
      label: `validate:r${round}`,
      phase: 'Validate',
      model: VALIDATOR_MODEL,
      schema: VERDICT_SCHEMA,
    },
  )
  const faithful = verdict?.verdict === 'FAITHFUL'
  log(
    `round ${round}: ${verdict?.verdict ?? 'no verdict'}` +
      (verdict?.gap && verdict.gap !== 'none' ? ` — ${verdict.gap}` : ''),
  )
  if (faithful || !verdict || round >= ROUND_CAP) break

  round++
  phase('Fix')
  const fixed = await agent(
    authorPrompt(
      `\n\nThe independent validator found this gap in rule ${current.ruleId}: "${verdict.gap}". ` +
        `Fix the rule so it faithfully enforces the WHOLE clause — no over-broad .excluding, no empty selection ` +
        `(verify the target set is non-empty). Keep the row \`pending\`.`,
    ),
    { label: `fix:r${round}`, phase: 'Fix', model: AUTHOR_MODEL, schema: AUTHORED_SCHEMA },
  )
  if (!fixed) break
  current = fixed
}

// --- resolve: green-or-escalate (Phase 2 tail) ---
const faithful = verdict?.verdict === 'FAITHFUL'
if (faithful) {
  log(
    `FAITHFUL after ${round} fix round(s) — ready for a human to ratify 'pending' → 'gated' (Tier 5).`,
  )
} else {
  log(
    `ESCALATED after ${round} fix round(s): last verdict ${verdict?.verdict ?? 'none'}. ` +
      `Row left 'pending' with the gap surfaced — a human ratifies or rejects (Tier 5).`,
  )
}

return {
  ruleId: current?.ruleId,
  files: current?.files,
  tier: current?.tier,
  rounds: round,
  finalVerdict: verdict?.verdict ?? null,
  gap: verdict?.gap ?? null,
  escalated: !faithful,
  // Tier 5: the loop PROPOSES; a human ratifies the pending→gated flip. Never auto-gated.
  readyToRatify: faithful,
}
