# PlunderDown — Product Requirements

> Sibling game to PoorDown. Reuses the same serverless P2P architecture (Y.js + y-webrtc, host-authoritative, Vercel-only deploy) but is a 3D naval pirate game built around `public/kenney_pirate-kit/`.

---

## 1. Vision

**PlunderDown** is a browser-based 3D multiplayer pirate game. 2–6 friends each command a ship on a small open sea dotted with islands, towers, and shipwrecks. They sail, shoot, loot, and back-stab their way to becoming the richest captain — or the last one floating.

Like PoorDown: no signup, no install, no paid backend. Click a link → name yourself → you're at the helm.

**Tagline:** *"Sail. Loot. Betray. Repeat."*

**Target user:** Same 2–8 friend groups as PoorDown — short sessions (15–25 min per match), low ceremony, high banter.

---

## 2. Why this game

| Constraint | How PlunderDown answers it |
|---|---|
| Must reuse PoorDown's free infra (Vercel + y-webrtc) | Game state is small (ships, treasure, flags). Easily fits in a Y.Doc. No server. |
| Must work for 2–8 players on home internet | Soft cap 6 (mesh WebRTC + 3D rendering budget). |
| Must use the Kenney pirate kit *fully* | 74 GLB models. Every asset has a gameplay role — see §10. |
| Must be interesting, not just "pew pew" | Five intertwined mechanics: Wind, Cargo Weight, Bounty Mark, Mutiny, Storm Front (§5). |

---

## 3. Core Principles

1. **Zero friction** — same as PoorDown. No accounts. Share a link.
2. **Zero cost to host** — Vercel + free STUN. No paid servers ever.
3. **Short, replayable matches** — 15–25 min, then everyone re-rolls a new map.
4. **Friends-first** — designed for trusted groups. No anti-cheat beyond host validation.
5. **Asset-driven** — every GLB in the kit has a gameplay reason to be on the map.

---

## 4. Game Loop

```
Lobby (host configures rules)
  → Game start: each player spawns at a different corner of the sea,
                gets a small ship + 0 doubloons.
  → Open play (15–25 min):
      sail → loot → fight → bank treasure at owned dock → upgrade
  → Match ends when EITHER
      (a) timer expires → richest captain wins, OR
      (b) only one ship still afloat → that ship wins
  → Scoreboard → "Rematch?" button → back to lobby
```

A single "turn" in the PoorDown sense doesn't exist here — gameplay is **real-time but tick-based** (10 Hz logic tick run by host, broadcast via Y.js). All players act simultaneously.

---

## 5. Interesting Mechanics (the five hooks)

These are the things that make the game more than a generic naval brawler. All five are simple to read on screen, but interact in non-obvious ways.

### 5.1 Wind & Sail
- A global wind vector exists, visible via flags on every island, mast pennant on every ship, and a compass HUD.
- Wind direction shifts every **60–90 seconds** (host rolls).
- Sailing *with* the wind: speed 1.0×. Against: 0.4×. Perpendicular: 0.7×.
- Players can lower sails (1/2 speed but instant turning) or raise sails (full speed, slow turning).
- **Why this matters:** chases are decided by who reads the wind, not by who clicks faster.

### 5.2 Cargo Weight
- Every doubloon on board is weight. A ship at 100% cargo capacity is **35% slower** and **takes 50% longer to turn**.
- Banking treasure at your dock unloads the weight.
- **Why this matters:** the leader is naturally slowed, the chasers are fast — natural rubber-banding without explicit comeback mechanics.

### 5.3 Bounty Mark
- The captain with the most uncashed doubloons at any moment flies a red bounty flag (`flag.glb` retextured / `flag-pirate.glb`).
- A **ghost ship** (`ship-ghost.glb`) — AI-controlled, host-run — spawns from fog and hunts the bounty leader.
- The ghost ship is slow but cannot be sunk; it dissipates after 30 seconds or after dealing damage.
- Players who sink the marked leader get a **kill bonus** equal to 25% of the leader's cashed-in doubloons.
- **Why this matters:** there's always pressure on the leader, but the leader chose to take the risk by hoarding.

