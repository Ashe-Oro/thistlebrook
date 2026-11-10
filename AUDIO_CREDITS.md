# Audio credits

Every sound in Thistlebrook is synthesised at runtime with the Web Audio API: oscillators, filtered noise and a generated reverb impulse.

- **No samples:** the repository and the bundle contain no audio files or sampled instruments, so no third-party licences apply.
- **Original material:** all melodies, motifs, chord progressions and the festival jig cells in `src/audio/music.ts` are original to this project.
  - They are written to evoke a sparse, pentatonic open-world style, not to reproduce existing music.
  - No melodies or transcriptions from *The Legend of Zelda: Breath of the Wild* or any other copyrighted work are used.
  - No AI music generator was used.
- **Previews:** the MP3 files in `shots/audio/` and the soundtrack of `shots/music_demo.mp4` are offline renders of this same engine (`tools/music/render.mjs`).

| Component | Source | Licence |
|---|---|---|
| Piano, felt piano, celesta/glass, pads/strings, flute, fiddle, frame drum, tambourine, sleigh bells (`src/audio/music.ts`) | Synthesised in code | Project's own |
| Wind, birds, crickets, owl, rain (`src/audio/ambience.ts`) | Synthesised in code | Project's own |
| UI and world effects (`src/ui/sound.ts`) | Synthesised in code | Project's own |
