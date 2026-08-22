# Forkestra

A year of GitHub contributions, played back by a small orchestra.

Paste any GitHub profile link and the last 53 weeks of that contribution graph turn into a short
piece of music, about a minute and a half long. Nothing to install, and no sign in.

**[Open Forkestra](https://pragyaangaur.github.io/Forkestra/)**

## How the graph becomes music

The graph is read left to right, exactly the way you read it on a profile page. One day is one
eighth note, so a full year runs about ninety seconds.

| In the data | What you hear |
| --- | --- |
| Commits on a day | The melody instrument climbing in pitch and volume, on a pentatonic scale so nothing lands sour |
| One of your standout days | A second instrument answering it half a beat later |
| A day with nothing on it | A rest, or in a light year, a soft chord tone from the harp |
| The week's total | The cello line holding underneath, leaning harder in heavy weeks |
| Every four weeks | The chord turning over on the string section |
| A heavy month | The strings picking up a 9th and thickening |
| Streaks | Percussion. Timpani come in first, then the side drum, and the tambourine keeps a long run moving |

Four ensembles are available: flute over strings, harp and strings, piano and bells, or brass and
timpani. Each one changes the key, the scale and the whole cast of instruments, and tempo and volume
can be moved while a piece is playing.

## Every year gets to sound good

Daily counts are measured against the 92nd percentile of your own active days, so one enormous
Saturday will not flatten the rest of the year into silence.

A graph with only a handful of green squares gets its own arrangement rather than a thinner version
of somebody else's. Notes are held longer, the hall opens up, the harp fills the gaps between your
days with chord tones, and the level is lifted so the piece carries the same weight as a packed
year. A hundred committed days and a thousand both come out sounding like something worth hearing.

## Sharing a year

Every lookup writes the username into the URL:

```
https://pragyaangaur.github.io/Forkestra/?u=pragyaangaur
```

Hit **Copy link** and send it to somebody. They land on the same graph with a play button waiting
for them, and their own username is one field away.

## Where the data comes from

Contribution counts are not part of GitHub's public REST API, so Forkestra reads them from a public
CORS enabled contributions endpoint, with a second endpoint as backup. Avatars come straight from
`github.com/<user>.png`. No token is involved and nothing that happens here is stored.

## Built with

Plain HTML with vanilla JavaScript. Every instrument is synthesised from scratch in the browser the
first time you press play: plucked strings by Karplus-Strong, piano and bells from stacks of
inharmonic partials, bowed strings and winds from harmonic banks with vibrato and breath noise. Each
one is rendered at two or three pitches and transposed from there, the way a sampler works, which
puts a whole orchestra together in about a tenth of a second with no audio files and no libraries.
