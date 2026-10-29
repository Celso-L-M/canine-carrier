# Design Brief

## Direction

Canine Courier — a retro 8-bit arcade cabinet for a top-down hedge-maze game starring Max the German Shepherd.

## Tone

Nostalgic NES cartridge maximalism: hard pixel edges, no anti-aliasing, high-contrast forest palette — committed, never softened.

## Differentiation

A dark forest-green arcade world where a glowing amber-to-lime Sniff trail is the only light source, turning navigation into a glowing breadcrumb hunt.

## Color Palette

| Token      | OKLCH         | Role                              |
| ---------- | ------------- | --------------------------------- |
| background | 0.16 0.035 155 | Forest-black arcade ground        |
| foreground | 0.94 0.03 150  | HUD text and labels               |
| card       | 0.2 0.04 155   | HUD / overlay panels              |
| primary    | 0.72 0.19 150  | Hedge walls, primary arcade green |
| accent     | 0.8 0.16 85    | Amber-gold Sniff glow + score     |
| muted      | 0.24 0.045 155 | Inactive meter track, dividers    |
| destructive| 0.6 0.22 25    | Life loss, Game Over              |
| trail      | 0.86 0.2 130   | Electric-lime Sniff trail         |
| carrier    | 0.6 0.18 250   | Blue Mail Carrier                 |
| sprinkler  | 0.85 0.11 220  | Light-blue Sprinkler              |

## Typography

- Display: JetBrains Mono — blocky terminal mono for score, lives, Sniff meter, buttons, all overlays
- Body: DM Sans — clean sans for helper copy and instructions
- Scale: title `text-4xl md:text-6xl font-bold tracking-tight`, HUD label `text-xs tracking-[0.2em] uppercase`, body `text-base`

## Elevation & Depth

Flat 8-bit depth: hard offset pixel shadows (`6px 6px 0`) with inset borders instead of blur — layers read as stacked cartridges, never as glass.

## Structural Zones

| Zone    | Background        | Border                 | Notes                                   |
| ------- | ----------------- | ---------------------- | --------------------------------------- |
| Header  | `bg-card` pixel-panel | 3px `border-border` | Score, 3 hearts, Sniff meter in mono    |
| Content | `bg-background`   | —                      | Canvas playfield with double-stroke frame |
| Footer  | `bg-card` pixel-panel | 3px `border-border` | Controls hint: WASD/ARROWS + SPACE      |

## Spacing & Rhythm

Compact arcade density: `gap-4` between HUD groups, `p-4` panel padding, canvas inset by `p-2`; generous outer margin so the cabinet breathes on any screen.

## Component Patterns

- Buttons: square, `pixel-button` primary green with hard pixel shadow, press = translate into shadow
- Cards: square `pixel-panel`, `bg-card`, 3px border + inset ring + 6px offset shadow
- Badges: square mono chips, amber-gold on dark for score/status

## Motion

- Entrance: overlay screens pop in with a 4-step `steps()` scale flicker (0.15s)
- Hover: pixel buttons translate 2px into their shadow (0.08s steps)
- Decorative: Sniff trail pulses via opacity steps; sprinkler on/off is a hard 4s toggle

## Constraints

- Single dark forest theme only — no light mode
- No blur, no anti-aliasing, no rounded corners anywhere
- Canvas uses literal color values (cannot resolve CSS vars); HUD uses tokens only

## Signature Detail

The Sniff mechanic's amber-to-lime glowing trail — a pixel breadcrumb that briefly ignites the dark maze, the game's one moment of light.
