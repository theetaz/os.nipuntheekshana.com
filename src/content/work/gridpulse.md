---
lede: 'One map for every power cut in Sri Lanka: the official CEB outages and what your neighbours are reporting, designed for a phone in a dark room with a weak signal.'
role: 'Founder, product and engineering'
facts:
  - { value: '2 taps', label: 'To report an outage' }
  - { value: '0', label: 'Accounts, emails or phone numbers' }
  - { value: 'Offline', label: 'The primary state, not an error' }
  - { value: '3', label: 'Languages' }
---

## The constraint that shaped everything

An outage tracker is needed most at the exact moment everything around it is failing. The router is off. The mobile network is strained. Your phone is the one working screen, and you would rather not drain its battery.

The information you want mostly exists. The Ceylon Electricity Board publishes outages, and the neighbours know precisely what is happening on the street, which is how you tell a grid fault from your own tripped main. The two never meet. GridPulse puts them on one map, and I designed it outward from that worst case.

## One event, one marker

The app reads official outages from CEB's public endpoints and shows them next to reports from people affected right now. The home screen boils it down to a direct answer: is the power out where you are, and how many neighbours are in the same position?

The hard data problem is duplication. If someone reports a cut that CEB already announced, a naive map draws two pins for one event and turns to noise as reports pile up. GridPulse merges the announcement and the matching reports into a single outage backed by two kinds of evidence. It is not affiliated with CEB; it reads what CEB publishes and adds the street-level picture CEB cannot see.

## Anonymous on purpose

Reporting is two taps and there is no account. On first launch you are given a random pseudonym, something like "Brave Peacock", and that is the only identity attached to anything you submit.

This was a decision about participation more than privacy. Crowd data is only as good as the crowd, and nobody sitting in the dark will complete an email verification to report the obvious. The cost is real and I accepted it knowingly: nothing prevents a wrong or bad-faith report. The official layer provides a verified baseline. A fully verified map that nobody reports into carries no information at all.

## Built for no connection

After the first visit the app shell, the map tiles for your area and the last known outages are cached, so it opens with no signal. A report filed offline waits in a queue and sends itself when the network returns. Big touch targets, one-handed layouts and a dark mode meant to be read in an unlit room.

GPS is optional. A type-ahead search covers every populated place in the country, powered by [GeoPop](/work/geopop), so a free app does not depend on a paid geocoder.

## The name

It runs in English, Sinhala and Tamil. In Sinhala the app is called **කරන්ට් කට්**, "current cut", because that is what people actually say. A translated brand name would have been correct and nobody would have recognised it.

## Where it stands

Live and MIT-licensed.
