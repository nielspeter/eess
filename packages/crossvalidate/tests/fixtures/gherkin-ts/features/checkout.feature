@checkout
Feature: Redeem a discount code
  A customer applies a discount code at checkout.

  Scenario: Apply a valid code
    When the customer applies "SAVE10"
    Then the total is 90

  Scenario: Reject an already-used code
    Given "SAVE10" was already used
    When the customer applies "SAVE10"
    Then the code is rejected as expired
