// Bug 0265 fixture. The declaration sits low in this file on purpose, so a
// finding anchored on the declaring line is visibly a line the barrel does
// not have.
//
export function dead(): number {
  return 1
}
