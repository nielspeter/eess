// eess-exclude demo/no-forbidden: out of reach — this covers the NEXT line only,
// and the finding is further down, so it suppresses nothing (bug 0255).

export function forbiddenFn(): void {}

export function usesForbidden(): void {
  forbiddenFn()
}
