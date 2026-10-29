/**
 * Canine Courier — canvas renderer.
 *
 * Draws the whole scene in logical tile units, scaled to fit the canvas.
 * Everything is pixel-art: hard edges, no anti-aliased curves, chunky shapes.
 * Only `fillRect` / `arc` / `fill` are used so the renderer stays compatible
 * with the lightweight 2D-context stubs used in tests.
 */

import { CONFIG } from "./engine";
import { type GameState, type LostItem, Tile, type Vec2 } from "./types";

/** Palette pulled from the design tokens (kept in sync with index.css). */
const COLORS = {
  floor: "#0f2419",
  floorAlt: "#12291d",
  floorShade: "#0a1a12",
  hedge: "#2fbf4f",
  hedgeDark: "#1c8a37",
  hedgeLight: "#5fe07a",
  maxFur: "#a9713c",
  maxFurDark: "#7c4f26",
  maxNose: "#2a1a10",
  carrier: "#3b6fe0",
  carrierDark: "#24479c",
  sprinkler: "#7fd4f5",
  sprinklerDark: "#3a9fc4",
  trail: "#b6ff5c",
  trailHot: "#eaffb0",
  item: "#ffd24a",
  itemDark: "#c99a1f",
  text: "#eafbe6",
  burst: "#ffe98a",
  pulse: "#b6ff5c",
  vignette: "#e23b3b",
} as const;

/** 3x5 pixel bitmap font for the floating score bursts (digits + "+"). */
const GLYPHS: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
  "+": [0b000, 0b010, 0b111, 0b010, 0b000],
};

/** Draw a filled pixel square at a tile coordinate. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Draw a short string with the 3x5 pixel font. */
function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  let cx = x;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    if (rows) {
      for (let ry = 0; ry < rows.length; ry++) {
        for (let rx = 0; rx < 3; rx++) {
          if (rows[ry] & (1 << (2 - rx))) {
            px(ctx, cx + rx * scale, y + ry * scale, scale, scale, color);
          }
        }
      }
    }
    cx += 4 * scale;
  }
}

/** Render the maze floor and bush walls with depth shading. */
function drawMaze(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ts: number,
): void {
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const isWall = state.maze[y][x] === Tile.Wall;
      if (isWall) {
        // Bush: base green with a lighter top edge and darker bottom edge.
        px(ctx, x * ts, y * ts, ts, ts, COLORS.hedge);
        px(ctx, x * ts, y * ts, ts, ts * 0.22, COLORS.hedgeLight);
        px(ctx, x * ts, y * ts + ts * 0.78, ts, ts * 0.22, COLORS.hedgeDark);
        // Scatter a couple of leaf pixels for texture.
        px(
          ctx,
          x * ts + ts * 0.2,
          y * ts + ts * 0.45,
          ts * 0.16,
          ts * 0.16,
          COLORS.hedgeDark,
        );
        px(
          ctx,
          x * ts + ts * 0.62,
          y * ts + ts * 0.5,
          ts * 0.16,
          ts * 0.16,
          COLORS.hedgeLight,
        );
      } else {
        // Checkerboard floor for subtle depth.
        const alt = (x + y) % 2 === 0;
        px(ctx, x * ts, y * ts, ts, ts, alt ? COLORS.floor : COLORS.floorAlt);
        // Inner shadow along the top/left edges gives the floor recessed depth.
        const wallAbove = y > 0 && state.maze[y - 1][x] === Tile.Wall;
        const wallLeft = x > 0 && state.maze[y][x - 1] === Tile.Wall;
        if (wallAbove)
          px(ctx, x * ts, y * ts, ts, ts * 0.12, COLORS.floorShade);
        if (wallLeft) px(ctx, x * ts, y * ts, ts * 0.12, ts, COLORS.floorShade);
      }
    }
  }
}

