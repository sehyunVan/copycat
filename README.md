# Copycat

> Copycat is a **narcotics operation staffed entirely by cats.**
> Finish your to-dos and the business grows. Leave paperwork lying around
> and the Cat Police come for you.

A to-do list × idle management sim × multi-agent sandbox.
Open `index.html` in a browser and it runs. No build step, no server, no dependencies
(the tileset is a purchased asset — see the install section).

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
and is registered as a herbal wholesaler.
So paperwork left unfinished at quarter close doesn't just sit there: it leaks, and it
becomes evidence. **Suspicion** accumulates. Cross the threshold and a warrant is issued
and the Cat Police Special Investigation Unit raids the office. Sometimes they take an
employee with them.

You can pay to make suspicion go away, which is exactly the kind of company this is.

It isn't just achievement that's rewarded — **failure comes back through the bureaucracy.**
The joke is how quietly realistic that turns out to be.

---

## What's in it

### 1. Cats as autonomous agents

Borrowed from [OpenMMO](https://github.com/Julian-adv/OpenMMO)'s **agent–human parity**
principle ("agents and human players speak the exact same protocol — no privileged API"),
scaled down to one office.

- Cats have **energy / fun / bladder / caffeine** needs and seek out facilities on their own
- Your approvals, a cat's nap, and a Legal visit all travel through the same event bus (`bus`)
- Cats only earn while **actually seated at their desk** — when they go for coffee, revenue really drops
- Pathfinding is BFS. Legal and the police use the same `goTo()`. No NPC walks through walls.

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

### 3. Procedurally generated offices

When the quarter hits a milestone (3 · 6 · 10 · 15 · 21 · 28), the company relocates and
**a brand-new floor plan is generated.** It's seeded, so saving and reloading gives you
the same layout back.

- Desks are placed as two-seat team pods, distributed across multiple rows
- Purchased equipment is placed as real tiles, and cats actually use it
  (you need to buy the coffee machine before caffeine cravings exist at all)
- **Every placement must pass a connectivity check** — if placing something would cut the
  floor into disconnected pockets, it's rolled back.
  (Without this, cats get walled into corners. They did.)
- Verified exhaustively: 7 tiers × 30 seeds = 210 floor plans, zero unreachable desks

### 4. Legal & the Cat Police

| Situation | Consequence |
|---|---|
| Unfinished items carried over from last quarter | They leak · +1 suspicion each (2 for large) · cleanup costs billed |
| Accumulated suspicion | −6% output per point — everyone keeps their head down |
| A quarter that left no trace | One suspicion point expires |
| Paying a law firm | Buy off one point. Cost scales with how big the company is. |
| More than 5 suspicion | 🚨 Warrant issued, raid (output drops to 40% during the investigation) |
| Raid ends | 15% fine · suspicion reset to 0 · 35% chance one employee is taken in |
| Detained employee | Returns cleared of charges at the next quarter close. Says nothing. |

There's a one-quarter grace period. Something you added today will never be due today.

The suspicion meter is the real tension: you can grind clean quarters, or you can just pay.
Paying is faster and it is also, unmistakably, a bribe.

### 5. Pixel art — three sources

**Cats come from [16-bit Kitties](https://mxmaze.itch.io/16-bit-kitties-pack)** by
Maze.Bit.Boutique — 16×16, nine frames per colour, licensed **CC BY 4.0**. The sheet rows
map onto the simulation states almost exactly: standing for idle and walking, sitting for
working at a desk, lying down for sleeping.

Four colours is not enough to tell twenty employees apart, and recolouring through a
canvas is impossible here — under `file://`, drawing an external image onto a canvas
taints it. So variation comes from **CSS `hue-rotate`** applied per cat, which needs no
canvas at all. Four sheets × eight rotations gives 24 readable appearances; rotations stay
small so nobody turns green, and black is weighted down because it dominates on screen.

This replaced hand-drawn cats built from ASCII maps. That version composited accessories
and equipment as palette overlays, which a fixed sheet can't do — **equipment now affects
stats only, not appearance.** A real loss, traded for cats that look like cats.

**Furniture, floors and walls come from a tileset**:
[LimeZu's Modern Office - Revamped](https://limezu.itch.io/modernoffice) (16×16, paid),
sliced straight out of the sheet with CSS `background-position`. No canvas involved —
under `file://`, drawing an external image onto a canvas taints it and blocks
`toDataURL()`. A couple of objects the pack has no match for are still drawn in code, so
both paths coexist in one `FURN` table.

The pack is built for multi-tile furniture, which fights a strict one-tile-per-object
grid. Objects marked `tall: 2` render up into the tile above while still occupying only
the lower tile for pathfinding — desks, water coolers, vending machines and lockers all
need it.

Purely decorative tiles — framed pictures, shelves, potted plants — are scattered by the
generator too, scaling with office tier. Without them the early offices read as empty rooms.

Sizes are deliberate: furniture fills a full tile (16 logical px → 32 screen px), a cat is
smaller (14×13 → 28×26). Pixel density is identical everywhere, so nothing looks resampled.

Sound effects are WebAudio-synthesized — no audio files.

### 6. Everything else

- Day/night cycle (32 real minutes per day): 09–18 work, 18–22 overtime (night owls only), sleep after 22
- Offline earnings up to 8 hours (16 with the auto-feeder)
- 9 traits (night owl, napper, lucky, caffeine addict…), 8 ranks, 10 equipment purchases, 16 quarterly events
- Auto-saves to localStorage

---

## Project layout

```
copycat/
├── index.html          # markup
├── style.css           # pixel-flavored UI
├── assets/
│   └── modern_office/              # paid tileset — gitignored, see install section
└── js/
    ├── world.js        # procedural floor plans + BFS pathfinding
    ├── cats.js         # cat data · 4d6 stats · traits · equipment
    ├── sprite.js       # ASCII maps → canvas pixel sprites
    ├── sim.js          # 20Hz simulation · agent state machine · event bus · NPCs
    ├── game.js         # economy · inbox · quarters · legal/police · saving
    ├── ui.js           # rendering · modals
    └── main.js         # boot · loop · input
```

## Installing the art assets

The furniture and floor tileset is **[Modern Office - Revamped](https://limezu.itch.io/modernoffice)
by LimeZu**, a paid asset. Its license allows commercial use but forbids redistributing the
asset itself, so it is **gitignored and never enters this repository**. A fresh clone will
run but the office will be blank.

To install: buy the pack, then copy these two files into `assets/modern_office/`:

```
assets/modern_office/
├── Modern_Office_Shadowless_16x16.png    # from 3_Modern_Office_Shadowless/
├── Room_Builder_Office_16x16.png         # from 1_Room_Builder_Office/
└── LICENSE.txt                           # from the pack root
```

Cats, sound, and a few objects the pack has no match for are generated in code and need
nothing installed.

## Running it

Double-click `index.html`. That's it — it works over `file://`.

## Testing

Two layers. A **headless harness** loads the core files with no DOM and runs the
simulation directly, covering: the approval pipeline, 10 minutes of runtime stability,
legal referrals, raids/detention/return, office relocation, save/restore, and reachability
across all 210 floor plans.

That harness is not enough on its own — it passed everything while half the cats were
invisible on screen. So the game is also **driven in a real headless Chrome over CDP**:
boot it, dismiss the modal, add a task, check it off, watch a cat carry the document,
trigger a raid, and screenshot each step. Art is reviewed by rendering sprite sheets to
PNG (hand-rolled zero-dependency encoder) and looking at them.

---

## What could be added next

- **Relationships between cats** — intimacy accrues from bumping into each other at social
  facilities; sitting next to a friend boosts output, sitting next to a rival hurts it. Office politics.
- **Actual LLM agents** — cats currently run on utility AI. Wire an LLM in and let them write
  their own office gossip for the company newsletter. Closer to the original intent of agent–human parity.
- **A rival firm** — an AI-run company operating under the same rules. Compare revenue each quarter.
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
- [GitAnimals](https://github.com/gitanimals) — pixel style reference for the cats. No GitAnimals
  asset is used; the cat sprites are generated by this repository's own code.

Only ideas were borrowed from those two projects, never code. No fonts, no libraries,
no build step. Sound is still synthesised at runtime. Two art packs are used: the cats
ship with the repo under CC BY, the office tileset does not.

## License

All rights reserved. This is **not** open source — a commercial release (Steam) is being
considered, so no reuse or redistribution without permission. Please ask first.
