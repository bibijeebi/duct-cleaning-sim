# Task Breakdown: Feature Branches

Each task below is a self-contained feature branch. Tasks are ordered by dependency — earlier tasks must merge before later ones can build on them. Tasks within the same tier can run in parallel.

---

## Tier 0: Foundation (must be first)

### Branch: `feat/project-scaffold`
**Priority**: BLOCKING — nothing else can start without this
**Estimated complexity**: Small

Set up the Vite + TypeScript + Babylon.js project:
- `npm create vite@latest` with vanilla-ts template
- Install: `@babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials`
- Configure `tsconfig.json` strict mode
- Create the full directory structure from CLAUDE.md
- Create stub files for every module (export empty classes/functions)
- Create `src/utils/constants.ts` with color palette, physics params
- Verify: `npm run dev` shows a black Babylon canvas with "Duct Cleaning Simulator" text via Babylon GUI
- Commit and push

**Acceptance criteria**: Dev server runs. Canvas renders. All stub files exist. TypeScript compiles clean.

---

## Tier 1: Core Systems (parallel after Tier 0)

### Branch: `feat/player-controller`
**Priority**: HIGH
**Depends on**: `feat/project-scaffold`
**Estimated complexity**: Medium

Build the first-person controller:
- Babylon `FreeCamera` with WASD movement + mouse look
- Pointer lock on canvas click (ESC to release)
- Gravity enabled (`camera.applyGravity = true`)
- Collision detection (`camera.checkCollisions = true`)
- Interaction raycast: cast ray from camera center, detect objects within 3 meters
- Visual crosshair (Babylon GUI)
- Interaction prompt text when looking at interactive objects ("Press E to interact")
- E key triggers interaction on current raycast target

**Acceptance criteria**: Player can walk around a test room (4 walls, floor, ceiling). Cannot clip through walls. Mouse look works. Crosshair visible. Raycast identifies a test cube when looked at.

---

### Branch: `feat/building-generator`
**Priority**: HIGH
**Depends on**: `feat/project-scaffold`
**Estimated complexity**: Large

Procedural commercial building floor:
- Room generator: takes a grid layout config (rooms as rectangles with positions)
- Wall meshes with collision
- Floor mesh with collision
- Drop ceiling grid (tiles as separate meshes — some removable for duct access)
- Hallways connecting rooms
- Door openings (no door meshes needed yet)
- Mechanical room (larger, labeled)
- Exterior area (parking lot plane with van/trailer spawn point)
- Basic lighting (ambient + point lights in rooms simulating fluorescents)
- Scenario 1 layout: ~8 rooms, 2 hallways, 1 mechanical room, exterior

**Acceptance criteria**: Player spawns in parking lot, walks into building, navigates through rooms. All walls have collision. Ceiling tiles visible. Mechanical room identifiable. Rooms are distinct spaces.

---

### Branch: `feat/game-state`
**Priority**: HIGH
**Depends on**: `feat/project-scaffold`
**Estimated complexity**: Medium

State machine and scoring:
- Phase enum: PRE_JOB, ARRIVAL, SETUP, EXECUTION, COMPLETION, CLEANUP, SCORED
- Phase transition logic with prerequisite checks
- Task list per phase (from CLAUDE.md game design)
- Task completion tracking (checked/unchecked)
- Score tracker: starting score, deduction/bonus application, final calculation
- Event system using Babylon `Observable` for cross-system communication
- Events: `onPhaseChange`, `onTaskComplete`, `onScoreChange`, `onProblemTrigger`
- Timer: elapsed time tracking per phase and total

**Acceptance criteria**: State machine transitions through all phases. Tasks can be marked complete. Score adjusts with deductions/bonuses. Events fire correctly. Unit tests pass for scoring math.

---

## Tier 2: Game Content (parallel after Tier 1)

### Branch: `feat/hvac-model`
**Priority**: HIGH
**Depends on**: `feat/building-generator`, `feat/game-state`
**Estimated complexity**: Large

