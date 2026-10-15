# Entity: Job Schedule

## Properties

| Property | Type | Required |
| -------- | ---- | -------- |
| id       | UUID | Yes      |

```mermaid
---
title: Job schedule
---
erDiagram
    JobSchedule {
        UUID id PK
        String frontmatterGhost
    }
```
