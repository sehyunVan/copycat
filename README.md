# Copycat

> Copycat is a **narcotics operation staffed entirely by cats.**
> Finish your to-dos and the business grows. Leave paperwork lying around
> and the Cat Police come for you.

A to-do list × idle management sim × multi-agent sandbox.
Open `index.html` in a browser and it runs. No build step, no server, no dependencies
(the office tileset is a purchased asset — see the install section).

🇰🇷 [한국어 README](README.ko.md)

---

## The question this explores

**What happens if "completing a task" is an input to a simulation rather than a score?**

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

### 4. Suspicion, Legal and the Cat Police

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

### 5. The rival

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

### 6. Pixel art — three sources

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

Every tile coordinate is **measured, not eyeballed** — see `tools/sprite-audit.js` below.
Sound effects are WebAudio-synthesised; no audio files.

### 7. Everything else

- Day/night cycle (32 real minutes per day): 09–18 work, 18–22 overtime (night owls only), sleep after 22
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
│   └── modern_office/              # paid tileset — gitignored, see install section
├── tools/
│   └── sprite-audit.js             # verifies every tile coordinate against the sheet
└── js/
    ├── world.js        # floor plans · furniture placement · BFS pathfinding
    ├── cats.js         # cat data · 4d6 stats · traits · equipment
    ├── sprite.js       # tilesheet slicing · code-drawn sprites · tile tables
    ├── sim.js          # 20Hz simulation · agent state machine · event bus · NPCs
    ├── game.js         # economy · inbox · quarters · suspicion · rival · saving
    ├── ui.js           # rendering · modals
    └── main.js         # boot · loop · input
```

## Installing the art assets

The furniture and floor tileset is **[Modern Office - Revamped](https://limezu.itch.io/modernoffice)
by LimeZu**, a paid asset. Its license allows commercial use but forbids redistributing the
asset itself, so it is **gitignored and never enters this repository**. A fresh clone will
run but the office will be blank.

To install: buy the pack, then copy these files into `assets/modern_office/`:

```
assets/modern_office/
├── Modern_Office_Shadowless_16x16.png    # from 3_Modern_Office_Shadowless/
├── Room_Builder_Office_16x16.png         # from 1_Room_Builder_Office/
└── LICENSE.txt                           # from the pack root
```

The cat sheets are CC BY and already in the repo. Sound and the code-drawn objects need
nothing installed.

## Running it

Double-click `index.html`. That's it — it works over `file://`.

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
  redistributing the asset is not, so it is gitignored here. See the install section.

**Ideas**
- [OpenMMO](https://github.com/Julian-adv/OpenMMO) — agent–human parity, procedural generation, 4d6-drop-lowest
- [GitAnimals](https://github.com/gitanimals) — the pixel style the hand-drawn cats aimed at,
  before they were replaced. No GitAnimals asset is used.

Only ideas were borrowed from those two projects, never code. No fonts, no libraries,
no build step. Sound is synthesised at runtime. Two art packs are used: the cats ship with
the repo under CC BY, the office tileset does not.

## License

All rights reserved. This is **not** open source — a commercial release (Steam) is being
considered, so no reuse or redistribution without permission. Please ask first.
