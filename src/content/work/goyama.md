---
lede: 'An open knowledge base for Sri Lankan farming, where every fact carries its source. The first deliverable is a schema, not an app.'
role: 'Founder, data modelling and engineering'
facts:
  - { value: '46', label: 'Agro-ecological zones in Sri Lanka' }
  - { value: '2', label: 'Cultivation seasons' }
  - { value: '3', label: 'Languages planned' }
  - { value: 'v0.0', label: 'Corpus version, honestly' }
---

## Why generic advice fails here

Sri Lanka has 46 agro-ecological zones, two cultivation seasons, and local varieties no global crop database has heard of. Advice written for "farmers" in general is close to useless on a specific plot in a specific zone.

The knowledge that does fit exists. It sits in decades of publications from the Department of Agriculture and research institutes, spread across PDFs and websites, usually in one language at a time, and none of it can be queried.

Goyama (ගොයම) is an attempt to make it queryable.

## Data first, code second

The valuable thing here is not an app. It is a structured corpus: crops, varieties, diseases, remedies, cultivation calendars and market context, extracted from public sources into a strict schema.

Two rules make it trustworthy:

**Every field has provenance.** Source URL, the quoted passage, extraction confidence and the reviewer travel with each value. If you doubt a recommendation you can follow it back to the page it came from.

**Nothing about chemical dosages is published without an agronomist signing it off.** A wrong number there hurts someone, so it does not ship on my say-so.

The corpus is released under open licences. The web and mobile apps sit on top of it, and every recommendation is tied to where the user actually is.

## What exists today

I would rather be exact than optimistic. The corpus is at **v0.0**, which means the schema and the pipeline are in progress. Two endpoints run:

- a **geo lookup** that turns any coordinate in Sri Lanka into its district, DS division and agro-ecological zone
- **daily market prices** from the Dambulla Dedicated Economic Centre

Several folders in the repository say "coming soon". They mean it.

## Where it stands

Incubating. Contributors are welcome, and agronomists most of all.