HVAC system representation:
- Air handler mesh in mechanical room (box with door, coils visible inside, filter slot)
- Trunk line mesh (large rectangular duct leaving air handler, runs above ceiling)
- Branch duct meshes splitting off trunk to rooms
- VAV box meshes at branch points (small box with damper visible)
- Supply register meshes at room ceiling/wall positions (smaller, with louvers)
- Return grill meshes (larger, simpler grille pattern)
- Color coding system: supply = blue tint, return = red tint (visible only after player identifies them)
- Airflow direction arrows (particle system or animated arrows, shown after identification)
- Debris state per duct section: 0.0 (clean) to 1.0 (filthy), visual darkening
- Duct material type per section: rigid, flex, ductboard (visual distinction)
- Interactive: click register to remove/reinstall, click duct to inspect/cut access hole

**Acceptance criteria**: Walking through the building, player sees registers in ceilings/walls. Air handler visible in mechanical room with coils and filter. Duct runs visible above removed ceiling tiles. Supply vs return visually distinct after ID. Debris level affects duct appearance.

---

### Branch: `feat/equipment-system`
**Priority**: HIGH
**Depends on**: `feat/game-state`, `feat/player-controller`
**Estimated complexity**: Large

Equipment inventory and interaction:
- Van/trailer area with equipment laid out (or stored in compartments)
- Equipment loadout screen (Babylon GUI overlay): checklist of available items
- Player inventory: currently carried tools (limit 3-4 at a time)
- Tool switching (number keys or scroll wheel)
- Current tool visible in HUD
- Equipment definitions in `data/equipment.ts`:
  - Agitation wand (with forward/reverse head selection)
  - Portable vacuum
  - Negative air machine (squirrel cage)
  - 8-10" tubing sections (stackable)
  - 6" tubing sections
  - Quick connects
  - Duct tape
  - Hole cutter (8" and 1")
  - Tin snips
  - Screw gun
  - Sheet metal patches
  - Pop plugs
  - Mastic/putty
  - FSK tape
  - Pressure washer
  - Garden hose
  - Coil cleaner spray
  - Degreaser
  - Brushes
  - Plastic sheeting rolls
  - PPE (masks)
  - Broom/dustpan
- Tool-material compatibility matrix from CLAUDE.md
- Gas can interaction for squirrel cage (primer bulb mini-game?)

**Acceptance criteria**: Player walks to van, opens loadout screen, selects tools. Can carry limited items. Tool switching works. Correct tool + correct target = success. Wrong combo = deduction event fired.

---

### Branch: `feat/hud-ui`
**Priority**: MEDIUM
**Depends on**: `feat/game-state`, `feat/player-controller`
**Estimated complexity**: Medium

In-game HUD using Babylon GUI:
- Current phase display (top center)
- Task checklist (right side, scrollable if needed)
- Current score (top right)
- Timer (top left)
- Current tool indicator (bottom center)
- Interaction prompt (bottom center, contextual)
- Phase transition screen (full overlay with phase name, objectives summary)
- Pause menu (ESC when pointer not locked)
- End-of-job scorecard (detailed breakdown: deductions, bonuses, final grade, letter grade A-F)

**Acceptance criteria**: All HUD elements visible and updating in real-time. Phase transitions show overlay. Scorecard renders at end. Pause menu works.

---

## Tier 3: Gameplay Mechanics (after Tier 2)

### Branch: `feat/duct-cleaning-mechanic`
**Priority**: HIGH
**Depends on**: `feat/hvac-model`, `feat/equipment-system`
**Estimated complexity**: Large

The core cleaning gameplay:
- Approach a duct access point (register removed or access hole cut)
- Insert wand → camera transitions to 2D cross-section view
- 2D view shows:
  - Duct interior (rectangular cross-section, walls with debris texture)
  - Wand extending from access point
  - Debris particles (dark spots/clumps on walls)
  - Airflow direction arrows pointing toward negative air machine
  - Player controls wand depth (mouse or arrow keys)
  - Wand head sprays air (particle effect in configured direction)
  - Debris particles detach and flow toward suction
  - Progress bar showing section cleanliness
- Material-specific behavior:
  - Rigid: aggressive OK, debris flies off fast
  - Flex: walls visually flex/deform if too aggressive, collapse warning
  - Ductboard: fibers release if wand contacts walls, air-wash-only indication
- When section clean, return to 3D view
- Track which sections cleaned, enforce return-before-supply order

