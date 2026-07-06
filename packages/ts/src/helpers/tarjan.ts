/**
 * An adjacency list representation of a directed graph.
 * Keys are node indices, values are arrays of neighbor indices.
 */
export type AdjacencyList = Map<number, number[]>

/**
 * Find all strongly connected components in a directed graph
 * using Tarjan's algorithm.
 *
 * Returns only components with size > 1 (i.e., actual cycles).
 * Each component is an array of node indices forming a cycle.
 *
 * Time complexity: O(V + E)
 * Space complexity: O(V)
 *
 * @param nodeCount - Total number of nodes (0-indexed)
 * @param edges - Adjacency list: node index -> list of neighbor indices
 * @returns Array of strongly connected components (size > 1)
 */
export function tarjanSCC(nodeCount: number, edges: AdjacencyList): number[][] {
  const index = new Array<number>(nodeCount).fill(-1)
  const lowlink = new Array<number>(nodeCount).fill(-1)
  const onStack = new Array<boolean>(nodeCount).fill(false)
  const stack: number[] = []
  let currentIndex = 0
  const sccs: number[][] = []

  function strongConnect(v: number): void {
    index[v] = currentIndex
    lowlink[v] = currentIndex
    currentIndex++
    stack.push(v)
    onStack[v] = true

    const neighbors = edges.get(v) ?? []
    for (const w of neighbors) {
      // lv/lw/iw are always defined here (v and w are bounded indices into
      // pre-filled arrays); the guards satisfy noUncheckedIndexedAccess.
      const lv = lowlink[v]
      if (index[w] === -1) {
        // w has not been visited
        strongConnect(w)
        const lw = lowlink[w]
        if (lv !== undefined && lw !== undefined) lowlink[v] = Math.min(lv, lw)
      } else if (onStack[w]) {
        // w is on the stack, so it's in the current SCC
        const iw = index[w]
        if (lv !== undefined && iw !== undefined) lowlink[v] = Math.min(lv, iw)
      }
    }

    // If v is a root node, pop the SCC
    if (lowlink[v] === index[v]) {
      const scc: number[] = []
      let popped = stack.pop()
      while (popped !== undefined) {
        onStack[popped] = false
        scc.push(popped)
        if (popped === v) break
        popped = stack.pop()
      }

      // Only report cycles (size > 1)
      if (scc.length > 1) {
        sccs.push(scc)
      }
    }
  }

  for (let v = 0; v < nodeCount; v++) {
    if (index[v] === -1) {
      strongConnect(v)
    }
  }

  return sccs
}
