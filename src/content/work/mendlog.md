---
lede: 'A field journal for machine-repair technicians: speak the repair in Sinhala or English, add a photo, and skip the paper form.'
role: 'Product design and engineering'
facts:
  - { value: 'Voice', label: 'Instead of a form' }
  - { value: '2', label: 'Languages: Sinhala and English' }
  - { value: 'Android', label: 'First, because that is what technicians carry' }
  - { value: 'Offline', label: 'Every job is saved on the phone first' }
---

## The problem

An industrial repair technician fixes several machines a day. After each job comes a paper form: root cause, corrective action, idle time, parts used. On a busy day the form gets skipped, and most days are busy.

The result is that the knowledge of how a fault was diagnosed and fixed leaves the building with whoever fixed it. The next person facing the same fault starts from zero.

## The idea

Replace the form with something a technician will actually do with greasy hands: **talk, and take a couple of photos.**

MendLog transcribes the memo, pulls out the structured fields the form wanted, and files the job. The technician speaks in Sinhala or English, whichever is natural.

Then the archive becomes useful. Past jobs can be searched, so someone facing a similar fault can pull up how it was solved last time.

## Designing for the real conditions

The targets are mid-range Android phones and patchy connectivity, because that is the factory floor. So the app treats being offline as the normal state, not an error.

- **The phone is the source of truth.** Every read and write goes to a SQLite database on the device. Saving a job makes no network call at all.
- **Sync is a separate, ordered pass.** Jobs go up first, then photos and audio, then the rows that describe them, then deletes, and only then does the app pull. Each insert carries an id made on the phone, so a retry never creates a duplicate.
- **Media is sized for a weak signal.** Photos are resized to 1600 px on the long edge before upload, and a failed upload is retried rather than lost.
- **Transcripts arrive later.** A voice note is saved as a pending clip. Once its audio has synced it is transcribed, and the text appears on the job in the spoken language and in English.

A small badge on every job says where it is in that journey: offline, uploading, processing or synced.

## Where it stands

The app works end to end: the journal, voice notes, photos, search, a calendar of past jobs and background sync. It is built with React Native and Expo on top of Supabase. It is still incubating, and it has not been through a real factory floor yet.
