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
anyone. So a document you put a **⏰ deadline** on and failed to file that day doesn't just
sit there: it leaks, and it becomes evidence. **Suspicion** accumulates. Cross the threshold
and a warrant is issued and the Cat Police raid the office. Sometimes they take an employee
with them.

**The company does not set the deadline — you do.** Without one, nothing happens. A thing
built to sit beside you through the working day cannot hand out due dates nobody asked for;
that is nagging, not company. And a leaked item never leaves the list: **filing it late
clears the suspicion it created**, because the behaviour this game wants is "late is fine".

You can pay to make suspicion go away, which is exactly the kind of company this is.

And doing nothing is not neutral. A rival outfit takes your clients while you idle.

It isn't just achievement that's rewarded — **failure comes back through the bureaucracy.**
The joke is how quietly realistic that turns out to be.

---

## What's in it

### 0. The prologue — a real-time low-poly cutscene

The first launch starts with **how you ended up here**. A rainy back alley, a suspicious
flyer stapled to a utility pole, one phone call ("You're hired." / "Stay where you are.
We'll come to you."), a blackout — and then you open your eyes in an **empty office with
a single desk**. The monitor comes on with a handover letter from "Admin", and that letter
is the game's instruction manual.

**It is not a video file.** The alley and the first office are built with
`js/three/lowpoly.js` and rendered live. The reason is distribution: this game ships as
[one HTML file](#the-one-file-you-can-just-send), and a 60-second video base64'd into it
would push that file past 20MB. Rain, subtitles, dial tone, ringback, footsteps — all code
(WebAudio, zero audio files). Subtitles in ko/en/ja. `Esc` or "Skip" jumps straight to the
letter, clicking advances a scene, and ⚙️ Settings can replay it any time.
🗑️ Start over wipes the save and starts from this prologue again.

**When the cutscene ends you sign an employment contract.** You pick the first cat's name
and look right there, and that cat is employee #001 — **you**. Its title is fixed to
**Boss** from the start, so instead of promotions it gets "Raise own cut" — and every other
cat tops out one rank below, at Executive. There is only one boss. The game used to
start you with a cat named "Cheese"; a company whose only employee carries a name someone
else chose does not read as your company.

The prologue is **chapter one of a story that runs to an ending**. The clues it drops (one
tear-off tab already gone, a face-down nameplate, "do not open the drawer yet"), the twist
and the two endings are all laid out in [`STORY.md`](STORY.md).

### 1. Cats as autonomous agents

Borrowed from [OpenMMO](https://github.com/Julian-adv/OpenMMO)'s **agent–human parity**
principle ("agents and human players speak the exact same protocol — no privileged API"),
scaled down to one office.

- Cats have **energy / fun / bladder / caffeine** needs and seek out facilities on their own
- Your approvals, a cat's nap, a Legal visit and a police raid all travel through the same
  event bus (`bus`)
- Cats only earn while **actually seated at their desk** — when they go for coffee, revenue really drops
- Left to needs alone, cats spent **94% of the day at their desks** (measured with
  `spike/behavior.js`). That is not a cat, that is a diligent employee. So they now have a
  **focus span**: sit that long and they get up for no reason at all and go look at a toy, the
  water cooler, a nap spot. Its length comes from the trait (`decay`) and constitution.
  Desk time 94% → **73%**, movement ×4, furniture actually used 7 → **14 kinds**.
  The per-second rate went up by the same factor, so **daily income is unchanged** — if the
  player quietly pays for the extra freedom, it is not freedom, it is a nerf
- Cats do **not** always pick the nearest facility. Always taking the shortest path means a
  second cat tower never gets used and every cat walks the same line. A weighted draw favours
  what is close without giving it a monopoly (`pickUse`)
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
**a new floor plan is generated**, growing from 9×7 with 2 desks to 17×15 with 20.
Rooms are kept near-square because the viewport is landscape — a wide, short office fills
horizontally first and leaves black bands above and below.

Rooms are kept **deliberately small**. A big room pushes the camera back, and from back
there the cats are dots — no faces, no telling them apart. The first office is a cardboard
box with two desks, and each move grows it, gently. There is a floor to how small they can
get: desk rows sit every three tiles vertically, so the desk count a tier needs sets its
minimum size — which is what the exhaustive audit below is for.

- A **break room** is partitioned off in a corner, with its own walls, a doorway and a
  different floor material. Coffee, the feeder and the cooler go inside it.
- Desks are **two tiles wide**, seating two, arranged in pods across several rows —
  matching how the tileset author's own example offices are laid out.
- Furniture is **categorised**. Break-room items go to the break room, machines pick one
  wall and line up along it, meeting tables want open floor, plants and shelves fill in
  anywhere. Without this the office reads as a warehouse.
- Anything 2×2 or larger stays **against a wall**. A vending machine in the middle of a
  walkway doesn't look like an office.
- **Walls get filled.** Windows, framed art, a wall clock, wall shelves, a catwalk and a
  whiteboard are laid out run by run along the two outer walls (north and west). They live
  outside the grid, so pathfinding is unaffected and the walls can be packed freely. The
  frames **have pictures in them** — fish, cat, hills, a performance chart, a moon, a paw
  print, each built from boxes, with a different picture and backing colour per frame. A
  flat coloured panel isn't a painting, it's construction paper.
- What's outside the window follows the clock (amber morning → blue day → sunset →
  navy night). A window stuck at noon makes a night office read as daytime.
- **A piece occupies exactly the tile its 3D model stands on.** Many pieces in the pixel
  sheet are drawn two tiles wide; reserving by the drawing left a one-tile object on screen
  with a neighbouring tile blocked for no visible reason. Only genuinely two-tile pieces
  (desks, meeting tables, the legal desk) take two.
- **Every placement passes a connectivity check** — if it would cut the floor into
  disconnected pockets, or leave an existing object with no way to reach it, it's rolled
  back. Without this, cats get walled into corners. They did.
- Verified exhaustively: (empty office · fully equipped) × 7 tiers × 30 seeds = 420 floor
  plans, zero unreachable desks, zero missing facilities, zero bulky pieces stranded in the
  open. The audit **executes `world.js` as-is** — copy the rules into the
  checker and they will drift.

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

A selected piece **turns 90° at a time with `R` (Shift+R the other way) or the `↻` on the
hint bar.** Moving things around isn't enough to make it *your* office — everything the
generator laid down faces the same way, and that stays true after you rearrange it.
**Only one-tile pieces turn.** Rotating a two-tile piece would change its footprint from
2×1 to 1×2, and the grid has nowhere to write that: FILLER is always the tile to the right,
a desk's seat is always the tile below, and `worldFromGrid` re-derives the facilities from
exactly those conventions. One-tile pieces **keep their footprint**, so pathfinding doesn't
move a line. The angle lives beside the grid in `world.rot` (cell index → 0–3); the
simulation never reads it.

The implementation detail worth noting: every edit runs **copy the grid → apply the move →
validate the whole thing → snapshot → rebuild via `worldFromGrid`**. Facility lists, desk
seats and the inbox position are all **re-derived from the grid**, which structurally
eliminates the "furniture moved but the facility list still points at the old tile" class
of bug. Floor clutter a piece lands on is quietly cleared away.

### 5. Suspicion, Legal and the Cat Police

| Situation | Consequence |
|---|---|
| An item whose ⏰ deadline passed | Leaks the moment the workday rolls over · +1 each (2 for large) · **at most 3 a day** · cleanup costs |
| An item with no deadline | Nothing happens. Do it whenever |
| Filing a leaked item late | The suspicion that item created is cleared (it never left the list, so this is always possible) |
| Accumulated suspicion | −6% output per point — everyone keeps their head down |
| A day where no deadline was missed | One suspicion point expires |
| Paying a law firm | Buy off one point, at 22% of holdings — it scales with the company |
| More than 5 suspicion | 🚨 Warrant issued, raid (output drops to 40% during the investigation) |
| Raid ends | 15% fine · suspicion reset to 0 · 35% chance one employee is taken in |
| Detained employee | Returns cleared of charges at the next quarter close. Says nothing. |

**Quarter close no longer touches suspicion.** It used to be the place, but quarters here run
on KPI rather than time — work harder, close sooner, and your unfinished items leaked *faster*.
It was a clock that caught the diligent first. The clock is now a date a person picked.

The day turns not at midnight but on the **far side of your shift** (01:30 for a 9–18 shift,
14:00 for 22–06), so a task written at night doesn't land on somebody else's date. It is
derived from the shift setting, so no new setting appears.

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

- **The work hours are a setting** — 9–18 with lunch at 12 by default, changed in ⚙️, and **allowed to
  cross midnight** (22–06). Phases, pay rate, care broadcasts, the countdown and the offline settlement all
  derive from that one pair. Hard-coding 9–18 flatly contradicts this game's premise that it runs on *your*
  clock — **not everyone starts at nine**
- **Cats sleep on energy, not the hour** — being off-shift used to send every cat except night owls
  straight to bed. For anyone who writes their list at night that meant **a room of sleeping cats** and
  nothing happening when they checked something off. Documents are handled at 3 AM now; only tired cats lie down
- **Lunch** — at lunch time the cats physically head for the break room.
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
- **It only adds up while it's open** — the office runs for as long as the page is alive. A
  background tab counts, and is really simulated. Close the
  window and the office closes with it, and **nothing happens while it's closed**.
- **A brief for when you get back** — coming back gets you two or three sentences instead of
  a single number: who got a good rest behind the locked door, what is still sitting in the
  inbox. Everything is read off current state and **nothing that didn't happen is ever
  claimed** — nobody visited, so the report says "unchanged" and stops there. Leftover items
  are counted, never explained, and **the money you didn't make is never tallied up for you.**
  The last line is always *"Take your time getting started."*

> **Paying for time spent closed points the incentive backwards.** The old settlement assumed
> every cat sat at their desk the whole time and paid 55% with no time-of-day weighting. The
> live simulation counts only cats actually seated and multiplies by 0.35 at night — so
> **closing the tab overnight paid several times more than leaving it open overnight.** A game
> whose whole premise is keeping you company was teaching "switch me off and harvest later".
>
> So it splits three ways now. **Visible**: rAF drives it. **Background**: a 1-second watchdog
> drives it instead (rAF freezes in a hidden document, timers don't). **Closed: zero.** The
> boundary is a single timestamp — "when the simulation last ran" — and rAF and the watchdog
> must **both go through the same gate**: right after a machine wakes from sleep rAF runs
> first, and if it just stamps the timestamp, hours of closed time vanish with no settlement
> and no report.
>
> Zero, but never a punishment. The 🍚 **Auto Feeder** (26k) is the one exception — someone is
> feeding them, so a closed office ticks at 25% **during work hours only**. Overnight closure
> earning nothing isn't a penalty, it's a fact (the cats sleep from 22:00), and it means
> there's no incentive to leave it running all night either. The 8-hour cap applies to
> work-hour-equivalent time, not to a trailing 8-hour window — a window would zero out
> someone who closed at 15:00 and came back in the morning, and that absence plainly
> contained work hours.

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

### 9-a. 3D renderer (optional) — the same grid, drawn differently

**3D is the default.** Turn it off in Settings (⚙️) and it returns to pixel art; the
choice sticks. `?3d=0` / `?3d=1` in the address works too, as does `setRender3d(true/false)`.

**The office tone defaults to "Haze."** Low internal resolution (width divided by 2–3.4,
then scaled back up by integers), flat shading, ordered dithering, fog and desk lamps —
one set, held by `js/three/eerie.js` as a table (palette + time of day) plus a post pass.
Settings (⚙️) → [Office tone] → "Pastel" returns the original bright office
(`?style=pastel` in the address). **The prologue runs the same pass** — a cutscene that
looks like a different game reads as an advertisement.

The name `eerie` comes from where it started: a "Silent Hill × Animal Crossing" reference.
The first pass followed that reference all the way into darkness and produced an office you
were *alone* in — unusable for a game whose job is to sit through the workday with you.
So the texture stayed and only the values moved warm. Both passes and what they taught are
in [`spike/README.md`](spike/README.md), section "6축 — 분위기".

**There are many lamps, and they are on all day.** On 2026-08-28 the light sources went
from two kinds (ceiling, desk) to seven: floor lamps (torchiere and paper globe), string
lights, wall sconces (bowl and glass tube), lanterns, and candles. A cosy room is not a
*bright* room but a room with *many* lights — that is what the reference taught — so what
grew is not brightness but **the number of places light pools** (bright clusters in the
night frame went from 15 to 31). Placement is read off the grid: string lights on the
longest unbroken wall run, sconces on empty wall cells every three tiles, floor lamps in
**dead corners** where two or more neighbours are blocked. No randomness, so the same
office always has the lamps in the same spots.

They are also **decoupled from the time of day.** Lamp strength used to follow the
time-of-day table directly, which left them effectively off during daylight (the mid-day
row is 0.34) — and in a room you keep beside you, half a day with no lamps on is not
lighting. The new fixtures move only between 1.00 and 1.18 across the day and their colour
does not change at all: an incandescent bulb's filament is the same colour whether or not
the sun is up. Desk lamps got a floor value too.

**The colour is amber orange.** The bulbs (`0xFFA83A`), the tint in the shadows and the
mid-tones were all warmed together, so even in the morning the room reads as a place with
the lamps on rather than as faded beige. Night is the one exception: there, warm pools sit
in navy shadow, and that contrast is the whole point of the late-shift frame.

**The four door markers (💿📅📌📕) were left untouched.** Those are not lighting but a
signal that something is pressable (see "furniture that does something" below): thumbnail
sized, saturated orange, deliberately time-invariant. The new fixtures are broad and pale
amber, doing a different job on screen — mixing the two would kill the signal.

**Twenty-five kinds of furniture are for sale** (2026-09-01). Below the supplies list sits
a grid catalogue in five groups — work (drawers, file cabinet, meeting chair), storage
(lockers, cabinet, open shelving, book rack, paper tray, box, bin), decor (small/large
plants, floor lamp, candles, lantern, pen holder), lounge (1- and 2-seat sofas, low table,
lounge chair, bean bag, café table and chair) and wall (curtains, sticky notes).

Each cell shows the piece actually rendered in 3D, not an icon. All twenty-five share one
effect — **office comfort** — which grows with the number of pieces on a diminishing curve
and stops at +30% output and −15% needs drain. Since every piece is worth the same, which
furniture you buy stays purely a matter of taste. That is the point of the catalogue.

**The simulation does not change by a single line.** `world.js` procedural generation,
`sim.js` agents, BFS pathfinding and the save format are untouched. The renderer just
reads the same grid and draws it differently — the office on screen is the grid
`genOffice()` just produced.

Furniture is all code — `js/three/lowpoly.js` stacks boxes and polyhedra. It is the same
approach `sprite.js` used to draw the dog from an ASCII map, with one more axis, and it
means **no paid tileset and no atlas pipeline.**

**The cats are carved, not assembled.** `js/three/sculpt.js` writes about thirty capsules as a
signed distance field, melts them with a smooth union, and pulls a single shell out of a grid
with surface nets. Because the surface is one piece, the neck isn't missing — it's *melted*,
and the legs grow out of the body instead of being plugged into it.
`spike/m1-sculpt.html` is where that form was settled, on the same six-view turnaround sheet
as the reference figurine.

**The eyes and mouth are painted, not sculpted** (`js/three/facepaint.js`). No extra shapes,
no texture — the head is mapped back to a unit sphere and the marks are drawn in the shader.
So **no vertices are added and each cat is still one draw call**, and the expression is a
single uniform: `^ ^` while idle, open while working, closed while asleep — no re-carving.

Three poses (standing · sitting · loaf) and **every cat shares the bodies.** Twenty cats or a
hundred, boot carves three meshes and stops; only colour and expression differ per cat, and
those are uniforms. One knob that folds the legs (`legFold`) produces both the sit and the
loaf, so no separate models are needed.

**Gear finally shows on the cat.** The README used to say the three equipment slots "only affect
stats, never appearance — a clear loss," because a pixel sheet cannot cover 4 facings × 5 states ×
9 items by hand. The sculpt knows *where the head is, as a number* — `sculpt.js` emits the crown,
neck, paw and hip anchors for every pose, and `js/three/gear.js` hangs things on them. Company cap,
CEO crown, silk tie, golden bell, muffler, running shoes, wrist guards and the ergonomic cushion all
appear, and a sitting cat doesn't get shoes on the legs it folded away. **The police cat wears a
peaked cap and tie by default** — the side coming to arrest you should be legible at a glance.
The same two officers always show up (`POLICE` in `sim.js`): **Officer Doh in uniform navy, Officer
Kim in warm orange**. They used to be painted one colour, which made them interchangeable — the
point of a fixed pair is that you recognise them.
Each cat's gear is baked into **one draw call**.

Some things were cut in the making. **Horn-rim glasses hide the eyes** — this face has two dots for
eyes, so a frame doesn't read as glasses, it reads as missing eyes. **The shirt collar and the bell's
neck band went too**: the cat has no neck, so a band wraps the jaw instead. The tie is just a tie now,
and the bell is just a bell.

**The hand-drawn cats are still alive.** Settings (⚙️) → [Cat look] → "Drawn" returns to the
old way: a drawing from `assets/cats_drawn/` on a plane that faces the camera (or `?cat=doodle`).
It was kept, not deleted — the widget and PiP paths are still unverified, and leaving a way
back to the old look is cheap. Draw several cats on one sheet and
`node tools/split-doodles.js` cuts them apart and keys out the white — no image editing.

**A wall is not one flat panel.** Baseboards and a chair rail run along it, and an outlet or a
light switch is set into every third cell. What hangs on it isn't only framed art either —
cork boards, calendars, posters, vents, wall pipes, and the **herbal-wholesaler registration**
(the one piece of paper protecting this company is also the most formal object in the office).
It is still a single `DECOR` tile: the variation value `d.v` already stored in the save decides
*which* object hangs there, so the save format, the shop, and the edit UI all stayed the same size.

**The wall clock tells the real time.** The game runs on your desktop clock, yet the clock on the
wall was saying nothing about that. Its hands now follow the actual time — the hand groups are
simply excluded from the static merge, which costs two draw calls.

Two problems were new to 3D, and both were solved in the renderer, not the grid:

- **Wall seams** — one box per cell leaves visible lines where faces meet. Adjacent
  wall cells are merged into rectangles and raised as single slabs.
- **Partitions hid the room** — the generator divides the break room and meeting room
  with the same `TILE.WALL`. In 2D that read as a thin line; in 3D at full height it
  swallowed half the office. Outer walls are 2.3 tall, inner partitions 0.95 and thin.

**A cat sitting on furniture was put there by the renderer.** In the simulation cats cannot
enter a furniture cell (only floor and doors are walkable), so buying a cat tower or a hammock
left every cat standing on the floor beside it — furniture nobody used, as far as the buyer
could see. Changing the grid would shake up pathfinding, so the simulation is left alone and
the renderer **draws a cat at the furniture's height while it is in use**. Where it looks like
it is standing is the renderer's business.

Cat clicks and decorate mode are picked with a raycast. Every judgement in `edit.js` is
grid math and was left untouched — only "screen → cell" and the selection highlight changed.

**The pixel renderer is gone (2026-08-24), and the floating window uses the same stage.**
The one reason it had been kept was that nobody had measured whether a WebGL canvas
survives the move into a Document PiP window — and if it did not, widget mode would die,
and widget mode is why this game exists. It was measured, and it survives:
`spike/pipcv.html` adopts the canvas into another document and finds
`isContextLost() === false`, then reads back a colour drawn afterwards. One measurement
retired a whole renderer.

The 3D path is an ES module, and modules cannot be imported over `file://`. **Opening the
source tree directly** leaves `R3` absent, and instead of a blank stage the game says why
it could not draw (`ui.js` `stageFail`) — during development open it via
`node spike/serve.js`.

**Release builds do not have that problem.** Both packers fold the modules into the HTML and
load them from blob: URLs (`tools/inline-modules.js`). Concatenating is not an option: three.js
ships in two chunks and both have minified top-level names, so `e` and `t` collide — the modules
stay modules and only their specifiers are swapped. If blob: is blocked it falls back to data:.
The drawings ride in the `assets.js` table as data: URIs, not for size but for **canvas
tainting**: an image loaded over `file://` blocks `getImageData`, and that is the step where the
drawings get their brightness lifted. So unzip-and-double-click and the single file both run 3D.

The list of cat drawings is read from `assets/cats_drawn/list.js` as a **static import**.
It used to `fetch` an `index.json`, but when rendering is heavy the response handling gets
pushed back on the main thread (measured 5–12 s headless) and every cat created in the
meantime froze onto the first drawing. An import is done before the first frame. The list
file is written by `split-doodles.js`.

The reasoning behind the design lives in [`spike/README.md`](spike/README.md).

### 9. Pixel art — three sources

> The section below records the pixel renderer that was **deleted on 2026-08-24**.
> Neither the code nor the assets are in the repo any more. It stays because half of this
> game was learned here — the grid convention, `file://` canvas tainting, and
> "the tiles a piece *occupies* ≠ the tiles its art *covers*" all came from the dot years
> and are still alive in the 3D renderer.

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
Sound effects are WebAudio-synthesised. The audio files are the jukebox tracks
(`assets/music/*.wav`, self-made renders), and every one of them falls back to runtime
synthesis when absent.

#### Cat voices — a beep is not a cat

A meow isn't a tone, it's a **vowel movement**: from an open "mya" to a closed "ow", two
formants sliding down together. So a single sawtooth (the glottal source) is run through two
bandpass filters (the mouth), and both filter frequencies are swept down over the sound.
Pitch rises slightly then falls, and a 15–24 Hz wobble keeps it from sounding like a human
imitating a cat. Three of them:

| Sound | When | How |
|---|---|---|
| Meow | clicking a cat · playing or socialising | 4 recordings (fallback: sawtooth + two descending formants + vibrato) |
| Short call | stamping an approval · coffee, feeder, machines | 2 recordings, 0.3s (fallback: short rising tone shaken at 33 Hz) |
| Purr | petting a sleeping cat · settling into a nap box | brown noise → lowpass → 24 Hz amplitude modulation |

**The meow gave up on synthesis.** Even with the formants right it read as "a sawtooth that
went through a filter" — a real meow is the vocal folds and the vocal tract moving together,
moment to moment, and one oscillator can't trace that. So it uses real recordings — four meows and two
short calls (`assets/cat_voice/`, 172KB), **all CC0**. This game ships as a single file, so
share-alike samples are unusable here, and attribution-required ones were avoided too (they
are credited in `CREDITS.txt` regardless). Only sources recorded at **44.1kHz or better** were
kept — an 8kHz recording still sounds like a phone call after normalising. Bandwidth is not
something volume can replace. Which recording
a cat uses and how fast it plays (= its pitch) both come from its id, and if the files are
missing it falls back to the synth below. Playback is via `<audio>`: `fetch` +
`decodeAudioData` is blocked by CORS on `file://`, and double-clicking the file is this game's
default path (the background music uses `<audio>` for the same reason). When using
`playbackRate` you **must turn off `preservesPitch`** — otherwise only the speed changes and
twenty cats share one voice.

The purr, and the trill fallback, are still synthesised. And the synth taught one lesson:

At first you couldn't hear it. Narrow formants (Q 7 and 9) put the passbands **between** the
sawtooth's harmonics, so most of the sound was filtered away and what survived sat far below the
music (0.7). By ear that reads only as "no sound", so the game's own functions were rendered
through an `OfflineAudioContext` and measured: RMS 0.005, half of the stamp beep. Widening the
bands (Q 3.2 and 4.0) and mixing in a little low-passed source brought it to 0.075. **A sound you
can't hear is a sound that isn't there.**

Which call you get is **drawn fresh on every press**. Voices used to be fixed per cat (hashed
from the id), but then a given cat always sounds the same and the second click on it does
nothing. Pitch is nudged each time too. One rule though: **the clip just used is never drawn
twice in a row** — true randomness repeats often, and people read a repeat as a bug, not as
chance.

And they are **spaced out**. In an office where twenty cats each stamp documents and drink
water, sounding all of them isn't an office, it's an alarm. Ambient voices (work, furniture)
fire at most once every 1.5 s; only direct interaction (a click) skips that gate — if you
poke a cat, the cat answers.

### 10. Widget mode — a tenant in the corner of the screen

Something that keeps you company cannot also own the screen. So there are two layouts.

**Default — stage first.** The office owns the whole screen and the inbox and management panel
sit on top of it, faded to 52% until you put a pointer on them. It used to be three columns,
but then half the screen was boxes and the office was a window in the middle. Glancing only
works if the office owns the screen — six candidates were built and compared for real before
picking this one (`spike/ui/layouts.html`).

Three things needed care. Laying the top bar over the stage means its **transparent area
swallows clicks**, and the office underneath stops responding (only the buttons take clicks
now). The clock and camera button used to live in the stage's left corner, which is where the
panel now stands (they moved right of it). And no `backdrop-filter`: behind it is a canvas that
repaints every frame, so blurring it recomputes every frame — expensive for something left open
all day.

**🔳 Widget mode** — it folds into one column. What stays is the office; the inbox and the
management panel become drawers that rise from the dock. The six top-bar icons fold into a ⋯
popover, and the quarter gauge becomes the 3px underline of the top bar. **It holds up at
300×260.** Below 620×560 the layout folds by itself; pressing 🔳 pins your choice above the
window size and remembers it.

Drawers only rise to 72% of the screen. Cover everything and the widget is just a to-do list.
The strip that's left keeps showing the office, and tapping that strip closes the drawer. When
a drawer opens the camera keeps its zoom and slides up to the middle of the remaining strip —
rescaling to fit the strip turns the cats into dots, and leaving it alone shows nothing but
ceiling wall.

**🪟 Float out (the button is currently removed)** — only the toolbar button was taken out; the
code stayed. Restoring it takes one button in the markup, so switching it off is cheaper than
deleting it (the same rule `site/pay` is kept under). What that code does:

Document Picture-in-Picture puts the office above your other windows. It
does not open a copy: `#app` itself is moved into that window. There is exactly one save
(localStorage), so a second copy would mean two simulations overwriting each other's save —
moving the DOM makes "there is one game" a structural fact rather than a hope.

Once moved, both the render target (`DOC`) and the window that drives the loop (`HOST`) are
swapped. rAF stops in a hidden document, so a loop left on the original tab would freeze the
floating window the moment you switch tabs. While the floating window's rAF keeps running it
also keeps stamping "when the simulation last ran", so that stretch is never settled as closed
time — it simply *is* open time. It's also why image paths are
handed over as absolute URLs: the floating window is an `about:blank` document, so rebuilding
the office in there would resolve relative paths against it and the furniture would vanish.

The API is Chrome/Edge only, so the 🪟 button simply doesn't appear elsewhere.
Widget mode works everywhere.

### 11-a. The first-day walkthrough — built on the assumption that nobody reads

The controls used to be explained inside the company rules (❓), as text. **Nobody reads it.**
And this game has one rule that turns unfair when unread: **unfinished paperwork leaks, and
leaks bring the Pawlice.** Getting raided with no warning isn't difficulty, it's a trap;
knowing in advance turns it from pressure into a rule.

So a **five-panel walkthrough** now follows the employment contract
([`js/tutor.js`](js/tutor.js)). It doesn't ask you to read — it asks you to *do*:

1. File one thing you have to do — you have to **actually file it** to move on
2. Check it off — and watch the document physically drop into the inbox
3. Learn the camera while they walk over — the nine seconds aren't wasted (3D only)
4. It gets stamped and the anchovies land
5. And one panel of warning — leaks, suspicion, raids, hushing

Every step advances on a **real event** (`todo:add`, `todo:done`, `reward`). A walkthrough you
click "Next" through ends with nobody having done anything. It doesn't dim the screen either —
dimming would prevent the very thing it just asked for. Two pieces only: a ring around the
target and a panel beside it.

The wording matches the company rules and Admin's letter. If the game suddenly starts talking
in its own voice, everything the prologue built collapses on the spot.

The guide also **introduces the room.** Once the prologue ends people look only at the inbox, and
the calendar and board on the wall stay pictures forever — so after step 4 (the stamp) come the
**four things you can touch**: 💿 the CD player, 📅 the wall calendar, 📌 the branch board, 🛋️
decorate mode. Each step glides the camera in front of it over half a second, rings that spot, and
advances **only when you actually open it**.

What the close-ups taught: **never inherit the current camera angle.** Reuse whatever the player
left and the camera ends up outside the wall, showing the back of a partition — so the camera is
placed **toward the room's centre** from the target (`az = atan2(centreZ − cellZ, centreX − cellX)`),
which squares up wall-mounted things for free. And the card goes **below** the ring, not to the
right: to the right it covers the very thing just closed up on.

### 11-b. Click the furniture and look — the story leaks out of it

[`STORY.md`](STORY.md) set one design rule: *don't build new UI, lay the clues onto text that
already exists.* But there is one thing that rule cannot do — **finding**. A clue printed in a
quarterly report is *delivered*, and a delivered story gets read without ever being discovered.
In a game whose prologue ends on "**do not open the drawer yet**", having no act of opening the
drawer means half the story is missing.

So furniture can now be clicked outside decorate mode ([`js/story.js`](js/story.js)).
It isn't a new system — picking the tile reuses decorate mode's `unitAt` and `editTileFromEvent`.

- **A one-line observation on twenty-odd pieces.** Chosen by **grid coordinate**, not at random —
  if the same piece says something different on the second click, that's a gacha, not an
  observation. Two coffee machines in one office say two different things
- **Eight clues**, gated by quarter and available **once**. Repeat-clicking as a lottery would turn
  the office into a slot machine. From the Q1 desk drawer — **half a torn time card**, 412 days,
  the half with the name gone — to the pencil note behind the Q22 wall clock, "for whoever comes next"
- **Two tapes** — pick one up and the jukebox gains a track. They can't be bought, and before you
  find them you don't know they exist
- When a quarter unlocks one, Admin drops a note in the newsletter saying **roughly where** —
  pointing at it exactly would make it an errand, not a find. Only if that piece is actually in
  this office
- What you find is kept as a list on the 🪪 **time card**

**Nothing glitters.** A sparkle on the pieces that hold something would turn looking into
"click the shiny one", and then nobody clicks the other twenty — and those twenty are what makes
this office an office.

And the **first approval** carries all of it. When the first stamp lands, a window opens, Admin's
second letter says "you have now seen the entire business model" — and then **ends the "yet" in
"do not open the drawer yet."** It does not open the drawer for you. It only says you may, and
your hand does the rest. Which makes the first stamp not a congratulation but the moment you
**found something out.**

### 11-b2. The wall calendar — the day dates stopped being a picture

Every todo app has a calendar. This game had none, which meant tasks had **no date** — only
quarters, and a quarter is a KPI gauge with no relation to a human day. There was nowhere to
ask "what did I do yesterday?"

So tasks now live **on a date** (the same shape Todo Mate uses). Every item sits in some day's
column, and the inbox shows **today only**. What you wrote ahead comes up when that day
arrives; past days become the record of that day.

**Where to put that screen is the whole design question.** A 📅 button in the toolbar would
make the calendar a setting. But a calendar was already hanging on the office wall — one of the
`DECOR` variants, purely a **picture** ([`js/three/lowpoly.js`](js/three/lowpoly.js),
`calendar()`). Once deadlines existed, dates in this room could not be a picture, so **that
picture was promoted into a real calendar** (`TILE.CAL`). Nothing new was moved in; a handle was
added to what was already there, and the wall did not change by one pixel. Old saves get the
same treatment, and `ensureCal` ([`js/world.js`](js/world.js)) deliberately picks **the frame
that was already showing a calendar**.

What the calendar **doesn't** do is closer to the design: no streaks, no completion rates, no
colour that deepens. The moment you can open a past day, **the empty days become visible** —
attach a score to that and this stops being a thing that sits with you through the working day
and becomes a thing that counts the days you failed. A cell carries only that day's traces as
dots: filed (green) · waiting with a deadline (amber) · waiting (grey) · leaked (red), four max.

Rows older than four months **fold into per-day counts** (`S.days`). There is no reason to hold
the titles of last June's chores, but the fact that something happened that day has to survive,
or the cell would be lying.

With dates in place, two things came cheap on top.

**Routines** — a folded panel under the calendar where a daily chore is set with its weekdays, and
it is waiting in the inbox that morning. **The seven weekday chips are the data structure**
(`dows`); "daily" and "weekdays" only press those chips for you, so the screen and the save can
never disagree. Two things are deliberately not done: **missed days are never back-filled** (come
back after three days and fifteen lines would be debt, not work), and **routines can't carry a
deadline** (set once, it would leak every day, and this game would be pre-booking a penalty every
morning). If today's is urgent, put the ⏰ on that line by hand — that was decided by the you of
that day.

**Subtasks** — the ＋ on a row splits a big item into small lines (spring cleaning → laundry · mop ·
bathroom). It is one field, `t.parent`, and everything else is derived. **Stamps happen only on the
leaves** — the parent has no checkbox (that slot is the fold handle) and closes itself when the last
leaf lands, without emitting a document. Stamp the parent too and you'd be paid twice for one job
while a cat carries the paperwork twice. A group is one day's work, so moving the parent moves its
leaves, and deleting it deletes them (after asking — there is no undo).
**No grandchildren: two levels is a list, three is a document.**

### 11-b3. The branch board — looking in on someone else (a frame built without a server)

Todo Mate's friend feature, brought into this office, becomes "look in on someone else's
office." There is no server yet, so **what could be decided was decided first**: what gets
shared, where you click to open it, and what the screen refuses to show.

The place is the wall again. A cork board was already hanging there — a `DECOR` variant with
polaroids pinned to it — and it was promoted to `TILE.BOARD` (same method, same reason as the
calendar).

**`mine()` in [`js/friends.js`](js/friends.js) is the real design here.** Everything I show to
other people lives in one function, and what isn't there doesn't reach a server:

| Uploaded | Not uploaded |
|---|---|
| Name · branch name · tier · **office seed** | Anchovies · KPI · suspicion |
| Cat names and colours | Rival share · stats · personnel records |
| **Today's** inbox (text · done · ⏰ · leaked) | Past days · the whole calendar |

Sending the office **as a seed** is the point: feed that seed to the same generator
(`genOffice`) and their actual layout comes back, so an office can be shown **without sending a
single image**.

And you do walk into that room ([`js/visit.js`](js/visit.js)). The thing that looked dangerous
turned out to be safe: `R3.build(world)` swaps **only the renderer's geometry** and never touches
`W`, the grid the simulation pathfinds on. So your own office keeps running while you look around
— your cats keep working, the earnings keep coming. **Only the screen is elsewhere, and the save
doesn't change by one character.** The price is three gatekeepers: their cats are drawn instead of
yours (`syncActors`), their furniture doesn't open your drawers (`story.js`), and decorate mode
refuses to open (`edit.js` — rearranging your office while looking at someone else's is an
accident, not a feature).

The board's thumbnails come down the same path. They are **real renders, not drawings** — the room
is built, lit, shot once from above and kept as a webp (10KB at 260×168). Draw a picture separately
and it will eventually disagree with the actual office, and then the photo is lying. Where there is
no 3D (the single-file build over `file://`), the **floor plan** holds that place and "look around"
says why it can't.

What the screen **doesn't** do is half the feature: no completion rates, no streaks, no
rankings, no "2 of 3". Someone else's progress as a number is comparison, not company, and
comparison is the exact opposite of what this game sells. So the only value that moves in that
list is **whether their lights are on** — a lit branch has brighter paper and a red pin. Their
inbox is read-only, and a greeting is one 🐟 plus one line, once a day, **touching the economy
by exactly nothing** (make anchovies transferable and earnings leak into socialising; from then
on a friend is a resource).

The absence of a server is **printed on the screen** (a preview strip). Not dressing a stand-in
up as the real thing is part of the design — when `SOURCE` becomes `'server'`, that strip
disappears on its own.

### 11-c. The CD player — what are we playing today

This is a thing you leave running. Eight hours a day in the window next to your work, the same
two-minute loop stops being background around week three and becomes **noise**. But adding tracks
isn't enough on its own — without the **act of choosing**, more tracks is just randomness, and
randomness isn't music you put on.

And that act belongs **in the office, not in the toolbar.** It started as a 💿 button in the top
bar, which makes the music a setting. This game is one room; "what are we playing today" has to
happen inside that room. So the button came off and **a CD player went in as furniture.**
Click it to pick a track, move and rotate it in decorate mode, and — because its use is
`social` — **the cats gather in front of it**, the same way they gather at the water cooler.

**It is pinned by the door**, opposite the inbox: the spot where you put the paperwork down and
put the music on. More importantly, it must never fail to place. Left to the general packer it
was missing from 116 of 560 generated floor plans — a one-tile object keeps losing to 2×3
machines, and then there is no way to choose music at all. Placed *before* the packer instead, a
one-tile object split the contiguous run an 11×9 office needed for one of those machines, so a
purchasable item couldn't fit — a shape problem, not a tile-count one (removing a plant changed
nothing). The spot that avoids both is the doorway, which the packer never uses.
Verified across every grade: `node tools/world-audit.js`.

The **💿 CD player** in the office ([`js/juke.js`](js/juke.js); playback in [`js/music.js`](js/music.js)):

| Track | Where from |
|---|---|
| 🎼 Office Music Box | Default. The only one that needs no file (runtime synthesis) — also the insurance for offline and single-file builds |
| 🐠 Major Aquarium | Default |
| 🌙 Minor Garden · 🌧️ Rainy Window | Bought with anchovies in 💿 |
| 💾 Boot Sector · 🪈 Squeak Hill | **Found.** Only ever turn up in furniture, and aren't listed until they do |
| ▶️ YouTube | Paste a link and it becomes the playlist |

The files are renders from the sister projects in `playground/music/` — all generative, all
synthesised with Web Audio and no libraries, which makes them the same kind of object as this
game. They ship **downmixed to mono 22.05kHz** (68MB at full quality).

- **Crossfade** — two decks overlap and only one comes down. A hard cut steals attention from a
  window you parked beside your work
- **Three modes** — repeat one / shuffle / **by time of day** (bright in daylight, lower in the
  evening, rain at night)
- **The volume lives here too.** The 🔊 toggle came out of the toolbar and became one slider —
  a separate on/off and a separate level produce both "I muted it, why is there sound" (level only)
  and "I turned it on, why is it silent" (level at zero). **Zero is the master mute**, and it pulls
  the sound effects down with it
- **The half-volume night and the volume apply to YouTube too.** Otherwise it plays loud at 2am
- **YouTube failing is a normal path** — blocked on a work network, or the offline single-file
  build. Instead of going quietly silent it falls back to a built-in track and says so
- **Records do nothing for output.** They are the only spend here that doesn't, which is why they
  live in 💿 and not in the shop

### 11. Everything else

- A real-time day: work hours in ⚙️ (9–18 and lunch at 12 by default; the four hours after clock-out are the overtime window) — all on your clock
- Closed time earns nothing — the Auto Feeder (26k) buys 25% during work hours, up to 8 work-hour-equivalents
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
├── STORY.md            # story bible — prologue, clue schedule, twist, two endings
├── assets/
│   ├── cats_16bit/                 # CC BY cat sheets — ships with the repo
│   ├── music/*.wav                 # jukebox — self-made renders (mono 22.05kHz)
├── tools/
│   ├── png.js · gif.js · wav.js    # PNG codec, animated-GIF encoder, audio downmix — no dependencies
│   ├── sprite-audit.js             # verifies every tile coordinate against the sheet
│   ├── pack-release.js             # the itch.io zip — with the checks that keep the paid pack out
│   ├── serve-release.js            # unzips and serves it — verify the build as the build
│   ├── pack-single.js              # the whole game inlined into one .html you can send someone
│   └── capture-store.js            # drives the real game to shoot store screenshots + cover GIF
└── js/
    ├── assets.js       # asset-path indirection — the single-file build's only hook into the game
    ├── decor.js        # wallpaper/flooring catalogue + paint functions
    ├── binder.js       # the sample binder — where you pick wall and floor
    ├── i18n.js         # language (한국어/English/日本語) · the L({ko,en,ja}) helper
    ├── world.js        # floor plans · furniture placement · BFS pathfinding
    ├── cats.js         # cat data · 4d6 stats · traits · equipment
    ├── sim.js          # 20Hz simulation · real-time clock · agent state machine · event bus · NPCs
    ├── game.js         # economy · inbox · quarters · suspicion · rival · saving
    ├── ui.js           # rendering · modals · settings
    ├── edit.js         # decorate mode — moving and rotating furniture · connectivity validation
    ├── card.js         # the time card — days together, as a shareable 1200x630 PNG · found list
    ├── care.js         # real-time care — lunch · stretches · clock-out · desktop notifications
    ├── widget.js       # widget mode (one column · drawers) · float-out window (Document PiP)
    ├── music.js        # jukebox playback — track table · crossfade · YouTube · generative music box
    ├── juke.js         # 💿 the choosing screen — owned · records · YouTube link
    ├── cal.js          # 📅 the wall calendar — past days · days ahead · deadlines (⏰)
    ├── friends.js      # branch data layer — the shape of what is shared (mine) · mock for now
    ├── board.js        # 📌 the branch board — list · photo · greeting
    ├── visit.js        # walking into someone's office · thumbnails are real renders
    ├── story.js        # furniture inspection · eight clues · first approval (implements STORY.md)
    ├── tutor.js        # the five-panel first day — every step advances on a real event
    ├── main.js         # boot · loop · input · prologue entry
    └── three/
        ├── lowpoly.js  # the box-built low-poly kit (furniture · cats · rooms)
        ├── opening.js  # the prologue cutscene — sets, staging, subtitles, sound
        ├── sculpt.js     # SDF capsules → smooth union → surface nets → one shell
        ├── facepaint.js  # eyes and mouth painted in the shader (zero extra vertices)
        ├── catsculpt.js  # cat actor sharing three carved poses
        ├── gear.js       # equipment hung on the crown/neck/paw anchors (baked to 1 call)
        ├── doodle.js     # hand-drawn cat billboards (selectable in settings)
        └── cat3.js     # polygon cat rig (the drawings won instead)
```

## Installing the art assets

The furniture and floor tileset is **[Modern Office - Revamped](https://limezu.itch.io/modernoffice)
by LimeZu**, a paid asset. Its license allows commercial use but forbids redistributing the
asset itself, so it is **gitignored and never enters this repository**. A fresh clone will
run but the office will be blank.

**This install step is no longer needed** — since 2026-08-24 the game reads no paid tiles at all.
What follows is the record of how it used to work: buy the pack, copy these files into
`assets/modern_office/`, then build the atlas once:

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

## (historical) The game never read the pack directly — the atlas

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
secrets). Missing files are checked two ways. Every script and stylesheet `index.html` asks for must be
in the zip, and `type="module"` scripts are **followed through their imports** — three.js in two
chunks, `js/three/`, the cat drawing list, eight files in all. The point is not writing down by
hand which files are needed: a missing one is a white screen, and you find out after uploading.

Verify by **unzipping the build** and running that. Serving the source tree proves nothing —
files that never made it into the zip open anyway:

```
node tools/pack-release.js --light-audio
node tools/serve-release.js                   # like itch.io: the zip root is the site root
COPYCAT_BASE=http://localhost:8199 node spike/verify-game.js ""
```

Also worth knowing for itch.io: the game runs inside a cross-origin iframe there, so a browser
that blocks third-party storage throws on `localStorage` alone. Every access is wrapped —
progress is lost in that case, but nothing breaks.

`--light-audio` downmixes the BGM to mono 22.05kHz (**20.2MB → 5.0MB**), low-passing before
decimation so nothing aliases back as a metallic edge. The source file is untouched. That size
difference matters a lot to someone opening the page for the first time; drop the flag if you'd
rather keep the fidelity.

## One file you can send someone

```
node tools/pack-single.js [--with-music | --all-music]
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

> The near-term work list lives in [`TODO.md`](TODO.md). What follows is further out.

- **The rest of the story** — the clues still open in [`STORY.md`](STORY.md) (**the Q6 warrant
  number** is next; the raid-result modal is already there to carry it), the Q28 twist, and the
  two endings (post the flyer and leave / stand your nameplate up and stay). Ending A reuses the
  prologue's alley — from the other side of it. The Q1 drawer and the Q3 box are **already in,
  through furniture inspection**
- **Where the widget goes next** — living in the tray/menu bar (Electron, Tauri), a fallback for
  browsers without a floating window, a "just watch them" minimal mode with no drawers at all
- **More decorate mode** — moving several pieces at once, undo, **vertical two-tile pieces**
  (which means changing the save format and `worldFromGrid` together), rotated sprites for the
  pixel renderer, a shop of purely decorative items (rugs, posters, lamps), and
  exporting/importing a layout — one-tile **rotation already works** (R · ↻)
- **Where the schedule goes next** — start and end are settings now, midnight-crossing included. What is
  left is **per-weekday hours**, four-day weeks, and picking the lunch hour by hand — lunch currently lands
  automatically near the middle of the shift.
- **Personalised care** — custom stretch intervals and phrasing, a Pomodoro mode (25/5),
  and a "rough day" button that raises care frequency and lowers intensity.
- **A weekly report** — hours endured and items handled, folded into Friday's clock-out message.
- **A second layer to inspection** — each piece gives up its find once. Going further, so that the
  same object reads differently later (the prologue's footsteps, heard again after you find the
  bell), is where it stops being a drip and starts being a payoff.
- **Where the jukebox goes next** — a physical piece of furniture to play it from (it is a toolbar
  button today), letting the game know which audio files a given build actually shipped with (needed
  before unshipped tracks can be hidden from the list), and weather (only the hour is read today).
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
