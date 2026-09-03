# A document with a waived finding

The directive below states no reason. Under ADR-012 the waiver still applies, so
the broken-link finding is suppressed — and the kernel must put an
unsuppressable configuration finding in its place. If it does not, this document
passes green while a real finding was silenced by a waiver nobody justified.

<!-- eess-exclude probe/links-resolve -->
This link does not resolve: [missing](./no-such-file.md)