/**
 * Draw the glowing sniff trail as a tapered breadcrumb: bright and wide at the
 * head (near Max) fading toward the tail.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ts: number,
  reducedMotion: boolean,
): void {
  if (state.trail.length === 0) return;
  // Under reduced motion the trail holds a steady brightness instead of pulsing.
  const pulse = reducedMotion
    ? 1
    : 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 220));
  ctx.save();
  for (let i = 0; i < state.trail.length; i++) {
    const t = state.trail[i];
    const cx = t.x * ts + ts / 2;
    const cy = t.y * ts + ts / 2;
    // Head (last tile) is largest and brightest; tail fades out.
    const progress = (i + 1) / state.trail.length;
    const size = ts * (0.16 + 0.24 * progress);
    ctx.globalAlpha = pulse * (0.35 + 0.65 * progress);
    px(
      ctx,
      cx - size / 2,
      cy - size / 2,
      size,
      size,
      progress > 0.75 ? COLORS.trailHot : COLORS.trail,
    );
  }
  ctx.restore();
}

/** Draw a lost item as a small pixel icon. */
function drawItem(
  ctx: CanvasRenderingContext2D,
  item: LostItem,
  ts: number,
): void {
  const x = item.pos.x * ts;
  const y = item.pos.y * ts;
  const s = ts * 0.5;
  const ox = x + (ts - s) / 2;
  const oy = y + (ts - s) / 2;

  if (item.kind === "newspaper") {
    px(ctx, ox, oy, s, s, COLORS.text);
    px(ctx, ox + s * 0.15, oy + s * 0.2, s * 0.7, s * 0.12, COLORS.itemDark);
    px(ctx, ox + s * 0.15, oy + s * 0.45, s * 0.7, s * 0.12, COLORS.itemDark);
    px(ctx, ox + s * 0.15, oy + s * 0.7, s * 0.4, s * 0.12, COLORS.itemDark);
  } else if (item.kind === "slipper") {
    px(ctx, ox, oy + s * 0.35, s, s * 0.5, COLORS.item);
    px(ctx, ox + s * 0.1, oy, s * 0.5, s * 0.4, COLORS.itemDark);
  } else {
    // Ball: a chunky circle approximated with stacked rectangles.
    px(ctx, ox + s * 0.2, oy, s * 0.6, s, COLORS.item);
    px(ctx, ox, oy + s * 0.2, s, s * 0.6, COLORS.item);
    px(ctx, ox + s * 0.35, oy + s * 0.35, s * 0.3, s * 0.3, COLORS.itemDark);
  }

  // Bright pickup flash: a white halo square behind the icon.
  if (item.flash && item.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, item.flash / CONFIG.itemFlashDuration);
    px(ctx, x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84, COLORS.text);
    ctx.restore();
  }
}

/** Draw Max as a brown pixel-art German Shepherd square. */
function drawMax(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ts: number,
  reducedMotion: boolean,
): void {
  // Blink while invulnerable.
  if (state.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0) return;

  // 2-frame walk bob while moving; a settled idle pose when standing still.
  const bob =
    state.moving && !reducedMotion
      ? Math.sin(state.walkPhase ?? 0) > 0
        ? -ts * 0.06
        : ts * 0.02
      : 0;

  const x = state.max.x * ts;
  const y = state.max.y * ts;
  const s = ts * 0.72;
  const ox = x - s / 2 + ts / 2;
  const oy = y - s / 2 + ts / 2 + bob;

  // Body.
  px(ctx, ox, oy, s, s, COLORS.maxFur);
  // Darker saddle across the back.
  px(ctx, ox, oy + s * 0.15, s, s * 0.35, COLORS.maxFurDark);
  // Ears (two dark nubs on top) — perk up while idle, flatten while moving.
  const earLift = state.moving ? s * 0.18 : s * 0.24;
  px(ctx, ox + s * 0.1, oy - earLift, s * 0.22, s * 0.22, COLORS.maxFurDark);
  px(ctx, ox + s * 0.68, oy - earLift, s * 0.22, s * 0.22, COLORS.maxFurDark);
  // Eyes facing the movement direction.
  const eyeY = oy + s * 0.42;
  const eyeSize = s * 0.14;
  if (state.facing.y >= 0) {
    px(ctx, ox + s * 0.22, eyeY, eyeSize, eyeSize, COLORS.maxNose);
    px(ctx, ox + s * 0.64, eyeY, eyeSize, eyeSize, COLORS.maxNose);
  } else {
    // Facing up: eyes near the top edge.
    px(ctx, ox + s * 0.22, oy + s * 0.2, eyeSize, eyeSize, COLORS.maxNose);
    px(ctx, ox + s * 0.64, oy + s * 0.2, eyeSize, eyeSize, COLORS.maxNose);
  }
  // Nose.
  px(ctx, ox + s * 0.42, oy + s * 0.72, s * 0.16, s * 0.14, COLORS.maxNose);
}

/** Draw a mail carrier as a blue pixel square with a shuffling leg cycle. */
function drawCarrier(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  ts: number,
  reducedMotion: boolean,
): void {
  const x = pos.x * ts;
  const y = pos.y * ts;
  const s = ts * 0.7;
  const ox = x - s / 2 + ts / 2;
  const oy = y - s / 2 + ts / 2;
  px(ctx, ox, oy, s, s, COLORS.carrier);
  px(ctx, ox, oy, s, s * 0.28, COLORS.carrierDark);
  px(ctx, ox + s * 0.2, oy + s * 0.45, s * 0.18, s * 0.18, COLORS.text);
  px(ctx, ox + s * 0.62, oy + s * 0.45, s * 0.18, s * 0.18, COLORS.text);

  // Leg shuffle: two small feet that alternate as the carrier walks.
  const phase = reducedMotion ? 0 : Math.sin(performance.now() / 140);
  const lift = phase > 0 ? s * 0.1 : 0;
  px(ctx, ox + s * 0.12, oy + s + lift, s * 0.2, s * 0.16, COLORS.carrierDark);
  px(ctx, ox + s * 0.68, oy + s - lift, s * 0.2, s * 0.16, COLORS.carrierDark);
}