### 5.4 Mutiny Meter
- Each ship has a hidden Crew Morale value (0–100, starts 100).
- Morale drops when: taking damage without scoring, sitting still > 30s, going broke (cargo = 0 and bank = 0 for > 45s).
- Morale rises when: looting, sinking enemies, banking treasure.
- At morale 0: **mutiny** — your ship spawns a row of barrels behind you and your last 30s of unbanked doubloons spill as floating loot for anyone to grab. Your ship is locked for 8 seconds.
- **Why this matters:** running away with the lead is risky; getting bullied also gets punished — but only if you let it.

### 5.5 Storm Front
- One slow-moving cyclone (`hole.glb` flipped + rotating particle ring) drifts across the sea throughout the match.
- Inside the storm: zero visibility past 30 m, lightning deals 5 HP/sec to ships, but the storm reveals **rare treasure spawns** (gold-tinted chests worth 3×).
- **Why this matters:** a constantly-moving high-risk/high-reward zone.

---

## 6. Players, Ships, Loot

### Ships (player avatars)
| Tier | Asset | HP | Speed | Cargo | Cannons |
|---|---|---|---|---|---|
| Starter | `ship-small.glb` | 50 | 1.0× | 50 | 2 |
| Mid | `ship-medium.glb` | 90 | 0.9× | 100 | 4 |
| Heavy | `ship-large.glb` | 150 | 0.75× | 200 | 6 |
| **Pirate skins** of the same tiers | `ship-pirate-small/medium/large.glb` | identical stats | — | — | — |

Each player picks pirate or navy skin in the lobby — pure cosmetic.

### Wrecks & ghost
- `ship-wreck.glb` — wreck spawn points scattered around the map; salvageable for 50–200 doubloons (slow, leaves you stationary).
- `ship-ghost.glb` — hunts the bounty leader (§5.3). Also drops as a derelict mid-match in 1 fixed location worth 500 doubloons (huge prize, but the ghost ship still spawns from it once when you start looting).

### Loot containers (all draggable to your hold)
| Asset | Doubloons | Notes |
|---|---|---|
| `chest.glb` | 100 | Found on islands |
| `crate.glb` | 25 | Common floating loot |
| `crate-bottles.glb` | 40 | Restores 10 crew morale on pickup |
| `barrel.glb` | 15 | Floats after sinkings |
| `bottle.glb` | 5 | Drops from kills |
| `bottle-large.glb` | 20 | Rare floating |
| `cannon-ball.glb` | — | Ammo for cannons (carry up to 30) |

### Player tools
| Asset | Use |
|---|---|
| `tool-paddle.glb` | Spawns when sails are destroyed — slow emergency propulsion |
| `tool-shovel.glb` | Held while digging a buried chest (10-sec animation on islands, see §7) |

---

## 7. World & Map

