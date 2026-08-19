// A NON-EMPTY corpus for the vacuity matrix — bug 0155.
//
// Every other probe runs over a zero-file project, so each short-circuits at
// `sourceEmpty` and lands its config-finding there. None of them ever reaches
// the assertion-less gate, which fires only when subjects were actually
// selected. Without a non-empty corpus the whole non-vacuity of that gate
// rests on one unit-test file — a single derivation guarding itself.
export class VacuitySubject {
  run(): void {}
}
