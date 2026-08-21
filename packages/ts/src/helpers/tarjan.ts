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
/**
 * Read an index that the algorithm guarantees is in range.
 *
 * `noUncheckedIndexedAccess` types every element access as `T | undefined`, and
 * the original code answered that with `!` — which ADR-005 bars, and which turns
 * a genuinely impossible state into silence if it ever stops being impossible.
 * A named accessor narrows for real and fails LOUDLY instead: every index here
 * comes from `edges`, so an out-of-range one means the caller's adjacency list
 * disagrees with `nodeCount`, which is worth an error rather than a `-1` that
 * reads as "unvisited" and quietly changes the result.
 */
function at(values: readonly number[], i: number, what: string): number {
  const value = values[i]
  if (value === undefined) {
    throw new RangeError(
      `tarjanSCC: ${what}[${String(i)}] is outside the graph (${String(values.length)} nodes) — ` +
        'the adjacency list names a node that nodeCount does not cover.',
    )
  }
  return value
}

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
      if (index[w] === -1) {
        // w has not been visited
        strongConnect(w)
        lowlink[v] = Math.min(at(lowlink, v, 'lowlink'), at(lowlink, w, 'lowlink'))
      } else if (onStack[w]) {
        // w is on the stack, so it's in the current SCC
        lowlink[v] = Math.min(at(lowlink, v, 'lowlink'), at(index, w, 'index'))
      }
    }

    // If v is a root node, pop the SCC
    if (lowlink[v] === index[v]) {
      const scc: number[] = []
      let w: number
      do {
        const popped = stack.pop()
        if (popped === undefined) break
        w = popped
        onStack[w] = false
        scc.push(w)
      } while (w !== v)

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
