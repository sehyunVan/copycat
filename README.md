# Copycat

> Cats work office jobs. Finish your to-dos and the company grows.
> Don't, and Legal comes for you.

A to-do list × idle management sim × multi-agent sandbox.
Open `index.html` in a browser and it runs. No build step, no server, no external assets.

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
At quarter close, anything carried over unfinished from the previous quarter is referred
to the Legal team. Penalty points accumulate. Cross the threshold and the Cat Police
Special Investigation Unit raids your office. Sometimes they take an employee with them.

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
| Unfinished items carried over from last quarter | Referred to Legal · 1 penalty point each (2 for large) · legal fees billed |
| Accumulated penalties | −6% output for every employee per point |
| A clean quarter | One penalty point expires |
| More than 5 penalty points | 🚨 Police raid (output drops to 40% during the investigation) |
| Raid ends | 15% fine · penalties reset to 0 · 35% chance one employee is taken in |
| Detained employee | Returns cleared of charges at the next quarter close |

There's a one-quarter grace period. Something you added today will never be due today.

### 5. Pixel art

Chunky pixel style in the spirit of [GitAnimals](https://github.com/gitanimals).
**There is not a single image file.** Sprites are generated at runtime:
ASCII map → canvas → cached data URL.

```js
const CAT_IDLE = [
  '.....oo........oo.......',
  '....obbo......obbo......',
  '....oppo......oppo......',
  ...
];
```

Fur colors, accessories and equipment are composited as palette overlays, so adding
combinations never adds files. Furniture works the same way — 18 pieces from
4 base shapes × palettes. Sound effects are WebAudio-synthesized, also file-free.

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
└── js/
    ├── world.js        # procedural floor plans + BFS pathfinding
    ├── cats.js         # cat data · 4d6 stats · traits · equipment
    ├── sprite.js       # ASCII maps → canvas pixel sprites
    ├── sim.js          # 20Hz simulation · agent state machine · event bus · NPCs
    ├── game.js         # economy · inbox · quarters · legal/police · saving
    ├── ui.js           # rendering · modals
    └── main.js         # boot · loop · input
```

## Running it

Double-click `index.html`. That's it — it works over `file://`.

## Testing

A headless harness loads the four core files with no DOM and runs the simulation directly,
covering: the approval pipeline, 10 minutes of runtime stability, legal referrals,
raids/detention/return, office relocation, save/restore, and reachability across all
210 floor plans. Sprites were verified by rendering them to PNG with a hand-rolled
zero-dependency encoder and looking at them.

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

- [OpenMMO](https://github.com/Julian-adv/OpenMMO) — agent–human parity, procedural generation, 4d6-drop-lowest
- [GitAnimals](https://github.com/gitanimals) — pixel style reference (no assets used; everything is code-generated)

Only ideas were borrowed, not code. Zero asset, font, or library dependencies —
every pixel and every sound is generated inside this repository.

## License

All rights reserved. This is **not** open source — a commercial release (Steam) is being
considered, so no reuse or redistribution without permission. Please ask first.
