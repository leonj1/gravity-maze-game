export function buildLevelLayout(levelNumber, W, H, PLAYER_SIZE, PLATFORM_HEIGHT) {
  const PLATFORM_WIDTH = Math.max(8, Math.round(W * 0.05));
  const margin = Math.max(16, Math.round(PLAYER_SIZE * 0.2));

  let blacks = 3, reds = 0, total = 3;
  if (levelNumber === 1) {
    blacks = 3; reds = 0; total = 3;
  } else if (levelNumber === 2) {
    blacks = 3; reds = 2; total = 5;
  } else {
    total = Math.min(9, 6 + (levelNumber - 3)); // 6..9
    reds = Math.min(total - 2, 2 + levelNumber); // increasing reds
    blacks = total - reds;
  }

  // Difficulty: bring platforms closer by shrinking step sizes as level increases
  const stepX = Math.max(PLATFORM_WIDTH * 2, Math.round((W - 2 * margin) / (total + 3 + levelNumber)));
  const stepY = Math.max(PLATFORM_HEIGHT * 1.1, Math.round((H - 2 * margin - PLAYER_SIZE) / (total + 3 + Math.floor(levelNumber / 2))));

  const platforms = [];
  let x = margin;
  let y = H - margin - PLATFORM_HEIGHT - PLAYER_SIZE * 0.5; // first platform near bottom but not touching edge
  for (let i = 0; i < total; i++) {
    const type = i < blacks ? 'black' : 'red';
    platforms.push({
      x: clamp(x, margin, W - margin - PLATFORM_WIDTH),
      y: clamp(y, margin, H - margin - PLATFORM_HEIGHT),
      w: PLATFORM_WIDTH,
      h: PLATFORM_HEIGHT,
      type,
      triggered: false,
      opacity: 1,
      gone: false,
    });
    // Zig-zag upward to the right, then slightly left, with smaller spacing as it goes
    const dir = (i % 2 === 0) ? 1 : 0.6; // slight left on odd steps
    x += Math.round(stepX * dir);
    y -= Math.round(stepY);
  }

  // Ensure at least first three are black for levels >= 2 per spirit of spec
  if (levelNumber >= 2) {
    for (let i = 0; i < Math.min(3, platforms.length); i++) platforms[i].type = 'black';
  }

  // Spawn on the first platform top-center
  const first = platforms[0];
  const spawn = {
    x: Math.round(first.x + first.w / 2 - PLAYER_SIZE / 2),
    y: Math.round(first.y - PLAYER_SIZE - 1),
  };

  // Goal somewhere in the right-right quadrant but not hugging edges
  const goalSize = PLAYER_SIZE; // same size
  const gx = clamp(Math.round(W * 0.78), margin, W - margin - goalSize);
  const gy = clamp(Math.round(H * (levelNumber % 2 ? 0.38 : 0.48)), margin, H - margin - goalSize);
  const goal = { x: gx, y: gy, w: goalSize, h: goalSize };

  return { platforms, spawn, goal };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

