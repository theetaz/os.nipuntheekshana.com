---
lede: 'A budgeting app built around how money actually moves in Sri Lanka. It reads your bank SMS on the phone itself, and nothing about your finances ever leaves the device.'
role: 'Founder, product and engineering'
facts:
  - { value: '99.52%', label: 'Accuracy on 6,092 synthetic test messages' }
  - { value: '2.79 MB', label: 'Classifier weights' }
  - { value: '0', label: 'Messages sent to a server' }
  - { value: '3', label: 'Languages: English, සිංහල, தமிழ்' }
---

## Why I built it

Expense trackers rarely fit the way money is recorded here. You either type in every purchase by hand, or you use an app that ships your bank messages to a cloud service to make sense of them. A bank alert carries far more than an amount: a balance, part of a card number, a merchant, a time. I did not want an app whose first request of you is to hand all of that to someone else.

So Salli (සල්ලි, "money") starts from the opposite position. The intelligence comes to the phone.

## A balance is not a plan

The number I actually wanted every morning was not my balance. It was: *how much can I spend today without making the rest of the month harder?*

Salli calls that **Safe to Spend**. It takes the income for the current cycle, sets aside savings and commitments you have approved (rent, a Seettu contribution, bills), subtracts what is already spent, and spreads what is left across the days until payday. You can open the number and see every input. It is guidance, not a verdict.

## How an SMS becomes a transaction

This is the part that took the most care, because a wrong entry poisons the whole ledger.

1. **Rules first.** A rule engine checks the sender and throws out anything that is not a completed transaction: OTPs, promotions, declined payments, pending authorisations, balance-only notices.
2. **Known formats.** Messages that survive are matched against the formats Sri Lankan banks really use.
3. **A small local classifier** handles wording it has not seen, suggesting direction, type, institution and category.
4. **Exact extraction.** A separate extractor copies the amount, currency, account suffix, merchant and time straight from the text. If the message has no amount, nothing invents one.
5. **You confirm.** Every proposal goes to a review screen with the original message beside it. Only confirmed entries join the ledger.

All five steps run on the device. The classifier is 2.79 MB of weights and needs no download or account.

## Two platforms, one principle

Android can read supported bank SMS once you grant permission. Apple does not allow that, so on iOS capture is manual and receipt-first. The ledger and the privacy rule are identical on both.

## Where it stands

In beta. I want to be precise about the accuracy figure: 99.52% is on a suite of 6,092 *synthetic* messages shaped like Sri Lankan bank alerts. It is evidence the engineering works, not proof about real inboxes. Validation on opt-in, redacted real messages is a release gate, not an afterthought. The classifier is also published separately as an open package with a browser playground.
