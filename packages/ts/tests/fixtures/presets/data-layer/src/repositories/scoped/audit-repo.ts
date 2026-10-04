import { ScopedRepository } from '../../scoped-repository.js'

// Extends BaseRepository through ScopedRepository — conforms to extend-base (bug 0295).
export class AuditRepository extends ScopedRepository {
  constructor() {
    super('audit')
  }
}
