@dogfood
Feature: A scenario stays bound to the test that proves it
  eess-crossvalidate binds a Gherkin scenario to the test whose it() title cites
  it, and fails the build when the two drift — in either direction. This feature
  is the use case; the scenarios below are proven by tests in
  tests/scenario-binding.spec.ts whose titles cite them, and check:crossval gates
  that binding.

  Scenario: A cited scenario resolves to a real scenario
    Given a test whose title cites a scenario in the feature set
    When scenarioTestsResolve runs
    Then it raises no violation

  Scenario: A citation with no matching scenario fails the build
    Given a test that cites a scenario absent from the feature set
    When scenarioTestsResolve runs
    Then it reports the dangling citation

  Scenario: A scenario no test cites fails the build
    Given a scenario that no test cites
    When scenariosCovered runs
    Then it reports the uncovered scenario
