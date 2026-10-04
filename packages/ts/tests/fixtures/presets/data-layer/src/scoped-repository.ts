import { BaseRepository } from './base-repository.js'

// An intermediate base: tenancy scoping on top of BaseRepository (bug 0295).
export class ScopedRepository extends BaseRepository {
  protected tenant = 'default'
}
