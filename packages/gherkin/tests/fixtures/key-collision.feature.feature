Feature: the sibling whose path absorbs the other's title prefix

  Scenario: Shared
    Given a file path that is the sibling's path plus ".feature"
    Then concatenating path and title without a separator collides
