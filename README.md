# انسجام · Insijam

*A calming geometric puzzle game for Windows — a journey through dawn, day, dusk and night.*

Insijam (Arabic for "harmony") is a meditative puzzle game: five chapters, each
with its own sky, its own ambient sound, and its own mechanic — introduced
gently, deepened level by level, and finally woven together in a three-movement
finale.
![لقطة 1](assets/screenshot-1.png)

![لقطة 2](assets/screenshot-2.png)

![لقطة 3](assets/screenshot-3.png)

![لقطة 4](assets/screenshot-4.png)

![لقطة 5](assets/screenshot-5.png)
- **I · Dawn** — rotate linked rings until broken threads bloom into a mandala
- **II · Day** — tilt mirrors to carry beams through prisms, past stones, into crystals
  (some crystals must be fed by two beams at once)
- **III · Dusk** — slide disks of colored light; overlaps blend, some seals want pure
  colors, and the quiet moon must stay dark
- **IV · Night** — the stars sing a phrase; answer it — forwards, backwards, in chords,
  even while the sky itself turns
- **V · Harmony** — ring-gates of light, color-mixing beams, stained glass that re-dyes
  light, a moon that speaks in blended colors, and the finale

29 hand-authored levels, full English/Arabic localization with RTL support,
procedural ambient audio, a two-tier hint system, reduced-motion accessibility,
and local save/resume.

## Running

```bash
npm install
npm run dev        # browser dev server → http://localhost:5183
npm run build      # type-check + production web build into dist/
npm run app        # run the Electron desktop app (uses dist/)
npm run icon       # regenerate build/icon.ico from the procedural icon
npm run dist:win   # full build + NSIS installer → release/Insijam-Setup-*.exe
```

Dev shortcuts: `?level=<id>` (e.g. `?level=dusk-3`) boots directly into a level.
`scripts/drive.mjs` is a Playwright smoke driver; `scripts/electron-smoke.mjs`
launches and screenshots the desktop app.

## Puzzle design is solver-verified

`scripts/design-lab.mjs` contains offline solvers for every mechanic:

- **light** — enumerates all mirror configurations; reports solution count,
  *near-miss* count (configs that light all but one crystal — the measure of
  how deceptive a level is), and minimum flips.
- **blend** — enumerates all anchor combinations.
- **rings / lock** — BFS over legal moves; reports minimum gestures and (for
  the lock) how many reachable states open every beam.

Every level in `src/levels/data.ts` has **exactly one solution** by these
solvers, and ring scrambles are expressed as sequences of legal moves, so they
are solvable by construction. Keep the lab in sync when designing new levels.

## Architecture

Two layers on screen: a single `<canvas>` draws the world (sky, puzzles, map,
ending); a thin DOM layer draws the words (title, buttons, hints, settings) so
text stays crisp, accessible and RTL-correct. Both are themed from the same
live palette every frame. The Electron shell (`electron/main.cjs`) is a quiet
frame around `dist/` — no game logic lives there.

```
src/
  main.ts               entry: fonts, boot, ?level= dev shortcut
  core/
    game.ts             rAF loop, scene lifecycle, snapshot crossfades + light
                        sweep transitions, pointer routing
    types.ts            View + virtual coordinate space (1000 units = min dim)
    save.ts             localStorage persistence: progress + settings
  render/
    palette.ts          5 chapter palettes, color math, additive primary mixing
    background.ts       per-chapter sky *scenes*: rising/high/setting sun,
                        crescent moon + milky way, aurora; pollen/glints/embers;
                        dune shapes per chapter; shooting stars, dusk birds,
                        unity keepsakes; grain + vignette
    ease.ts             easing curves + math helpers
    particles.ts        celebration particles + layered glow-stroke helper
  audio/
    engine.ts           Web Audio: per-chapter drones, generative sparkles,
                        synthesized SFX vocabulary, convolver reverb (no samples)
  puzzles/
    defs.ts             the data language all levels are written in
    base.ts             Puzzle base class + host interface (incl. hover)
    rotator.ts          shared ring drag/snap physics + the link-bond renderer
                        (driver bead → tangential arrow, glows on hover/hold)
    rings.ts   (Dawn)   threads across rotating, linked rings
    light.ts   (Day)    beam tracing: mirrors, prisms, stones, locked mirrors,
                        multi-hit crystals, colored beams, dye panes
    blend.ts   (Dusk)   additive color disks, dark "quiet moon" sockets,
                        linked pairs with visible bonds
    echo.ts    (Night)  star melodies; grow/reverse/drift/chord/color modes
    lock.ts    (Unity)  ring-gates: every beam must reach the core
    finale.ts  (Unity)  scripted three-movement composition of the above
  levels/
    data.ts             all 29 levels + per-level two-tier hint text (en/ar)
  scenes/
    menu.ts             animated title, credits/about panel
    select.ts           constellation map with visual progress
    level.ts            puzzle host: chapter cards, intro hints, nudge lantern,
                        celebration, auto-advance, gentle skip
    ending.ts           the closing sequence through all four skies
  ui/
    dom.ts              DOM layer: buttons, icons, settings panel, theming
  i18n/
    strings.ts          every player-facing word, in English and Arabic
electron/
  main.cjs              desktop shell: window, icon, F11 fullscreen
scripts/
  design-lab.mjs        the level solvers (see above)
  make-icon.mjs         renders + packs build/icon.ico procedurally
  drive.mjs             Playwright smoke driver for the web build
  electron-smoke.mjs    launches and screenshots the desktop app
```

### Design notes

- **Difficulty is measured, not guessed.** Late levels are kept honest by the
  solvers: day-6 has one valid configuration out of 64 with 32 near-misses;
  dusk-6 is one arrangement in 729; the unity lock has a single open state
  among 20,736 reachable ones.
- **Relationships are visible.** Linked rings wear a bond — a bead on the ring
  you turn, an arrow on the ring that follows (with or against you) — and
  partners glow when you hover or hold either. Linked dusk disks share a
  charm-marked thread; sockets lean toward a color while you carry it.
- **Hints never solve.** The lantern offers a first nudge (the idea), then a
  second (a pointer). The full answer is never shown; after ~3 minutes stuck a
  quiet "let it pass" appears instead.
- **Calm failure.** Wrong answers hush, shake softly, and repeat. Nothing ever
  punishes.


## Play it

🎮 **[Download on itch.io](https://jarallah.itch.io/insijam)** — free, Windows desktop app

## About

Designed and built by **Jarallah Al-Jarallah** and **Claude Code**.

🔗 [LinkedIn](https://www.linkedin.com/in/jarallah-al-jarallah)
