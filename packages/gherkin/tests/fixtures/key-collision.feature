Feature: a title that would collide without the key separator

  Scenario: .featureShared
    Given a scenario whose title starts with the extension of a sibling file
    Then its composite key must not collide with that sibling's
