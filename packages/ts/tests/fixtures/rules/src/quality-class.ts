/**
 * Fixture: a class with code quality violations.
 * Used by tests/rules/code-quality.test.ts
 */
export class BadQualityService {
  // Public mutable field — should be private
  public counter = 0

  // Public field without explicit scope — also a violation
  name: string

  // Static readonly — should NOT be a violation
  static readonly VERSION = '1.0'

  // Protected field — should NOT be a public-field violation
  protected status = 'active'

  constructor(name: string) {
    this.name = name
    this.counter = 99 // magic number in constructor (not scanned by noMagicNumbers)
  }

  // Public method without JSDoc — violation
  increment(): void {
    this.counter += 42 // magic number
  }

  // Protected method without JSDoc — should NOT be a JSDoc violation
  protected update(): void {
    this.counter += 1
  }

  /** Documented method — no JSDoc violation */
  getCount(): number {
    return this.counter * 1000 // magic number
  }

  private reset(): void {
    this.counter = 0 // 0 is allowed
  }
}

export class WellDocumentedService {
  private readonly data: string

  constructor(data: string) {
    this.data = data
  }

  /** Returns the data. */
  getData(): string {
    return this.data
  }
}

/**
 * ECMAScript hard-private fields — `#name`, not the erasable `private` modifier.
 *
 * `getScope()` reports these as `'public'` because they carry no TypeScript
 * accessibility modifier at all, which made `noPublicFields` tell an author to
 * "use private" about a field that is already more private than the modifier
 * version (plan 0165).
 */
export class HardPrivateFields {
  readonly #frozen: string = 'x'
  #mutable = 1

  /** Reads both, so neither is dead. */
  read(): string {
    return this.#frozen + String(this.#mutable)
  }
}


/** A public `readonly` INSTANCE field — immutable, so not this rule's subject. */
export class ReadonlyInstanceField {
  readonly label: string = 'x'

  /** Reads it, so it is not dead. */
  read(): string {
    return this.label
  }
}
