# Entity: Job Schedule

## Properties

| Property | Type | Required |
| -------- | ---- | -------- |
| id       | UUID | Yes      |

```sql
erDiagram
    JobSchedule {
        UUID id PK
        String sqlGhost
    }
```
