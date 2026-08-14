Feature: Redeem a discount code
  A customer applies a discount code at checkout.

  Scenario: Apply a valid code
    When the customer applies "SAVE10"
    Then the total is 90
