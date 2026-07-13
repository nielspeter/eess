Feature: Docstring guard
  Scenario: Real scenario
    Given a doc string
      """
      Scenario: Not a real scenario
      Feature: Not a real feature
      """
    Then only the real one is parsed
