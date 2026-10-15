Feature: A waiver written inside doc strings
  Scenario: Same title
    Given a doc string
      """
      // eess-exclude-start gherkin/unique-titles: prose inside a doc string, not a comment
      """
  Scenario: Same title
    Given another doc string
      """
      // eess-exclude-end
      """
