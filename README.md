# Forkestra

A year of GitHub contributions, played back as music.

Paste any GitHub profile link and the last 53 weeks of that contribution graph turn into a short
piece of music, about a minute and a half long. Nothing to install, and no sign in.

**[Open Forkestra](https://pragyaangaur.github.io/forkestra/)**

## How the graph becomes music

The graph is read left to right, exactly the way you read it on a profile page. One day is one
eighth note, so a full year runs about ninety seconds.

| In the data | What you hear |
| --- | --- |
| Commits on a day | How high and how loud that day's note rings, placed on a pentatonic scale so nothing lands sour |
| A day with nothing on it | A rest |
| A day well above your usual | A fifth stacked on top of the note |
| The week's total | Which bass note holds underneath, and how hard it lands |
| Every four weeks | The chord moves on through a four chord progression |
| A heavy month | The pad picks up a 9th and thickens |
| Streaks | Drums. Three days running brings in a backbeat, and by a week the hats are going |

Daily counts are measured against the 92nd percentile of your own active days, so one enormous
Saturday will not flatten the rest of the year into silence. The density of the piece tracks the
density of the year it came from.

Four moods (Dawn, Dusk, Neon, Glass) swap the key, scale, waveforms, reverb and drum weight, and
tempo and volume can be moved while a track is playing.

## Sharing a year

Every lookup writes the username into the URL:

```
https://pragyaangaur.github.io/forkestra/?u=octocat
```

Anyone opening that link arrives at the same graph with a play button waiting for them.

## Where the data comes from

Contribution counts are not part of GitHub's public REST API, so Forkestra reads them from a public
CORS enabled contributions endpoint, with a second endpoint as backup. Avatars come straight from
`github.com/<user>.png`. No token is involved and nothing that happens here is stored.

## Built with

Plain HTML with vanilla JavaScript. Every sound is synthesised live in the browser through the Web
Audio API, down to the reverb and the drums, so there are no audio files and no libraries.
