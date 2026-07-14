// A healthy module: no eval, typed errors, real bodies, no stubs, no dup logic.

export class NotFoundError extends Error {}

export function findUser(id: string): string {
  if (id.length === 0) {
    throw new NotFoundError('empty id')
  }
  return id.toUpperCase()
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length
}
