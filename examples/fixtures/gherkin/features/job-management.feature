Feature: Job management
  Scenario: View job schedules
    Given an administrator
    When they open the schedule dashboard
    Then they see all scheduled jobs
