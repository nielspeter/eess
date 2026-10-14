# Entity: Job Schedule

## Properties

| Property  | Type   | Required |
| --------- | ------ | -------- |
| id        | UUID   | Yes      |
| groupName | String | Yes      |

## Relationships

- The diagram:

  ```mermaid
  erDiagram
      JobSchedule {
          UUID id PK
          String ghostColumn
      }
  ```
