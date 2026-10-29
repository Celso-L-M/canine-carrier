# Project Guidance

## User Preferences

- Retro 8-bit arcade aesthetic
- Blocky retro font for score, lives and the Sniff meter
- Retro dark green background
- Cleanly commented code

## Accepted Requirements

- Retro 8-bit top-down maze game called 'Canine Courier' with Max the German Shepherd
- Grid-based maze with green bush walls and brown pixel-square Max
- WASD/Arrow keyboard movement with wall collision
- 3 randomly placed hidden lost items revealed by a Spacebar Sniff with a glowing trail and 3-second visibility
- Sniff meter that depletes and recharges
- Patrolling blue Mail Carriers and cycling light-blue Sprinklers that cost a life on contact
- Retro dark-green 8-bit styling, blocky font, scalable canvas, commented code
- Improve the overall quality of the existing Canine Courier game
- Keep the existing maze, Sniff, hazard, lives, and stats-persistence behavior intact

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- A min-h-dvh flex column gives flex-1 children no definite height; use h-dvh + min-h-0 so a canvas stage is bounded by the viewport.
- An absolutely-positioned canvas (absolute inset-0) stops its backing-store size from feeding back into container layout height.
- Game loop effect must read the run-end callback from a ref, not the dep array, or parent re-renders restart the RAF loop.
- Canvas backing store uses devicePixelRatio with setTransform each frame; letterbox tiles via min(w/cols,h/rows) to avoid distortion.
- Owner-keyed Map<Principal, Record> OQL entities use OQL.Entity.newScoped with a flat Row record promoting the owner from the key, plus .ownedBy("owner").scopedPerUser().
- Generated OQL files under src/backend/generated/ must import types as ../types/common, not ../../types/common.
- New stable actor fields require the pending migration's NewActor to produce them; fold into the existing pending file.
- Migration files must inline their own types and may only import mo:core and mops packages.
- Motoko text literals do not support backslash-newline continuation; a trailing backslash before a newline is an illegal escape (M0002).
- The game canvas is not focusable, so automated browser testing cannot deliver keyboard input to it; keyboard-driven flows need a focusable element or a programmatic input path to be testable.
- Gate every time-driven visual (trail pulse, sniff ring) on the reducedMotion flag, not just screen shake and vignette.
- Tester-owned test literals omit new GameState/LostItem fields, so new state fields must be optional with engine-side nullish defaults.
- The canvas renderer must avoid fillText/stroke/measureText; the test 2D-context stub only provides fillRect/arc/fill, so draw text with a pixel bitmap font.
- The game canvas still exposes no focusable element, so automated browser testing cannot deliver keyboard input; keyboard-driven flows remain unverifiable end to end.
