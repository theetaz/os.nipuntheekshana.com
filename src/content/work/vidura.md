---
lede: 'Watch any English lesson on YouTube with Sinhala subtitles that read like something a person would actually say, in sync with the video.'
role: 'Founder, product and engineering'
facts:
  - { value: '1', label: 'Translation call per video, with full context' }
  - { value: 'PWA', label: 'Installable, works on any phone' }
  - { value: 'Self-hosted', label: 'Your library stays on your server' }
  - { value: 'සිංහල', label: 'Default language, not the limit' }
---

## Why I built it

The best teaching on YouTube, in maths, programming and science, is overwhelmingly in English. For a Sinhala speaker, that turns a twenty-minute lesson into an hour of rewinding. YouTube's automatic Sinhala captions are word-by-word and close to unreadable, and commercial dubbing services do not cover the language.

Vidura (විදුර) fetches a video's transcript, translates it properly, and lays the subtitles over the player.

## The first problem: getting the transcript at all

My first version worked perfectly on my laptop and failed the moment I deployed it. YouTube treats requests from datacentre addresses as bots, and a cheap VPS lives squarely inside those ranges. No amount of retrying changes that.

The pipeline that shipped has two paths, ordered by quality:

- **YouTube's own caption track**, fetched through a residential proxy. These timestamps are frame-accurate, so this path is preferred.
- **Audio transcription** as the fallback, when there is no caption track. It lands within about three seconds, which is fine for following a lecture and visibly worse for tight subtitle sync.

Because the two paths are not equal, every video says which one it used. A badge shows where the timestamps came from, a computed sync score, and the model that translated it. When the data is lower fidelity, the interface says so.

## The second problem: translation that reads like speech

Translating caption by caption produced a very specific kind of bad. One English term became three different Sinhala words across a lecture; sentences broke in the middle; pronouns lost what they referred to. The cause is simple once you see it: a caption cue is not a sentence. It is wherever the speaker happened to pause.

So Vidura translates the whole transcript in **one structured call**, with the video's title and description for grounding. The model reads the full lecture before it translates a single line, which keeps terminology consistent from minute two to minute forty. Two guardrails protect the result: the core prompt cannot be altered by tone settings, and an alignment check validates the output against the source cues before anything is saved.

## Beyond subtitles

- **Chat grounded in what you have watched.** Ask about one video or your whole library; answers cite the video and the timestamp.
- **Notes pinned to exact moments.**
- **Live progress and a push notification** when a video finishes processing.

## Where it stands

Actively maintained and live. Sinhala is the default, but the target language is a setting.
