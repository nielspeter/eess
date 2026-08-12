Feature: Redeem a discount code
  Its own feature root, so the counts the other tests assert stay put.

  Scenario: Reject a `SAVE10` code that was already used
    Given "SAVE10" was already used
    When the customer applies "SAVE10"
    Then the code is rejected as expired