**Acceptance criteria**: Full cleaning loop works for one duct section. 2D view renders correctly. Material rules enforced. Debris visually clears. Progress tracked in game state.

---

### Branch: `feat/patching-system`
**Priority**: MEDIUM
**Depends on**: `feat/hvac-model`, `feat/equipment-system`
**Estimated complexity**: Medium

Access hole cutting and code-compliant patching:
- Cut 1" hole: quick animation, hole appears in duct mesh
- Cut 8" hole: longer animation, larger hole
- 1" patch: select pop plug from inventory → click hole → plug inserted (simple)
- 8" patch sequence (must be done in order for full points):
  1. Place sheet metal square patch over hole
  2. Drive screws at corners and sides (click positions)
  3. Apply mastic around seam (click-drag around edge)
  4. Apply mastic on patch face
  5. Roll insulation back over patch
  6. Apply FSK tape over insulation
- Deductions for: missing steps, wrong order, using duct tape instead of FSK

**Acceptance criteria**: Both hole sizes cuttable. Pop plug works. 8" patch sequence works with step validation. Wrong steps trigger score deductions.

---

### Branch: `feat/pressure-wash`
**Priority**: MEDIUM
**Depends on**: `feat/equipment-system`, `feat/game-state`
**Estimated complexity**: Small-Medium

Grill/register cleaning sub-task:
- Removed registers/grills go to a staging area (or carried outside)
- Find spigot (exterior of building, marked)
- Lay tarp on ground
- Connect garden hose to pressure washer
- Check gas level on pressure washer
- Spray grills (progress bar per grill, visual cleaning)
- Stubborn ones need brush + spray combo
- Coil cleaning in air handler:
  - Spray coil cleaner on coils
  - Use coil cleaning pressure washer rig
  - Apply diluted degreaser

**Acceptance criteria**: Grills can be taken outside. Pressure wash process works. Coils cleanable. Progress tracked. All steps scoreable.

---

### Branch: `feat/problem-injection`
**Priority**: MEDIUM
**Depends on**: `feat/game-state`, `feat/hvac-model`, `feat/equipment-system`
**Estimated complexity**: Medium

Random problem events:
- Problem definitions in `data/problems.ts` with trigger conditions, resolution steps, score impact
- 2-3 problems randomly selected per scenario run
- Problems trigger at appropriate phase/location
- Each problem has:
  - Visual/audio indicator
  - Required response (correct tools/actions)
  - Timer for response (some are urgent)
  - Score impact for correct/incorrect handling
- Implement at least these 5 for MVP:
  1. Painted screws on register
  2. Breaker trip
  3. Mold discovery (STOP WORK)
  4. Collapsed flex duct
  5. Missing tool left in van

**Acceptance criteria**: Problems appear randomly. Each has clear visual indicator. Correct resolution rewards points. Incorrect/ignored deducts. Mold triggers mandatory stop-work.

---

## Tier 4: Polish & Scenarios (after Tier 3)

### Branch: `feat/audio`
Sound effects: footsteps, compressor hum, vacuum motor, wand air blast, screw gun, pressure washer, debris hitting vacuum intake, ambient building sounds, alert sounds for problems.

### Branch: `feat/scenario-2-courthouse`
Durham County Courthouse layout. PTAC units. Multi-floor (elevator). Portable equipment required.

### Branch: `feat/scenario-3-institutional`
Large building. RTU on roof. VAV boxes. Mixed materials. Fire dampers. Hazard encounters.

### Branch: `feat/tutorial-mode`
Guided first-run with step-by-step instructions, highlighting what to do next, pausing to explain concepts.

### Branch: `feat/dialogue-system`
Building manager interactions. Customer personalities. Professional communication scoring.

---

## Quick Reference: Dependency Graph

```
project-scaffold
├── player-controller ──┐
├── building-generator ─┤
└── game-state ─────────┤
                        ├── hvac-model ──────────┐
                        ├── equipment-system ─────┤
                        └── hud-ui               ├── duct-cleaning-mechanic
                                                  ├── patching-system
                                                  ├── pressure-wash
                                                  └── problem-injection
                                                      │
                                                      ├── audio
                                                      ├── scenario-2
                                                      ├── scenario-3
                                                      ├── tutorial-mode
                                                      └── dialogue-system
```