/** Draw a sprinkler as a light-blue circle, spraying an arc when active. */
function drawSprinkler(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  active: boolean,
  ts: number,
  reducedMotion: boolean,
): void {
  const cx = pos.x * ts + ts / 2;
  const cy = pos.y * ts + ts / 2;
  const r = ts * 0.32;

  // Approximate a circle with a chunky pixel ring.
  ctx.fillStyle = active ? COLORS.sprinkler : COLORS.sprinklerDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.6, COLORS.floor);

  if (active) {
    // Spray arc: droplets sweep across a fan above the sprinkler head.
    const sweep = reducedMotion ? 0 : performance.now() / 300;
    ctx.fillStyle = COLORS.sprinkler;
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8 + sweep * 0.15;
      const dist = r * (1.4 + 0.25 * Math.sin(sweep + i));
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      px(ctx, cx + dx - 2, cy + dy - 2, 4, 4, COLORS.sprinkler);
    }
  }
}

/** Draw the expanding Sniff pulse ring centred on Max. */
function drawSniffPulse(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ts: number,
  reducedMotion: boolean,
): void {
  // Reduced motion suppresses the pulsing ring entirely.
  if (reducedMotion) return;
  if (state.sniffPulse && state.sniffPulse > 0) {
    const progress = 1 - state.sniffPulse / CONFIG.sniffPulseDuration;
    const cx = state.max.x * ts + ts / 2;
    const cy = state.max.y * ts + ts / 2;
    const radius = ts * (0.4 + progress * 2.6);
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.5;
    ctx.fillStyle = COLORS.pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    // Punch the centre back out so the ring reads as a hollow pulse.
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.floor;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, radius - ts * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Draw the floating "+100" score bursts. */
function drawBursts(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ts: number,
): void {
  for (const b of state.bursts ?? []) {
    const progress = 1 - b.timer / CONFIG.burstDuration;
    const cx = b.pos.x * ts + ts / 2;
    // Rise upward as the burst ages.
    const cy = b.pos.y * ts + ts * 0.3 - progress * ts * 0.9;
    const scale = Math.max(1, Math.round(ts * 0.06));
    const label = `+${b.value}`;
    const width = label.length * 4 * scale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.timer / (CONFIG.burstDuration * 0.5));
    drawPixelText(ctx, label, cx - width / 2, cy, scale, COLORS.burst);
    ctx.restore();
  }
}

/** Render one complete frame. */
export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  reducedMotion = false,
): void {
  // Letterbox the maze to preserve aspect ratio (no distortion).
  const ts = Math.min(width / state.cols, height / state.rows);
  const boardW = ts * state.cols;
  const boardH = ts * state.rows;
  const offsetX = (width - boardW) / 2;
  const offsetY = (height - boardH) / 2;

  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  // Screen shake: jitter the whole board while the hit effect is active.
  if (state.shake && state.shake > 0 && !reducedMotion) {
    const mag = (state.shake / CONFIG.shakeDuration) * ts * 0.22;
    const jx = Math.sin(performance.now() / 22) * mag;
    const jy = Math.cos(performance.now() / 17) * mag;
    ctx.translate(jx, jy);
  }
  ctx.translate(offsetX, offsetY);

  drawMaze(ctx, state, ts);
  drawTrail(ctx, state, ts, reducedMotion);

  // Items are visible while revealed by a Sniff, and briefly while flashing.
  for (const item of state.items) {
    if (!item.collected && state.revealTimer > 0) drawItem(ctx, item, ts);
    else if (item.collected && item.flash && item.flash > 0)
      drawItem(ctx, item, ts);
  }

  for (const s of state.sprinklers)
    drawSprinkler(ctx, s.pos, s.active, ts, reducedMotion);
  for (const c of state.carriers) drawCarrier(ctx, c.pos, ts, reducedMotion);
  drawSniffPulse(ctx, state, ts, reducedMotion);
  drawMax(ctx, state, ts, reducedMotion);
  drawBursts(ctx, state, ts);

  ctx.restore();

  // Red vignette flash on the outer edges after taking a hit.
  if (state.vignette && state.vignette > 0 && !reducedMotion) {
    const alpha = (state.vignette / CONFIG.vignetteDuration) * 0.45;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.vignette;
    const band = Math.min(width, height) * 0.16;
    ctx.fillRect(0, 0, width, band);
    ctx.fillRect(0, height - band, width, band);
    ctx.fillRect(0, 0, band, height);
    ctx.fillRect(width - band, 0, band, height);
    ctx.restore();
  }
}

/** Expose the collision radius for tests / debugging. */
export const HIT_RADIUS = CONFIG.hitRadius;
