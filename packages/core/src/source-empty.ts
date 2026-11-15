import { collectResult, mergeCollectResults, type CollectResult } from './collect-result.js'

/**
 * Spike 0640: an input that loaded nothing, reported once beside a receipt
 * ([ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4). Over nothing
 * examined, the receipt keeps its violations and its evidence and says `sourceEmpty` itself, and the
 * terminal or a preset's gate reports it. Beside a non-zero `examined` that flag would contradict
 * (bug 0594), so the input is a member of its own and the merge reports `emitter/source-empty`; the
 * result is the merge's, untouched, since the merge owns its rules (ADR-014 §7).
 *
 * One owner for the rule `correspondence()` and eess-crossvalidate's presets each wrote (plan 0652).
 * `deadGlob` is not kept: over an empty source a glob that matched nothing says nothing, as
 * `RuleBuilder` already drops it. A receipt that already contradicts itself (`notRun` beside
 * findings) keeps its contradiction, so the gate names that cause rather than the empty source; no
 * caller makes one, and either way the build fails.
 */
export function withSourceEmpty(loadedNothing: boolean, receipt: CollectResult): CollectResult {
  if (!loadedNothing) return receipt
  if (receipt.examined === 0) {
    return collectResult(receipt, {
      examined: 0,
      sourceEmpty: true,
      declaredEmpty: receipt.declaredEmpty,
      notRun: receipt.notRun,
      undecided: receipt.undecided,
    })
  }
  return mergeCollectResults([collectResult([], { examined: 0, sourceEmpty: true }), receipt])
}
