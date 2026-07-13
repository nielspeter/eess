@admin
Feature: Job management
  Managing scheduled jobs and their execution.

  Background:
    Given an authenticated administrator

  Scenario: View job schedules
    When the administrator opens the job list
    Then all schedules are shown

  @slow @integration
  Scenario Outline: Trigger job manually
    When the administrator triggers "<job>"
    Then an execution log entry exists

    Examples:
      | job             |
      | customer-import |

  Example: Delete job schedule
    When the administrator deletes a schedule
    Then it no longer appears
