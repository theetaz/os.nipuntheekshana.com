---
lede: 'A payment rail that does not exist yet in Sri Lanka: the customer pays in crypto and the merchant receives rupees.'
role: 'Founder, architecture and engineering'
facts:
  - { value: '9', label: 'Go services' }
  - { value: '~50', label: 'Coins accepted' }
  - { value: '12 / 15', label: 'Build phases done' }
  - { value: 'LKR', label: 'What the merchant receives' }
---

## The gap

If a Sri Lankan merchant wants to accept crypto and end up with rupees in the bank, there is no rail for it. International processors settle in dollars. Local gateways do not touch crypto at all.

OpenPay is my attempt at the missing piece. A customer pays in BTC, ETH, USDT or one of about fifty other coins, and the merchant is settled in LKR. There is a side benefit: crypto transactions are irreversible, so chargebacks stop being a category of problem.

## How it is put together

Nine Go services sit behind an API gateway: payments, merchants, settlement, webhooks, exchange rates, subscriptions, notifications and admin. Each owns its own PostgreSQL database, and they talk to each other over a message stream.

## The decisions that matter when it is money

**Floats and money never meet.** Every monetary value goes through a decimal type. Rounding errors in a payment system are not bugs, they are losses.

**Queries are checked at compile time.** All SQL is generated from the schema, so a query that does not match the database fails the build, not a customer's payment.

**Merchants verify webhooks with a public key.** Requests to the merchant API are signed with a shared secret, but webhooks are signed asymmetrically. A merchant can confirm a payload came from OpenPay without holding anything that could be used to forge one.

**No single exchange owns the platform.** A provider layer abstracts several exchanges, so one of them changing its terms or its API does not take the product down.

## Where it stands

Twelve of fifteen build phases are complete, including the merchant portal, the admin dashboard and the checkout flow. Smart contracts for on-chain subscriptions, a WooCommerce plugin and a final hardening pass are still ahead.
