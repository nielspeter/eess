# ADR-002: one word, one meaning

## Context

Two modules used `item` for different things.

## Diagram

```Mermaid
graph TD
  glossary --> modules
```

## Consequences

- the glossary is the reference

## Enforcement

Reviewed by hand, and `src/layers.py:3` checks the imports it touches.
