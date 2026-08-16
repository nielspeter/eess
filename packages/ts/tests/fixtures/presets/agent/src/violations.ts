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
export function sumA(orderAmounts: number[]): number {
  let runningTotal = 0
  const taxRate = 0.08
  const discountFactor = 1
  runningTotal = runningTotal * discountFactor
  for (const orderAmount of orderAmounts) {
    const adjustedAmount = orderAmount * taxRate
    runningTotal = runningTotal + orderAmount + adjustedAmount
  }
  return runningTotal
}

export function sumB(invoiceAmounts: number[]): number {
  let runningTotal = 0
  const taxRate = 0.08
  const discountFactor = 1
  runningTotal = runningTotal * discountFactor
  for (const invoiceAmount of invoiceAmounts) {
    const adjustedAmount = invoiceAmount * taxRate
    runningTotal = runningTotal + invoiceAmount + adjustedAmount
  }
  return runningTotal
}

function risky(): number {
  return 1
}
