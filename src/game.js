import { buildLevelLayout } from './levels.js';

// Reduce player and goal squares by an additional 50% (37.5 -> 18.75)
const PLAYER_SIZE = 18.75;
const GOAL_SIZE = 18.75;
const PLATFORM_HEIGHT = PLAYER_SIZE * 0.5; // 75
const ROTATE_DURATION = 0.7; // seconds
const RED_FADE_SECONDS = 5.0;
const EDGE_GRACE_SECONDS = 3.0;
const MOVE_SPEED = 700; // px/s, immediate
const JUMP_SPEED = 1100; // px/s upward
const GRAVITY = 2600; // px/s^2
const TERMINAL_VEL = 2400; // px/s

export class Game {
  constructor(canvas, hudEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hudEl = hudEl;
    this.levelIndex = 0; // 0..9
    this.worldRotationSteps = 0; // 0,1,2,3 for 0,90,180,270
    this.rotateAnim = null; // {dir, t}
    this.winAnim = null; // {t}
    this.time = 0;
    this.edgeTouchAccum = 0;
    this.resetJumpUsed = false;

    this.handleResize(canvas.width, canvas.height);
    this.loadLevel(this.levelIndex);
  }

  handleResize() {
    // Rebuild current level layout on resize (keep progress minimal; restart attempt)
    const { width: W, height: H } = this.canvas;
    this.W = Math.floor(W / (window.devicePixelRatio || 1));
    this.H = Math.floor(H / (window.devicePixelRatio || 1));
    this.loadLevel(this.levelIndex, true);
  }

  loadLevel(idx, keepRotation = false) {
    this.levelIndex = idx;
    this.worldRotationSteps = keepRotation ? this.worldRotationSteps : 0;
    this.rotateAnim = null;
    this.winAnim = null;
    this.time = 0;
    this.edgeTouchAccum = 0;
    this.jumpUsed = false;
    const layout = buildLevelLayout(idx + 1, this.W, this.H, PLAYER_SIZE, PLATFORM_HEIGHT);
    this.baseLayout = layout; // percentage-derived -> absolute built already
    this.resetAttempt();
  }

  resetAttempt() {
    // Deep copy platforms to restore red ones
    this.platforms = this.baseLayout.platforms.map(p => ({ ...p }));
    this.goal = { ...this.baseLayout.goal };
    // Player spawn near bottom-left, but not touching edges
    this.player = {
      x: this.baseLayout.spawn.x,
      y: this.baseLayout.spawn.y,
      w: PLAYER_SIZE, h: PLAYER_SIZE,
      vx: 0, vy: 0,
      onGround: false,
    };
    this.edgeTouchAccum = 0;
    this.jumpUsed = false; // resets per spec on level attempt
  }

  requestJump() {
    if (this.rotateAnim || this.winAnim) return;
    if (this.jumpUsed) return;
    if (this.player.onGround) {
      this.player.vy = -JUMP_SPEED;
      this.player.onGround = false;
      this.jumpUsed = true;
    }
  }

  requestRotate(dir) { // dir = -1 CCW, +1 CW
    if (this.rotateAnim || this.winAnim) return;
    this.rotateAnim = { dir, t: 0 };
  }

  update(dt, input) {
    this.time += dt;

    // Rotation animation pauses physics/fade timers
    if (this.rotateAnim) {
      this.rotateAnim.t += dt;
      if (this.rotateAnim.t >= ROTATE_DURATION) {
        // Commit rotation (90° step)
        this.worldRotationSteps = (this.worldRotationSteps + (this.rotateAnim.dir > 0 ? 1 : 3)) % 4;
        this.applyQuarterTurn(this.rotateAnim.dir);
        this.rotateAnim = null;
      }
      this.updateHUD();
      return;
    }

    if (this.winAnim) {
      this.winAnim.t += dt;
      if (this.winAnim.t >= 3.0) {
        const next = (this.levelIndex + 1) % 10;
        this.loadLevel(next);
      }
      this.updateHUD();
      return;
    }

    // Horizontal movement (immediate)
    const p = this.player;
    p.vx = (input.left ? -MOVE_SPEED : 0) + (input.right ? MOVE_SPEED : 0);

    // Gravity
    p.vy = Math.min(TERMINAL_VEL, p.vy + GRAVITY * dt);

    // Integrate and resolve collisions axis-by-axis
    this.moveAndCollide(p, p.vx * dt, 0);
    this.moveAndCollide(p, 0, p.vy * dt);

    // Platform fading (only time progresses when not rotating)
    const now = this.time;
    for (const plat of this.platforms) {
      if (plat.type === 'red' && plat.triggered && !plat.gone) {
        const t = now - plat.fadeStart;
        if (t >= RED_FADE_SECONDS) {
          plat.gone = true;
        } else {
          plat.opacity = 1 - (t / RED_FADE_SECONDS);
        }
      }
    }

    // Edge timer: colliding with any boundary counts as touching
    const touchingEdge = (p.x <= 0 || p.y <= 0 || (p.x + p.w) >= this.W || (p.y + p.h) >= this.H);
    if (touchingEdge) {
      this.edgeTouchAccum += dt;
      if (this.edgeTouchAccum >= EDGE_GRACE_SECONDS) {
        this.resetAttempt();
        return;
      }
    } else {
      this.edgeTouchAccum = 0;
    }

    // Win check (AABB overlap)
    if (rectsOverlap(p, this.goal)) {
      this.winAnim = { t: 0 };
    }

    this.updateHUD();
  }

