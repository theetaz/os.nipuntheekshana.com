---
lede: 'Attendance, billing and notifications for a tuition class of 100+ students, built so that one teacher can run the whole thing on a small VPS.'
role: 'Design and engineering'
facts:
  - { value: '100+', label: 'Students in the class it runs' }
  - { value: '1', label: 'Go process, database included' }
  - { value: 'QR', label: 'Check-in at the door' }
  - { value: 'Offline', label: 'Check-ins queue and sync' }
---

## It started with a stranger's problem

Someone on Reddit described running a tuition class with no system at all: paper attendance lists, and payment disputes with no records to settle them. The class was too big for paper and too small for school software priced per student and designed for a principal's office.

That is a real gap, so I built for exactly that size.

## Three constraints, before any code

- **One operator.** The person deploying this is a teacher, not an infrastructure team. Every extra service is a liability.
- **The classroom door.** Peak load is not requests per second. It is eighty students arriving in twenty minutes, checked in by one person at a door with unreliable signal.
- **Money is the real dispute.** Arguments about attendance are almost always arguments about payment. Attendance without billing solves half the problem.

## The defining decision: the database lives inside the app

The backend is a single Go process with SQLite embedded in it. There is no database server, no connection pool, and no network hop between the code and its data, so queries come back in microseconds. The entire state of the class is one file on one disk. Backing up the system is copying a file.

SQLite's single-writer model is a genuine limit, but a class this size produces nowhere near enough writes for it to matter. Most systems are smaller than their architecture.

Around that core: a React admin portal for rosters, attendance heatmaps, invoices and defaulters, and an Expo mobile app for the door.

## The door

The mobile app has one job: move the queue. A student shows a QR card, or the operator searches a name. One tap marks present or late.

**Offline is treated as the normal state.** Check-ins are written to a local queue first and synced when there is signal. The screen always says whether the server has caught up, with a manual sync button, so the person at the door is never guessing. If check-ins arrive before a session was formally opened, the server opens it.

## Billing is part of it, not bolted on

Sessions produce invoices. Invoices track full and partial payments. A defaulters view surfaces accounts in arrears before that conversation has to happen at the door. Receipts render as PDFs from the same Go process. That is what turns attendance records into evidence.

## Where it stands

Actively developed and running in production for a real class.