The sea is a fixed-size 800×800 plane with the camera at a 45° tilt (top-down-ish strategic view, à la Sea of Thieves' map).

### Islands
Procedurally placed at match start, 8–12 per map. Each island uses these GLB pieces:

| Asset | Role |
|---|---|
| `patch-sand.glb`, `patch-sand-foliage.glb` | Beach base |
| `patch-grass.glb`, `patch-grass-foliage.glb` | Grass mid-island |
| `grass.glb`, `grass-patch.glb`, `grass-plant.glb` | Decorative ground cover |
| `palm-straight.glb`, `palm-bend.glb` | Standard palms |
| `palm-detailed-straight.glb`, `palm-detailed-bend.glb` | Hero palms (larger islands) |
| `rocks-a/b/c.glb`, `rocks-sand-a/b/c.glb` | Cliffs, hazards (ships take damage on collision) |
| `hole.glb` | Buried-chest marker — dig spot |

### Forts & Towers (capturable strategic points)
Three island types spawn:

1. **Trading Dock** — uses `structure-platform-dock.glb`, `structure-platform-dock-small.glb`, `structure-platform-planks.glb`, `platform.glb`. Anyone can dock and bank treasure (1% fee).
2. **Fort Island** — uses `castle-door.glb`, `castle-gate.glb`, `castle-wall.glb`, `castle-window.glb`, `structure.glb`, `structure-roof.glb`, `structure-fence.glb`, `structure-fence-sides.glb`, `cannon.glb` ×4. Capture by destroying the gate. Once captured, the cannons auto-fire at enemy ships in range. **0% bank fee for the owner.**
3. **Watchtower Island** — uses `tower-base.glb`, `tower-base-door.glb`, `tower-middle.glb`, `tower-middle-windows.glb`, `tower-roof.glb`, `tower-top.glb`, `tower-watch.glb`, `tower-complete-large/small.glb`. Capture to reveal fog of war in a 300 m radius.

Each player starts with **one captured Trading Dock** (their home base, marked with their colored flag — picked from `flag.glb`, `flag-pennant.glb`, `flag-high.glb`, `flag-high-pennant.glb`, `flag-pirate.glb`, `flag-pirate-pennant.glb`, `flag-pirate-high.glb`, `flag-pirate-high-pennant.glb` — 8 variants, one per player slot).

### Boats & accessories on islands
- `boat-row-large.glb`, `boat-row-small.glb` — buried-chest islands have a rowboat tied up; players who lose their ship respawn in one (slow, fragile, 1 cannon).
- `mast.glb`, `mast-ropes.glb` — visual dressing on Fort Islands.

### Cannons
- `cannon.glb` — static fort cannons.
- `cannon-mobile.glb` — your ship's cannons render this model on deck.
- `cannon-ball.glb` — projectile.

---

## 8. Combat

Real-time, simple, host-validated.

- **Aiming:** broadside (perpendicular to ship heading). Hold space to fan-fire all cannons on the side facing your cursor.
- **Damage:** 8 HP per cannonball hit. Bigger ships have more cannons but bigger hitboxes.
- **Ammo:** 30 cannonballs at spawn. Refill at any owned dock (free) or rivals' docks (10 doubloons per 10 balls).
- **Boarding:** Ram an enemy at >60% top speed → both ships locked together for 5 seconds. Crew transfer: attacker steals 20% of victim's uncashed doubloons. Cannot board if you have less HP than the victim (prevents leader-bullying).
- **Sinking:** When HP reaches 0, ship dissolves into a `ship-wreck.glb` worth 50% of its uncashed doubloons (free for anyone to salvage). Player respawns in a `boat-row-small.glb` at their dock after 10 seconds.

---

## 9. Doubloon Economy

| Source | Amount |
|---|---|
| Loot pickup | 5–100 (see §6) |
| Sinking another ship | 25% of their cashed total (Bounty bonus stacks) |
| Salvaging a wreck | 50–200 |
| Cyclone gold chest | 300 |
| Ghost-ship derelict | 500 |

| Sink | Cost |
|---|---|
| Bank at home dock | 0% fee |
| Bank at neutral Trading Dock | 1% fee |
| Bank at rival's captured dock | 5% fee (rival earns it) |
| Repair to full HP at dock | 50 |
| Ammo restock at dock | 0–10 |
| **Ship upgrade Small → Medium** | 300 |
| **Ship upgrade Medium → Large** | 600 |

Upgrades happen instantly at your home dock. Downgrade on respawn after losing your large ship — you come back in a Small.

---

## 10. Asset Coverage Matrix

The brief is "use the pirate kit *fully*." Every model has a gameplay role:

| Asset | Role |
|---|---|
| `ship-small/medium/large.glb` | Player ships (tier ladder) |
| `ship-pirate-small/medium/large.glb` | Pirate skins (cosmetic) |
| `ship-ghost.glb` | Bounty Mark hunter (§5.3) |
| `ship-wreck.glb` | Sunk-ship loot + map decor |
| `boat-row-small/large.glb` | Respawn rowboats |
| `cannon.glb` | Fort static cannons |
| `cannon-mobile.glb` | Player ship cannons |
| `cannon-ball.glb` | Projectile + ammo pickup |
| `chest.glb` | Premium loot (islands) |
| `crate.glb`, `crate-bottles.glb` | Floating loot |
| `barrel.glb` | Mutiny drops + floating loot |
| `bottle.glb`, `bottle-large.glb` | Small floating loot |
| `mast.glb`, `mast-ropes.glb` | Fort decor |
| `flag.glb`, `flag-pennant.glb`, `flag-high.glb`, `flag-high-pennant.glb` | 4 player-color flag variants |
| `flag-pirate.glb`, `flag-pirate-pennant.glb`, `flag-pirate-high.glb`, `flag-pirate-high-pennant.glb` | 4 more flag variants — total 8 = one per max-player |
| `palm-straight.glb`, `palm-bend.glb` | Standard island palms |
| `palm-detailed-straight/bend.glb` | Hero islands |
| `grass.glb`, `grass-patch.glb`, `grass-plant.glb` | Ground cover |
| `patch-grass.glb`, `patch-grass-foliage.glb` | Grass tiles |
| `patch-sand.glb`, `patch-sand-foliage.glb` | Sand tiles |
| `rocks-a/b/c.glb`, `rocks-sand-a/b/c.glb` | Damage hazards |
| `hole.glb` | Buried chest dig sites + storm visual |
| `platform.glb`, `platform-planks.glb` | Dock surfaces |
| `structure.glb`, `structure-roof.glb` | Fort buildings |
| `structure-fence.glb`, `structure-fence-sides.glb` | Fort perimeter |
| `structure-platform.glb`, `structure-platform-small.glb` | Tower bases / lookouts |
| `structure-platform-dock.glb`, `structure-platform-dock-small.glb` | Trading-Dock surfaces |
| `castle-door.glb` | Fort entrance (destroy to capture) |
| `castle-gate.glb` | Fort outer gate |
| `castle-wall.glb`, `castle-window.glb` | Fort walls |
| `tower-base.glb`, `tower-base-door.glb` | Watchtower foundations |
| `tower-middle.glb`, `tower-middle-windows.glb` | Watchtower body |
| `tower-roof.glb`, `tower-top.glb`, `tower-watch.glb` | Watchtower spires |
| `tower-complete-large.glb`, `tower-complete-small.glb` | Pre-assembled watchtower variants for performance LODs |
| `tool-paddle.glb` | Emergency paddle when sails destroyed |
| `tool-shovel.glb` | Buried-chest dig animation prop |

**Coverage: 74/74 assets used.**

---

## 11. Features

### Must Have (MVP)
- Same identity flow as PoorDown (name + UUID in `localStorage` as `plunderdown_identity`).
- Same room flow: 6-char code, shareable link, up to 6 players.
- Y.js + y-webrtc P2P sync (architecture from `architecture.md` carries over).
- 3D scene rendered with React Three Fiber.
- Real-time 10 Hz host-authoritative simulation.
- All five core mechanics (§5).
- Combat, banking, ship upgrades.
- Match timer + win condition.
- Host migration on disconnect (identical to PoorDown's).

### Should Have
- Pre-game rule config (match length, starting doubloons, storm intensity).
- Reconnect / rejoin via UUID match.
- Mobile-friendly touch controls (virtual joystick + fire button).
- Spectator mode for eliminated players until match end.
- Minimap with fog of war.

### Nice to Have
- Cosmetic flag picker (8 variants, see §7).
- Per-match scoreboard with sub-stats (most loot, most kills, most banked).
- Sound effects (cannons, splash, wind howl).
- Persistent player stats in `localStorage` (W/L, lifetime doubloons).
- Replay highlight: 5-sec clip of last sinking.

### Out of Scope (v1)
- AI bots.
- Persistent rank / matchmaking.
- Voice chat.
- Custom maps / map editor.
- Mid-match join.

---

## 12. Tech Stack (delta from PoorDown)

| Layer | PoorDown | PlunderDown |
|---|---|---|
| Framework | Next.js 14, Pages, JS | Same |
| Rendering | SVG + Framer Motion | **Three.js via `@react-three/fiber` + `@react-three/drei`** |
| GLB loading | n/a | `useGLTF` from drei, models served from `/public/kenney_pirate-kit/Models/GLB format/` |
| Real-time sync | Y.js + y-webrtc | Same |
| Identity | nanoid + localStorage | Same |
| Hosting | Vercel | Same |

New packages: `three`, `@react-three/fiber`, `@react-three/drei`.

Everything else (no DB, no paid backend, host-authoritative, host migration) is reused verbatim from PoorDown's architecture.

---

## 13. Y.js Document Schema

```
ydoc
├── getMap('meta')      → hostId, phase, matchStartedAt, matchEndsAt,
│                         windDir, windSpeed, windShiftAt,
│                         stormCenter, stormRadius, stormVelocity,
│                         bountyHolderId, ghostShipState, gameOver, winnerId
├── getArray('players') → ordered Player[]
├── getMap('ships')     → uuid → ShipState (live tick state)
├── getMap('loot')      → lootId → LootState (chest/barrel/crate items)
├── getMap('islands')   → islandId → IslandState (ownerId, capturedAt, alive)
├── getMap('config')    → match config (length, storm intensity, etc.)
└── awareness           → presence, cursors, ping
```

### Player
```js
{ uuid, name, flagVariant, joinedAt, isHost, isAlive,
  cashedDoubloons, kills, deaths, mutinies }
```

### ShipState (high-frequency, host-only writer)
```js
{ ownerId, tier: 'small'|'medium'|'large', skin: 'navy'|'pirate',
  pos: [x,y,z], heading: rad, sailState: 'down'|'up',
  hp, ammo, cargoDoubloons, crewMorale,
  isStunned, stunnedUntilTick, lastDamageFromId }
```

To keep CRDT updates cheap, only **delta-relevant** fields go in Y.js. Visual interpolation between ticks happens client-side in R3F's frame loop — never written back.

---

## 14. Controls

### Desktop
| Input | Action |
|---|---|
| `W` / `S` | Raise / lower sails (binary) |
| `A` / `D` | Turn left / right |
| Mouse aim | Aim broadside |
| Left click / `Space` | Fire cannons on side facing cursor |
| `E` | Interact (dock, dig, salvage, capture) |
| `Tab` | Toggle scoreboard |
| `M` | Toggle minimap zoom |

### Mobile
- Left half: virtual joystick (sail + turn).
- Right half: fire button + interact button.
- Top corner: minimap.

---

## 15. UI / Layout

### Landing Page (`/`)
Carries PoorDown's exact pattern: hero + two cards (Create / Join). Branding swaps to pirate palette but retains the cream/serif/flat aesthetic. Logo: a doubloon coin with crossed cannons.

### Lobby (`/room/[code]`, pre-start)
- Center: spinning preview of selected ship.
- Right sidebar: connected captains list + their flag picks.
- Host controls: match length, storm intensity, starting doubloons.
- Bottom: "Hoist the Colors!" start button (host only).

### In-Match (`/room/[code]`, mid-game)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [ROOM] [Timer 12:43] [Wind ↗ 1.2×] [P1][P2][P3]...  │  HUD: 56px
├──────────────────────────────────────────┬──────────────────┤
│                                          │ Minimap          │
│         3D scene (R3F canvas)            │ (with fog)       │
│         camera: 45° top-down             │                  │
│                                          ├──────────────────┤
│   ┌─────────────────────────────────┐    │ Player roster    │
│   │ HP ███████░░  Cargo $230/100    │    │ - You: $1,200    │
│   │ Ammo 22  Morale ███████░        │    │ - Jane: $1,800🚩 │
│   └─────────────────────────────────┘    │ - Bob: $400      │
│                                          │                  │
└──────────────────────────────────────────┴──────────────────┘
```

### End Screen
- Confetti-free, in keeping with PoorDown's restraint.
- Winner banner: ship model rotating, doubloon count counting up.
- Per-player stats card.
- "Rematch?" / "New Map" buttons.

---

## 16. Color & Design Language

Reuses PoorDown's palette with one substitution: swap Board Green for **Sea Teal** as the dominant scene tone.

| Role | Hex | Usage |
|---|---|---|
| Sea Teal | `#1A6B7A` | Water plane base |
| Sand Cream | `#F8F4E8` | UI surfaces (same as PoorDown) |
| Pirate Red | `#E63946` | Bounty flag, danger UI (same red) |
| Treasure Gold | `#F4A261` | Doubloon counts (same gold) |
| Storm Slate | `#3B4A5A` | Storm zone, fog edges |
| Dark | `#2B2D42` | Text + UI strokes (same) |

Typography identical to PoorDown: Playfair Display (display), Inter (UI), JetBrains Mono (numbers).

---

## 17. Performance Budgets

| Metric | Budget |
|---|---|
| First scene render | < 3 s on mid-tier laptop |
| GLB total payload | < 8 MB (kit is currently ~3.5 MB) |
| Frame rate | ≥ 50 fps with 6 ships + 30 loot items on screen |
| Tick rate (host) | 10 Hz |
| Y.js update size per tick | < 1 KB per ship; full doc < 50 KB at any time |
| Concurrent peers | 6 hard cap |

LODs: use `tower-complete-large/small.glb` instead of stacked tower pieces beyond 200 m view distance.

---

## 18. Build Phases

### Phase 1 — Foundation (mirror PoorDown Phase 1)
1. Scaffold Next.js app, reuse PoorDown's lobby/identity code.
2. Stand up R3F canvas with a static sea + one loaded `ship-small.glb`.
3. WASD ship driving (local only).
4. Hook in Y.js + y-webrtc using PoorDown's room pattern.
5. Two browser tabs → two ships driving in same scene.

**Milestone:** Two players sail around an empty sea together.

### Phase 2 — World & Loot
1. Procedural island placement (3 island archetypes).
2. Loot spawning (chests, crates, barrels).
3. Pickup interaction (`E`).
4. Home dock + banking.

**Milestone:** Players can collect doubloons and bank them.

### Phase 3 — Combat
1. Cannons + cannonballs.
2. HP, sinking, respawn as rowboat.
3. Boarding.
4. Wrecks salvageable.

**Milestone:** Players can fight to the death.

### Phase 4 — The Five Hooks (§5)
Each mechanic shipped in order: Wind → Cargo Weight → Bounty Mark + Ghost Ship → Mutiny → Storm Front.

**Milestone:** The game feels distinctly *this game*, not generic naval shooter.

### Phase 5 — Polish
Mobile controls, sound, spectator mode, pre-game config, minimap fog, end-screen stats.

---

## 19. Open Questions

| Question | Current thinking |
|---|---|
| Should boarding be a mini-game or instant transfer? | Start with instant transfer. Add mini-game only if matches feel one-sided. |
| Are forts permanent captures or contestable mid-match? | Contestable. Owner ship must be within 200 m for cannons to fire — leave the area and a rival can attack the gate. |
| Does ghost ship target *any* leader or only above a threshold? | Above 500 uncashed doubloons. Prevents early-game harassment. |
| How is map seed shared? | Host generates seed at lobby start, writes to `meta.seed`. All clients seed their RNG identically. |
| Anti-grief: can you fire on a docked ally? | Yes, but docks have static cannons (Fort Islands) that retaliate. Trading Docks are neutral — no auto-defense. |
| What if the host migrates mid-match? | Same as PoorDown — next player by `joinedAt` runs the tick loop. Tick history isn't replayed; new host picks up from current Y.js state. Brief 1–2 tick stutter is acceptable. |

---

## 20. Non-Goals (explicit)

- Not a Sea of Thieves clone — no MMO scale, no persistent world.
- Not a strategy game — no fleet management, no city-building.
- Not asymmetric — every player starts equal.
- Not deep RPG — no skill trees, no XP. Upgrades are tier ladder only.
- Not cross-game with PoorDown — separate codebase, separate routes, but shared architectural patterns.
