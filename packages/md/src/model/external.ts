/**
 * A URL that points outside the repository: it has a scheme (`https:`, `mailto:`) or is
 * protocol-relative. One owner (bug 0565), so `links()`, `mentions()` and the front-matter guard
 * cannot disagree about which link is internal.
 */
export const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i
