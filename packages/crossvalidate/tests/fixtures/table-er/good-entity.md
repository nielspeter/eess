# Entity: Job Schedule

## Properties

| Property       | Type   | Required |
| -------------- | ------ | -------- |
| id             | UUID   | Yes      |
| groupName      | String | Yes      |
| cronExpression | String | No       |

## Relationships

```mermaid
erDiagram
    JobSchedule ||--o{ JobExecutionLog : "triggers"
    JobSchedule {
        UUID id PK
        String groupName UK
    }
```
