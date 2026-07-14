/* eslint-disable */
// A fixture that trips every recommended/agentGuardrails rule. Each function is
// deliberately unhealthy; this file is never executed.

export function runEval(src: string): unknown {
  return eval(src) // no-eval
}

export function buildFn(body: string): unknown {
  return new Function('a', body) // no-function-constructor
}

export function swallow(): number {
  try {
    return risky()
  } catch {
    return -1 // no-silent-catch (catch does not reference the error)
  }
}

export function unfinished(): void {
  // no-empty-bodies
}

export function loadThing(id: string): string {
  if (!id) {
    throw new Error('bad id') // no-generic-errors
  }
  return id
}

export function stubbed(): string {
  // TODO: implement this properly
  return ''
}

// no-copy-paste: two near-identical bodies
export function sumA(xs: number[]): number {
  let total = 0
  for (const x of xs) {
    total = total + x
  }
  return total
}

export function sumB(ys: number[]): number {
  let total = 0
  for (const y of ys) {
    total = total + y
  }
  return total
}

function risky(): number {
  return 1
}
