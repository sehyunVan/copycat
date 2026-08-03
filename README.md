# Copycat

> Copycat is a **narcotics operation staffed entirely by cats.**
> Finish your to-dos and the business grows. Leave paperwork lying around
> and the Cat Police come for you.
> And the office runs on **your desktop clock** — at your noon the cats go to
> lunch, and at 6 PM they see you off.

A to-do list × idle management sim × multi-agent sandbox × **a companion that
endures the workday with you**.
Open `index.html` in a browser and it runs. No build step, no server, no dependencies
(the office tileset is a purchased asset — see the install section).
Available in 한국어 · English · 日本語 (⚙️ settings).

🇰🇷 [한국어 README](README.ko.md)

---

## The question this explores

**What happens if "completing a task" is an input to a simulation rather than a score?**
And — **if a game refuses to fast-forward and lives on real time instead, can it help
someone get through the working hours?**

This game is built for people to whom the workday feels very long. Instead of compressing
time, it walks through the actual clock beside you. Completing tasks tidies real office
work and creates events in the world; the clock chip shows a countdown to lunch or
clock-out over a slowly filling gauge; every 50 minutes a cat reminds you to stretch.
The bet is that enduring with company is different from enduring alone.

Most gamified to-do apps do: check the box → +10 points. Here, checking the box
**creates a physical event in the world.** A document drops into the office inbox.
A cat notices it, decides on its own to walk over, picks it up, carries it to its desk,
and stamps it — and only then do you get paid. If every cat happens to be in the litter
box, the paperwork just piles up.

The reverse direction exists too. **Work you *didn't* do also creates events.**
Catnip is a controlled substance here. The company grows it, refines it and moves it,
and is registered as a herbal wholesaler — that registration is the only thing protecting
anyone. So paperwork left unfinished at quarter close doesn't just sit there: it leaks,
and it becomes evidence. **Suspicion** accumulates. Cross the threshold and a warrant is
issued and the Cat Police raid the office. Sometimes they take an employee with them.

You can pay to make suspicion go away, which is exactly the kind of company this is.

And doing nothing is not neutral. A rival outfit takes your clients while you idle.

It isn't just achievement that's rewarded — **failure comes back through the bureaucracy.**
The joke is how quietly realistic that turns out to be.

---

## What's in it

### 1. Cats as autonomous agents

