# Forkestra

Context for anyone, human or AI, picking this up cold. Written 4 September 2026.

Note the folder on disk is called "GitHub Music" but the project and the repo are called Forkestra.

## What it is

A year of GitHub contributions played back by a small synthesised orchestra. Paste a profile link and the last 53 weeks of that contribution graph become about ninety seconds of music.

- Repo: https://github.com/pragyaangaur/Forkestra
- Live: https://pragyaangaur.github.io/Forkestra/
- Language: plain HTML with vanilla JavaScript. No build step, no libraries, no audio files.
- Licence: MIT

## Status

**Update, 23 September 2026.** The repository now has an MIT `LICENSE`, added in commit `3c671b7`. Before that it had no licence at all. Nothing else has changed.

Finished and shipped. Two commits on 22 August 2026: `f246fd6 Commit Sounds` laid down the sonification, then `0186a25 Added Orchestra` replaced the simple voices with the full synthesised ensemble. Nothing is in progress.

## Layout

| File | Job |
| --- | --- |
| `index.html` | The page and the controls. |
| `app.js` | Fetches the graph, maps it to notes, drives playback. |
| `audio.js` | The synthesis. Every instrument is built from scratch in the browser. |
| `styles.css` | Styling. |

## How the mapping works

The graph is read left to right, one day per eighth note.

- Daily commit count drives the melody instrument's pitch and volume, on a pentatonic scale so nothing lands sour.
- A standout day gets a second instrument answering half a beat later.
- An empty day is a rest, or in a light year a soft harp chord tone.
- The week total holds the cello line underneath.
- The chord turns over every four weeks on the strings, and a heavy month thickens them with a 9th.
- Streaks bring in percussion: timpani first, then side drum, then tambourine for a long run.

Four ensembles are selectable, and each changes key, scale and the whole cast.

## The two decisions worth preserving

- **Counts are measured against the 92nd percentile of the user's own active days**, so one enormous Saturday does not flatten the rest of the year into silence.
- **A sparse graph gets its own arrangement rather than a thinner version of a busy one.** Notes are held longer, the hall opens up, the harp fills gaps with chord tones, and the level is lifted. A hundred committed days and a thousand should both sound worth hearing.

## Where the data comes from

Contribution counts are not in GitHub's public REST API, so Forkestra reads a public CORS-enabled contributions endpoint with a second endpoint as backup. Avatars come from `github.com/<user>.png`. No token, nothing stored. If the tool ever breaks, the endpoint going away is the first thing to check.

Instruments are synthesised at two or three pitches and transposed from there, the way a sampler works, which is what puts a whole orchestra together in about a tenth of a second.

## Sharing

Every lookup writes the username into the URL as `?u=<user>`, and Copy link hands that over.
