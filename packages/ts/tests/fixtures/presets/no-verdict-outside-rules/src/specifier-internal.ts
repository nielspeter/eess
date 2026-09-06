// RED — `@nielspeter/eess/internal`. A bare `@nielspeter/eess` glob does not
// match this; measured, which is why the plan carries four globs and not two.
import { isDescribable } from '@nielspeter/eess/internal'

export const check = (v: object): boolean => isDescribable(v)
