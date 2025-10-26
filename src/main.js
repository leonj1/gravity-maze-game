import { Game } from './game.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const btnCW = document.getElementById('btn-cw');
const btnCCW = document.getElementById('btn-ccw');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');

function fitCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

let { w, h } = fitCanvas();
const game = new Game(canvas, hud);

window.addEventListener('resize', () => {
  const dims = fitCanvas();
  w = dims.w; h = dims.h;
  game.handleResize(w, h);
});

// Keyboard controls
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyQ','KeyE'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'ArrowUp' || e.code === 'Space') game.requestJump();
  if (e.code === 'KeyQ') game.requestRotate(-1); // CCW
  if (e.code === 'KeyE') game.requestRotate(+1); // CW
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

btnCW.addEventListener('click', () => game.requestRotate(+1));
btnCCW.addEventListener('click', () => game.requestRotate(-1));

// Touch controls (mobile)
const touch = { left: false, right: false };
function bindHold(btn, setFlag) {
  if (!btn) return;
  const down = (e) => { e.preventDefault(); setFlag(true); btn.setPointerCapture?.(e.pointerId); };
  const up = (e) => { e.preventDefault(); setFlag(false); };
  btn.addEventListener('pointerdown', down, { passive: false });
  btn.addEventListener('pointerup', up, { passive: false });
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointerout', up);
}
bindHold(btnLeft, (v) => (touch.left = v));
bindHold(btnRight, (v) => (touch.right = v));
if (btnJump) {
  btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); game.requestJump(); }, { passive: false });
}

// Mobile orientation: rotate world when device orientation changes by ~90°.
let lastScreenAngle = (screen.orientation && screen.orientation.angle) || 0;
window.addEventListener('orientationchange', () => {
  const ang = (screen.orientation && screen.orientation.angle) || 0;
  let delta = ((ang - lastScreenAngle + 540) % 360) - 180; // normalize to [-180,180]
  if (Math.abs(Math.abs(delta) - 90) < 5) {
    game.requestRotate(delta > 0 ? +1 : -1);
  }
  lastScreenAngle = ang;
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const input = {
    left: keys.has('ArrowLeft') || touch.left,
    right: keys.has('ArrowRight') || touch.right,
  };
  game.update(dt, input);
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