Borrowed from [OpenMMO](https://github.com/Julian-adv/OpenMMO)'s **agent–human parity**
principle ("agents and human players speak the exact same protocol — no privileged API"),
scaled down to one office.

- Cats have **energy / fun / bladder / caffeine** needs and seek out facilities on their own
- Your approvals, a cat's nap, a Legal visit and a police raid all travel through the same
  event bus (`bus`)
- Cats only earn while **actually seated at their desk** — when they go for coffee, revenue really drops
- Pathfinding is BFS. Legal, the police and the rival's runner use the same `goTo()`.
  No NPC walks through walls.

### 2. D&D-style hiring

Also from OpenMMO: new hires roll six stats using **4d6, drop the lowest**.

| Stat | What it does at the office |
|---|---|
| Grit (STR) | Carries more paperwork |
| Agility (DEX) | Moves around the office faster |
| Stamina (CON) | Tires more slowly |
| Planning (INT) | The core of output |
| Tact (WIS) | Feels needs later (patience) |
| Charm (CHA) | Raises everyone else's output |

Three equipment slots (head / neck / paw) modify stats. Equipment drops at quarter close.
It affects stats only — see the pixel art section for why it no longer changes appearance.

**The name and colour are yours to pick, in an interview window.** The dice decide the
stats; the player decides the look and the name — twenty cats all wearing names someone
else gave them never feel like your company.

- **Name** — type it, or press 🎲 to draw one (only names nobody in the office uses). 12 chars max
- **Colour** — 4 coats (black · brown · orange · white) × 6 tints. The swatches are
  **actual cat portraits**, not labels; a colour name alone tells you nothing
- **The applicant persists until hired** (it's in the save). Close the window and reopen
  it and the same cat is waiting — if reopening rerolled the stats, 4d6 would mean nothing.
  What the player picks is the name and colour, not the numbers

**And every cat accumulates a record.** Nobody gets attached to a stat block; they get
attached to an individual with a history. At the bottom of the employee file:

| Line | What it holds |
|---|---|
| Joined | The quarter they were hired. Older saves read **Not on file** — a history that wasn't kept doesn't get invented |
| Documents stamped | Lifetime total, and the breakdown by size |
| Most-visited | Facility arrivals counted, top one shown. The cat who only ever goes for coffee becomes visible |
| Detained | How many times the police took them, and the last quarter it happened |
| First stamp | The quarter and the **title** of their first document — captured at the one moment that text still exists |

The register is deliberately dry. A personnel file being dry is the joke, and it's also
a little sad. Same tone as the cat who comes back cleared of charges and says nothing.

### 3. Procedurally generated offices

When the quarter hits a milestone (3 · 6 · 10 · 15 · 21 · 28) the company relocates and
**a new floor plan is generated**, growing from 12×10 with 2 desks to 26×22 with 20.
Rooms are kept near-square because the viewport is landscape — a wide, short office fills
horizontally first and leaves black bands above and below.

- A **break room** is partitioned off in a corner, with its own walls, a doorway and a
  different floor material. Coffee, the feeder and the cooler go inside it.
- Desks are **two tiles wide**, seating two, arranged in pods across several rows —
  matching how the tileset author's own example offices are laid out.
- Furniture is **categorised**. Break-room items go to the break room, machines pick one
  wall and line up along it, meeting tables want open floor, plants and shelves fill in
  anywhere. Without this the office reads as a warehouse.
- Anything 2×2 or larger stays **against a wall**. A vending machine in the middle of a
  walkway doesn't look like an office.
- Pictures and whiteboards **hang on walls**, tracked separately from the grid so
  pathfinding is unaffected.
- **Every placement passes a connectivity check** — if it would cut the floor into
  disconnected pockets, or leave an existing object with no way to reach it, it's rolled
  back. Without this, cats get walled into corners. They did.
- Verified exhaustively: 7 tiers × 30 seeds = 210 floor plans, zero unreachable desks,
  zero missing facilities, zero bulky pieces stranded in the open.

**The layout is saved, not re-derived.** Buying equipment used to regenerate the whole
office, so every existing piece moved; reloading did the same, because the plan came from
seed-plus-inventory rather than storage. The grid is now stored and restored verbatim.
Generation happens exactly twice — when you found the company, and when you relocate.
Buying a piece places that one piece and leaves everything else alone.

**And now you can move things yourself → next section.**

### 4. Decorate mode — the generator lays it out, then it's your office

Hit 🛋️ in the top bar to enter edit mode. Click the piece you want, click where it goes.
Furniture and purchased equipment, **desks (two tiles wide plus the two seats below)**,
the inbox, and wall-hung art and whiteboards all move. Doors and walls don't.

Hovering tells you in advance: **green means it fits, red means it doesn't.**
There are exactly two reasons for red:

- **It would cut a path** — every floor tile must stay reachable from the door,
  or a cat ends up walled into a corner
- **It would strand a piece** — box the coffee machine in and nobody can use it

These are the generator's own rules, unchanged. Exempting the human hand would only let
you shoot yourself in the foot; the check exists because cats really did get trapped once.

The implementation detail worth noting: every edit runs **copy the grid → apply the move →
validate the whole thing → snapshot → rebuild via `worldFromGrid`**. Facility lists, desk
seats and the inbox position are all **re-derived from the grid**, which structurally
eliminates the "furniture moved but the facility list still points at the old tile" class
of bug. Floor clutter a piece lands on is quietly cleared away.

### 5. Suspicion, Legal and the Cat Police

| Situation | Consequence |
|---|---|
| Unfinished items carried over from last quarter | They leak · +1 suspicion each (2 for large) · cleanup costs billed |
| Accumulated suspicion | −6% output per point — everyone keeps their head down |
| A quarter that left no trace | One suspicion point expires |
| Paying a law firm | Buy off one point, at 22% of holdings — it scales with the company |
| More than 5 suspicion | 🚨 Warrant issued, raid (output drops to 40% during the investigation) |
| Raid ends | 15% fine · suspicion reset to 0 · 35% chance one employee is taken in |
| Detained employee | Returns cleared of charges at the next quarter close. Says nothing. |

There's a one-quarter grace period. Something you added today will never be due today.

It is always the same two officers, Do and Kim. A different pair each raid would read as
random NPCs rather than an institution.

The suspicion meter is the real tension: you can grind clean quarters, or you can just pay.
Paying is faster and it is also, unmistakably, a bribe.

### 6. The rival

A dog outfit selling drug-laced chews, and it is a system rather than flavour text.

Every quarter your document count is compared to a par that scales with office size
(3 at the first office, 15 at the last). Fall short and they take clients — their market
share rises and **every employee's output drops by that share**, capped at 60%. Push past
par and you win clients back, though more slowly than you lose them.

Neglect the company for three quarters and output falls to 54%. Once their share passes
25% one of their runners starts turning up at your door, loitering, and leaving. The
quarterly report carries a line about them that escalates with their share, from *"still
outside our territory"* to *"half our clients are taking chews on the side; they will drop
us soon"*.

This is the piece the game was missing. Before it, doing nothing simply meant earning
nothing. Now it costs you.

### 7. Real-time companionship — the clock is not compressed

A day used to last 32 minutes. Now the game clock **is the desktop clock**.
Quarters advance on KPI rather than time, so the economy is untouched — what changes
is that "a day in the game" becomes "your day".

- **Work 9–18, lunch 12–13** — at noon the cats physically head for the break room.
  The implication is that you should go eat too.
- **Countdowns in the clock chip** — time to lunch in the morning, time to clock-out in
  the afternoon, over a thin gauge showing how much of today you've already gotten through
- **Care announcements** — a morning hello (8:50), lunch (12:00), afternoon tea (15:00),
  clock-out (18:00, with today's approval count), and at 10 PM it tells you to go to bed.
  Work-schedule nudges fire on weekdays only.
- **A stretch every 50 minutes** — shoulder rolls / 4-4-8 breathing / look-into-the-distance
  / get some water, in rotation. The timer doesn't run during lunch.
- **Desktop notifications (opt-in)** — while you work in another window (tab in the
  background), care announcements arrive as browser notifications. rAF freezes in background
  tabs, so the care system runs on its own 1-second timer.
- **Background music** — `aquarium.wav`, a render from the sister project
  [Major Aquarium](../major-aquarium/) (a generative ambient of C-major pentatonic kalimba
  and bubble sounds, 2-minute loop). If the file is missing, the game falls back to a
  **runtime-synthesised music-box lo-fi** built on the same principle as the sound effects —
  72 BPM, a white-key progression (Cmaj7→Am7→Fmaj7→G6) under a probabilistic arpeggio, so
  no four bars ever repeat exactly. Either way it plays at half volume at night and keeps
  going when the tab is hidden.
- **A brief for when you get back** — coming back gets you two or three sentences instead of
  a single number: who earned the most (literally the ratio the offline total was divided by),
  who is the most worn out, what is still sitting in the inbox. Everything is read off current
  state and **nothing that didn't happen is ever claimed** — nobody visited while you were
  gone, so the report says "unchanged" and stops there. Leftover items are counted, never
  explained. The last line is always *"Take your time getting started."* The document only
  opens after a long absence; flipping back to the tab gets one quiet line.

> **Leaving the tab open used to be the worst way to play.** rAF freezes in a hidden tab, so
> the cats stop working — but the 8-second autosave kept stamping "last time the simulation
> ran", which zeroed out the offline payout. Close the tab entirely and you got 8 hours of
> earnings; leave it open beside your work, as the game asks you to, and you got nothing.
> The timestamp is now left alone while the tab is hidden.

Language is selectable in ⚙️ settings: **한국어 / English / 日本語**. Since the project has
no build step, there is no dictionary file — every string carries its three languages
in place via `L({ko,en,ja})`, which makes key mismatches structurally impossible. Cat names
come from per-language pools (치즈/Cheese/チーズ), and in the Japanese version the product
is マタタビ (silver vine), the culturally correct cat narcotic.

### 8. The time card — the only instrument this game is allowed

A companion game lives or dies on whether anyone keeps it open, and this one is offline
by design: no server, no account, nothing phoning home. There is no way to know.

Adding telemetry would answer the question and break the thing it was measuring. A game
whose whole premise is *sitting beside you* cannot also be *watching you*.

So it goes the other way. 🪪 draws a **1200×630 card** — days clocked in together, hours
spent, hours endured inside actual working time, documents stamped, and the one cat that
carried the most of it, by name and with its record. Save it or copy it to the clipboard.
When someone posts one, the number on it *is* the retention data, and what gets shared is
the player's decision rather than something taken from them. The card is also the only
honest advertisement this game has, since it can only ever say something true.

The counters live in `S.together` and are measured in wall-clock deltas, not tick counts —
Chrome throttles a background tab's one-second timer down to once a minute, and counting
ticks would erase exactly the people who leave it running in another tab. Gaps over five
minutes are dropped, so a laptop left shut overnight does not become companionship.

At clock-out on days 3, 5, 10, 20, 30, 50, 100, 200 and 365 a cat mentions the card once.
Every day would not be an offer, it would be nagging.

Drawing it hits the same `file://` canvas-tainting wall as everything else here: the cat
sheet is a cross-origin image, so `toDataURL()` throws. The card probes for that, uses the
real sprite where it can and an emoji where it cannot, and says plainly in the dialog that
saving needs the packaged build. Both single-file and web builds serve same-origin, so
both export fine.

### 9. Pixel art — three sources

**Cats come from [16-bit Kitties](https://mxmaze.itch.io/16-bit-kitties-pack)** by
Maze.Bit.Boutique — 16×16, nine frames per colour, licensed **CC BY 4.0**. The sheet rows
map onto the simulation states almost exactly: standing for idle and walking, sitting for
working at a desk, lying down for sleeping. Cats visibly sit when they reach their desk.

Four colours cannot tell twenty employees apart, and recolouring through a canvas is
impossible here — under `file://`, drawing an external image onto a canvas taints it and
blocks `toDataURL()`. So variation is **CSS `hue-rotate`** per cat, which needs no canvas
at all. Four sheets × eight rotations gives 24 readable appearances; rotations stay small
so nobody turns green, and black is weighted down from 25% to 11% because it dominates
on screen.

This replaced hand-drawn cats built from ASCII maps. That version composited accessories
and equipment as palette overlays, which a fixed sheet can't do — **equipment now affects
stats only, not appearance.** A real loss, traded for cats that look like cats.

**Furniture, floors and walls come from
[LimeZu's Modern Office - Revamped](https://limezu.itch.io/modernoffice)** (16×16, paid),
sliced out of the sheet with CSS `background-position` for the same tainting reason.
The pack is built for multi-tile furniture, which fights a one-tile-per-object grid, so
pieces carry `tall` and `wide`: they render into the tile above or beside while the
generator reserves the neighbour and pathfinding still sees a single occupied tile.
Furniture is depth-sorted on the same axis as the cats, so a cat behind a desk is
occluded by it and a cat at the seat in front is not.

Desks get a second layer — a monitor, paperwork or a lamp, chosen from the tile position
so a given desk always looks the same. A warm multiply pass covers the whole office,
because the tileset floors are cool grey and read as a different game from the cream UI
around them.

**The dog is drawn in code**, since the purchased pack has no dogs, on the same 16×16
grid as everything else. So are a handful of objects the pack has no match for.

**The camera doesn't show the whole grid.** The simulation uses a grid closed in by walls
on all four sides, but rendering all of it feels like peering into a box. So the view crops:

- **The side walls (x=0, W−1) aren't drawn** — the left and right open up and the office
  reads as wider than it is
- **The bottom wall row (y=H−1) isn't drawn either** — which takes the entrance door off
  screen. The door is still alive as the NPC entry and exit point; it's just not visible
- **Instead an extra wall row is added on top, making the back wall two tiles tall.**
  One row alone looks paper-thin and doesn't read as a room

World coordinates (x,y) map to screen tile (x−1, y+1). Rendering, cats, documents, effects
and decorate-mode hit testing **all pass through the same single transform (`vpx`/`vpy`)**,
so changing the camera can't leave one layer misaligned. Anything pushed off-screen
(an NPC at the door, say) is clipped by `overflow:hidden`.

Every tile coordinate is **measured, not eyeballed** — see `tools/sprite-audit.js` below.
Sound effects are WebAudio-synthesised. The only audio file is the background music
(`assets/music/aquarium.wav`, a self-made render), and even that falls back to runtime
synthesis when absent.

### 10. Everything else

- A real-time day: 09–18 work (12–13 lunch), 18–22 overtime (night owls only), sleep after 22 — all on your clock
- Offline earnings up to 8 hours (16 with the auto-feeder)
- 9 traits (night owl, napper, lucky, caffeine addict…), 8 ranks, 10 equipment purchases,
  9 wearable items, 20 quarterly events
- Quarter targets follow a gentle curve (6 → 45 → 196) while per-document output grows with
  office tier, so documents-per-quarter stays roughly flat instead of exploding
- Auto-saves to localStorage, layout included

---

## Project layout

```
copycat/
├── index.html          # markup
├── style.css           # pixel-flavored UI
├── assets/
│   ├── cats_16bit/                 # CC BY cat sheets — ships with the repo
│   ├── music/aquarium.wav          # BGM — self-made render from the Major Aquarium project
│   ├── atlas.png                   # the furniture sheet the game actually reads — generated, gitignored
│   └── modern_office/              # paid tileset, the atlas's raw material — gitignored, see install
├── tools/
│   ├── png.js · gif.js · wav.js    # PNG codec, animated-GIF encoder, audio downmix — no dependencies
│   ├── sprite-audit.js             # verifies every tile coordinate against the sheet
│   ├── build-atlas.js              # extracts only the tiles used → atlas.png · js/atlas.js
│   ├── pack-release.js             # the itch.io zip — with the checks that keep the paid pack out
│   ├── pack-single.js              # the whole game inlined into one .html you can send someone
│   └── capture-store.js            # drives the real game to shoot store screenshots + cover GIF
└── js/
    ├── assets.js       # asset-path indirection — the single-file build's only hook into the game
    ├── atlas.js        # atlas coordinate table — generated, gitignored
    ├── i18n.js         # language (한국어/English/日本語) · the L({ko,en,ja}) helper
    ├── world.js        # floor plans · furniture placement · BFS pathfinding
    ├── cats.js         # cat data · 4d6 stats · traits · equipment
    ├── sprite.js       # tilesheet slicing · code-drawn sprites · tile tables
    ├── sim.js          # 20Hz simulation · real-time clock · agent state machine · event bus · NPCs
    ├── game.js         # economy · inbox · quarters · suspicion · rival · saving
    ├── ui.js           # rendering · modals · settings
    ├── edit.js         # decorate mode — moving furniture · connectivity validation
    ├── card.js         # the time card — days together, drawn to a shareable 1200x630 PNG
    ├── care.js         # real-time care — lunch · stretches · clock-out · desktop notifications
    ├── music.js        # WebAudio-generated BGM (music-box lo-fi, no files)
    └── main.js         # boot · loop · input
```

## Installing the art assets

The furniture and floor tileset is **[Modern Office - Revamped](https://limezu.itch.io/modernoffice)
by LimeZu**, a paid asset. Its license allows commercial use but forbids redistributing the
asset itself, so it is **gitignored and never enters this repository**. A fresh clone will
run but the office will be blank.

To install: buy the pack, copy these files into `assets/modern_office/`, then **build the atlas once**:

```
assets/modern_office/
├── Modern_Office_Shadowless_16x16.png    # from 3_Modern_Office_Shadowless/
├── Room_Builder_Office_16x16.png         # from 1_Room_Builder_Office/
└── LICENSE.txt                           # from the pack root
```

```
node tools/build-atlas.js
```

The cat sheets are CC BY and already in the repo. Sound and the code-drawn objects need
nothing installed.

## The game never reads the pack directly — the atlas

That license splits on two lines:

```
YOU CAN:   Edit and use the asset in any commercial or non commercial project
YOU CAN'T: Resell or distribute the asset to others
```

**Using it is fine; handing it out is not.** For a compiled game the distinction never comes
up — the asset is buried in the package. Copycat has no build. Ship the original PNG and every
player downloads the whole 16×53-tile pack; that stops being *selling a game* and becomes
*handing out a tileset*.

So `tools/build-atlas.js` extracts **only the tiles the game actually references** and repacks
them into `assets/atlas.png` — 103 tiles, 256×128, 10KB. What comes out is not a pack; it's this
game's sprite sheet.

- The coordinates still live in exactly one place, `js/sprite.js`. The builder **executes
  sprite.js** to read the tables out rather than keeping its own copy, because a second copy
  eventually disagrees with the first.
- Original → atlas translation happens in **one function, `pick()`**. Every slicing path goes
  through it.
- The builder reads its own output back and **compares it to the source pixel by pixel.**
  Misread the anchor convention (bottom-left origin, `tall` grows upward) in one place and the
  furniture shifts half a tile — which is very hard to see and very easy to ship.
- Change a coordinate without rebuilding and that one tile silently disappears. So a missing
  entry logs a console warning, and packaging **always rebuilds the atlas first.**

`assets/atlas.png` and `js/atlas.js` are derived from paid pixels, so **neither goes in the
repo.** Inside the game they are an asset used in a project; sitting in a repository on their
own they are closer to an asset being distributed.

## Running it

Double-click `index.html`. That's it — it works over `file://`.

## Making a release build

```
node tools/pack-release.js [--light-audio]
```

Produces `dist/copycat-web.zip`. itch.io runs a zip with `index.html` at its root directly in
the browser, so for a game with no build step, **zipping is the build.**

What the tool mostly does is exclude rather than compress. Files are listed by whitelist, then
swept once more against a banlist (`modern_office`, `Room_Builder`, `site/`, `tools/`, payment
secrets). It also checks that every script `index.html` asks for actually made it in — a missing
one is a white screen, and you find out after uploading.

`--light-audio` downmixes the BGM to mono 22.05kHz (**18.4MB → 4.6MB**), low-passing before
decimation so nothing aliases back as a metallic edge. The source file is untouched. That size
difference matters a lot to someone opening the page for the first time; drop the flag if you'd
rather keep the fidelity.

## One file you can send someone

```
node tools/pack-single.js [--with-music]
```

Produces `dist/copycat.html` — **270KB, the entire game in a single file.** Markup, CSS, all
twelve scripts, the atlas and the cat sheets are inlined; there is nothing beside it to load.
Double-click and it runs, offline, with no unzipping and no install.

This exists because a zip is three steps — download, extract, find `index.html`, double-click —
and three steps is where people stop. One file is one step, and it fits in a chat message.

The game is not aware of any of this. `js/assets.js` holds an empty table and a one-line
resolver; in the normal build every path resolves to itself, and in the single-file build the
bundler fills that table with data URIs. The alternative — regex-replacing paths in the source —
breaks the moment a path is assembled at runtime, and the cat sheet's is (`dir + colour + .png`).
So there is exactly one hook, and it is in the game rather than in the bundler.

`--with-music` adds the BGM as well and writes `dist/copycat-music.html` (**7MB** — base64 costs
a third on top, so the track is downmixed first). Without it the file carries no music track at
all and `js/music.js` falls back to the runtime-synthesised music box, which is what that
fallback was written for.

## Store assets

```
node tools/capture-store.js
```

Writes five screenshots and an animated cover to `dist/store/`. It drives the **actual game**
over CDP rather than assembling mockups — clears the save, adds real to-dos, ticks them off,
and waits out the real clock until the record has something in it, because a fresh employee
file reads "Not on file" on every line and sells nothing. Everything on screen is a number the
simulation produced.

The cover is a **630×500 GIF of a cat carrying a document**, because that is this game's one
sentence and it should not need a caption. `tools/gif.js` is a from-scratch GIF89a encoder —
no dependency gets added for one image. Each frame stores only the rectangle that changed, and
inside it only the pixels that changed, which is why 40 frames of a 630×500 office come to
87KB. The tool loads its own output back into the browser afterwards and fails if the decode
doesn't come back at the right size: an encoder you wrote yourself isn't verified by looking
at the file size.

## Testing

Three layers, because each one missed something the next one caught.

A **headless harness** loads the core files with no DOM and runs the simulation directly:
the approval pipeline, 10 minutes of runtime stability, legal referrals, the bribe,
raids/detention/return, the rival's share swings, office relocation, save/restore, and
reachability across all 210 floor plans.

That is not enough on its own — it passed everything while half the cats were invisible on
screen. So the game is also **driven in a real headless Chrome over CDP**: boot it, dismiss
the modal, add a task, check it off, watch a cat carry the document, trigger a raid, open
the employee file, and screenshot each step.

Neither catches a sprite that is simply the wrong shape, so **`tools/sprite-audit.js`**
decodes the tilesheet's alpha channel, flood-fills from every tile the game references, and
reports the true bounding box. That turned "some furniture looks cut off" into an exact
list of 18 wrong anchors and extents. It reports zero now, and any new tile pick should be
run through it rather than guessed.

---

## What could be added next

- **More decorate mode** — rotating furniture, moving several pieces at once, undo,
  a shop of purely decorative items (rugs, posters, lamps), and exporting/importing a layout
- **Configurable work schedule** — 09–18 with a 12–13 lunch is hard-coded today. Shift work,
  staggered hours and four-day weeks belong in settings.
- **Personalised care** — custom stretch intervals and phrasing, a Pomodoro mode (25/5),
  and a "rough day" button that raises care frequency and lowers intensity.
- **A weekly report** — hours endured and items handled, folded into Friday's clock-out message.
- **BGM moods** — arrangements by weather and hour (Rhodes piano on rainy days, slower at night).
- **Relationships between cats** — intimacy accrues from bumping into each other at social
  facilities; sitting next to a friend boosts output, sitting next to a rival hurts it. Office politics.
- **Actual LLM agents** — cats currently run on utility AI. Wire an LLM in and let them write
  their own office gossip for the company newsletter. Closer to the original intent of agent–human parity.
- **A rival office to look at** — the dogs exist as a number and a visitor. Letting the player
  see their floor, run by the same simulation, would make the competition concrete.
- **Product lines and purity** — grades already appear in the flavour text. Making them a real
  mechanic (yield vs. suspicion) would give the business decisions of its own.
- **A labor union** — sustained low morale triggers a strike. Negotiation minigame.
- **Real calendar / issue tracker integration** — pipe GitHub Issues or Todoist into the inbox
  so real work becomes the input.
- **Exportable quarterly reports** — save the report as a shareable card image
- **Audit mode** — Legal traces the handling history of a specific document.
  Which cat stamped it, and when.
- **Multiplayer** — WebSocket like OpenMMO, several people's offices in one building

---

## Credits & references

**Assets**
- Cats: **[16-bit Kitties](https://mxmaze.itch.io/16-bit-kitties-pack) by Maze.Bit.Boutique**
  — licensed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. Attribution is
  required by that license and is given here. Redistribution is permitted, so the sheets
  ship in `assets/cats_16bit/`.
- Furniture, floors and walls: **[Modern Office - Revamped](https://limezu.itch.io/modernoffice)
  by [LimeZu](https://limezu.itch.io/)** — a paid asset. Commercial use is permitted;
  redistributing the asset is not, so it is kept out of both the repo and the release build.
  What ships is an atlas of the 103 tiles this game draws — see the install and atlas sections.

**Ideas**
- [OpenMMO](https://github.com/Julian-adv/OpenMMO) — agent–human parity, procedural generation, 4d6-drop-lowest
- [GitAnimals](https://github.com/gitanimals) — the pixel style the hand-drawn cats aimed at,
  before they were replaced. No GitAnimals asset is used.

Only ideas were borrowed from those two projects, never code. No fonts, no libraries,
no build step. Sound effects are synthesised at runtime; the background music is a
self-made render from the sister project [Major Aquarium](../major-aquarium/) (with a
synthesised fallback). Two art packs are used: the cats ship with the repo under CC BY,
the office tileset does not.

## License

All rights reserved. This is **not** open source — a paid release is planned (itch.io first,
Steam later), so no reuse or redistribution without permission. Please ask first.
