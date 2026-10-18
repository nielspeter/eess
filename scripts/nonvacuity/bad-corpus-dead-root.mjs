#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0465: `corpus()` must refuse a root that matches no
 * file when another root loads, naming it. `docs/**` loads; `dcos-typo/**` is the
 * mistyped root.
 *
 * Exit codes: 1 = refused, naming the dead root; 0 = it loaded silently (the
 * refusal is vacuous); 2 = an unexpected error.
 */
import { corpus, isArchConfigError } from '@nielspeter/eess-md'

const ROOT = 'scripts/nonvacuity/bad-corpus-dead-root'
try {
  corpus({ roots: [`${ROOT}/docs/**`, `${ROOT}/dcos-typo/**`] })
} catch (err) {
  if (isArchConfigError(err) && String(err).includes('dcos-typo')) {
    console.error('bad-corpus-dead-root: corpus/dead-root refused, naming the root')
    process.exit(1)
  }
  console.error(`bad-corpus-dead-root: unexpected error — ${String(err)}`)
  process.exit(2)
}
console.error('bad-corpus-dead-root: the corpus loaded with a dead root, silently — the refusal is vacuous')
process.exit(0)
