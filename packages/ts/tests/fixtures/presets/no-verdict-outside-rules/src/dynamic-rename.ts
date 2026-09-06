// PROBE for the enforcement review's claim: a dynamic import destructured under
// a new name. Both legs are blind on the SAME line — the import leg because
// TYPE_IMPORT_KINDS sets `dynamic: false`, the call leg because the callee text
// is `done`, not `finishPreset`.
export async function report(violations: unknown[]): Promise<void> {
  const { finishPreset: done } = await import('@nielspeter/eess')
  done(violations)
}
