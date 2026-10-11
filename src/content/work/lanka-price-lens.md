---
lede: 'Sri Lanka’s food prices, every day, in one place: open markets and supermarkets side by side, with the source page and row behind every number.'
role: 'Founder, data pipeline and product'
facts:
  - { value: '3', label: 'Official bulletins collected' }
  - { value: '4', label: 'Supermarket chains captured daily' }
  - { value: '363', label: 'Costed recipes' }
  - { value: '100%', label: 'Prices traceable to a source' }
---

## The question

What does a kilo of big onions cost today, and where is it cheapest? In Sri Lanka the honest answer used to be "open four websites and three PDFs". Official bodies publish wholesale and retail prices daily and weekly; supermarkets publish shelf prices online. Nobody puts them next to each other.

PriceLens does, at [badumila.com](https://badumila.com).

## How the data gets in

**Official bulletins.** The pipeline collects HARTI's daily wholesale prices, the Central Bank's daily price report and the Department of Census and Statistics' weekly retail prices exactly as published. The original files are archived, and every parsed price keeps the page and row it came from.

**Supermarket shelves.** Each morning it captures prices from the online stores of four chains.

**One vocabulary.** A bulletin says "B'Onion Imported"; a shelf says "Big Onions". Both map to one reviewed product. Labels the system has not seen wait for a human instead of being guessed.

## The rule I care about most

**A failed parse is quarantined, not published.** When a PDF layout changes and a number looks wrong, the pipeline holds it back. A price site that is sometimes confidently wrong is worse than one that is occasionally a day late, because people make real decisions with it.

That is also why provenance is a first-class feature and not a footnote. You can follow any price back to the document it was read from.

## What it turns into

- **The board**: every product, markets and supermarkets side by side, and the month's biggest movers.
- **A basket** that prices your shopping list at every store in the quantities you actually buy.
- **Recipes** matched to what you already have, costed at today's cheapest prices.
- **Alerts** by email and Telegram when something you watch moves.

## Where it stands

Live, running on one server with PostgreSQL behind the price views, and open source so that the method can be checked as easily as the numbers.
