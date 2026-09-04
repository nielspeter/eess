/**
 * Is a file still text? — the two ways it stops being, as pure functions.
 *
 * Extracted from `scripts/check-workspace-integrity.mjs` so it can be unit
 * tested, following `scripts/lib/family-re-exports.mjs` next door. The gate that
 * uses it runs on import, so a test could not reach these while they lived
 * inside it — and testing review of bug 0247 made the case that this is the
 * first hand-rolled ALGORITHM in `scripts/`, where the other checks are
 * structural sweeps whose behaviour is only observable end to end.
 *
 * Its measurement is the argument: the end-to-end probe reaches exactly one of
 * the six branches below, and five of the acceptance predicates could be deleted
 * with `check:nonvacuity` still reporting `gate coverage — OK`.
 */
/**
 * Is this buffer valid UTF-8, and if not, where does it first go wrong?
 *
 * **The platform decides; the hand-rolled scanner below only locates.** Both
 * reviews of this change made the same point: the scanner was correct — each
 * differential-tested it against `TextDecoder` over millions of inputs with zero
 * disagreements — but nothing in the repo knew that, because the shipped probe
 * exercised one byte pattern out of the five its own comment claimed. A subtly
 * wrong hand-rolled validator UNDER-rejects, and an under-rejecting validator
 * inside an anti-fail-open gate is what ADR-009 calls worse than no check.
 *
 * So the verdict comes from `TextDecoder('utf-8', { fatal: true })`, which is
 * the definition rather than an implementation of it, and the byte walk runs
 * only on the failing path to produce the offset — the entire reason it exists.
 * A bug in the walk can now misreport a LINE NUMBER. It can no longer decide
 * whether the file is text.
 */
function invalidUtf8At(buf) {
  try {
    UTF8.decode(buf)
    return -1
  } catch {
    // Valid UTF-8 never reaches here, so a scanner that wrongly returned -1
    // would silently drop a real finding. Clamp to 0 — the file IS invalid, the
    // decoder said so, and a byte offset we cannot pin is still a finding.
    const at = firstInvalidUtf8(buf)
    return at === -1 ? 0 : at
  }
}

/** One instance, reused: `fatal` decoding is stateless without `{ stream: true }`. */
const UTF8 = new TextDecoder('utf-8', { fatal: true })

/**
 * Byte offset of the first invalid UTF-8 sequence, or -1.
 *
 * The QUIETER half of "source that stopped being text", and the reason this
 * check is not only about NUL. A NUL announces itself — `file(1)` says `data`
 * and grep says `Binary file … matches`. A stray latin-1 byte makes grep exit 1
 * with **no output and no warning at all**, so a sweep that skipped the file is
 * indistinguishable from one that found nothing in it (bug 0247, measured: one
 * appended byte made `grep -c` for a symbol the file declares print nothing,
 * while this very gate reported the workspace clean).
 *
 * Hand-rolled rather than `TextDecoder(…, { fatal: true })` because that throws
 * without saying WHERE, and a finding without a line number sends a reader
 * hunting through a file their tools have stopped reading. Same single pass,
 * same acceptance: over-long forms, surrogates and out-of-range lead bytes are
 * all rejected, which is what `fatal: true` means.
 */
function firstInvalidUtf8(buf) {
  let i = 0
  while (i < buf.length) {
    const b = buf[i]
    if (b < 0x80) {
      i += 1
      continue
    }
    let need = 0
    let lo = 0x80
    let hi = 0xbf
    if (b >= 0xc2 && b <= 0xdf) need = 1
    else if (b === 0xe0) {
      need = 2
      lo = 0xa0
    } else if (b >= 0xe1 && b <= 0xec) need = 2
    else if (b === 0xed) {
      need = 2
      hi = 0x9f
    } else if (b >= 0xee && b <= 0xef) need = 2
    else if (b === 0xf0) {
      need = 3
      lo = 0x90
    } else if (b >= 0xf1 && b <= 0xf3) need = 3
    else if (b === 0xf4) {
      need = 3
      hi = 0x8f
    } else return i
    if (i + need >= buf.length) return i
    for (let k = 1; k <= need; k += 1) {
      const c = buf[i + k]
      const min = k === 1 ? lo : 0x80
      const max = k === 1 ? hi : 0xbf
      if (c < min || c > max) return i
    }
    i += need + 1
  }
  return -1
}

export { invalidUtf8At, firstInvalidUtf8 }