  moveAndCollide(p, dx, dy) {
    // Move in axis, clamp to bounds, collide with solids (non-gone platforms)
    if (dx !== 0) {
      p.x += dx;
      // Bounds
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > this.W) p.x = this.W - p.w;
      // Platforms
      for (const plat of this.platforms) {
        if (plat.gone) continue;
        if (!rectsOverlap(p, plat)) continue;
        if (dx > 0) {
          p.x = plat.x - p.w;
        } else if (dx < 0) {
          p.x = plat.x + plat.w;
        }
      }
    }
    if (dy !== 0) {
      const wasOnGround = p.onGround;
      p.onGround = false;
      p.y += dy;
      if (p.y < 0) p.y = 0;
      if (p.y + p.h > this.H) {
        p.y = this.H - p.h;
        p.vy = 0;
        p.onGround = true;
      }
      for (const plat of this.platforms) {
        if (plat.gone) continue;
        if (!rectsOverlap(p, plat)) continue;
        if (dy > 0) {
          // landing on top
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          if (plat.type === 'red' && !plat.triggered) {
            plat.triggered = true;
            plat.fadeStart = this.time;
            plat.opacity = 1;
          }
        } else if (dy < 0) {
          // head bump
          p.y = plat.y + plat.h;
          p.vy = 0;
        }
      }
      if (!wasOnGround && p.onGround) {
        // no-op, hook for sfx
      }
    }
  }

  applyQuarterTurn(dir) {
    // Rotate world geometry (platforms, goal, player) by ±90° around screen center.
    const angle = (dir > 0) ? Math.PI / 2 : -Math.PI / 2;
    const cx = this.W / 2, cy = this.H / 2;
    const rotRect = (r) => {
      const centerX = r.x + r.w / 2;
      const centerY = r.y + r.h / 2;
      const nx = Math.cos(angle) * (centerX - cx) - Math.sin(angle) * (centerY - cy) + cx;
      const ny = Math.sin(angle) * (centerX - cx) + Math.cos(angle) * (centerY - cy) + cy;
      // 90° swap of w/h; absolute to keep positive sizes
      const nw = r.h;
      const nh = r.w;
      return { x: nx - nw / 2, y: ny - nh / 2, w: nw, h: nh };
    };
    // Platforms
    this.platforms = this.platforms.map(p => {
      const rr = rotRect(p);
      return { ...p, x: rr.x, y: rr.y, w: rr.w, h: rr.h };
    });
    // Goal
    this.goal = { ...rotRect(this.goal) };
    // Player (square -> size remains same after swap)
    const pr = rotRect(this.player);
    this.player.x = pr.x; this.player.y = pr.y;
    // velocities remain unchanged; gravity stays downward
  }

  updateHUD() {
    const L = this.levelIndex + 1;
    const edgeLeft = Math.max(0, EDGE_GRACE_SECONDS - this.edgeTouchAccum);
    this.hudEl.textContent = `Level ${L} | Jump used: ${this.jumpUsed ? 'Yes' : 'No'} | Edge timer: ${edgeLeft.toFixed(1)}s`;
  }

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Background: very light grey for better contrast
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, W, H);

    // If rotating, draw with easing-based interim rotation
    if (this.rotateAnim) {
      const t = Math.min(1, this.rotateAnim.t / ROTATE_DURATION);
      const ease = t*t*(3-2*t);
      const angle = ease * (this.rotateAnim.dir > 0 ? Math.PI/2 : -Math.PI/2);
      ctx.translate(W/2, H/2);
      ctx.rotate(angle);
      ctx.translate(-W/2, -H/2);
    }

    // If winning, zoom toward player+goal midpoint
    if (this.winAnim) {
      const t = Math.min(1, this.winAnim.t / 3.0);
      const ease = 1 + t * 1.0; // up to 2x
      const mx = (this.player.x + this.player.w/2 + this.goal.x + this.goal.w/2)/2;
      const my = (this.player.y + this.player.h/2 + this.goal.y + this.goal.h/2)/2;
      ctx.translate(mx, my);
      ctx.scale(ease, ease);
      ctx.translate(-mx, -my);
    }

    // Draw platforms
    for (const plat of this.platforms) {
      if (plat.gone) continue;
      if (plat.type === 'red') {
        ctx.save();
        const alpha = plat.opacity == null ? 1 : plat.opacity;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#d62222';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      }
    }

    // Draw goal
    ctx.fillStyle = '#ffd000';
    ctx.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);

    // Draw player
    ctx.fillStyle = '#000';
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    // Draw edge timer indicator if active
    if (this.edgeTouchAccum > 0) {
      const ratio = Math.min(1, this.edgeTouchAccum / EDGE_GRACE_SECONDS);
      ctx.fillStyle = 'rgba(214,34,34,0.6)';
      ctx.fillRect(0, 0, W * ratio, 6);
    }

    ctx.restore();
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
