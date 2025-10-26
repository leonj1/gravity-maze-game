# Gravity Maze (Web 2D)

A web-based 2D puzzle-platformer built with Canvas and vanilla JavaScript.

Core rules implemented from the spec:
- 10 levels; each level is one screen (no scrolling)
- Player is a black 150×150 px square; goal is a yellow 150×150 px square
- Platforms are axis-aligned rectangles. Black = permanent; Red = fades over 5 s after first contact, then disappears (until level restart)
- Platform size: width = 5% of viewport width; height = 50% of player size (75 px)
- Gravity always points downward (screen space). The world rotates in 90° steps with a 700 ms animation
- One jump per level attempt (resets only on restart/next level)
- Touching any screen edge starts a 3 s death timer (resets immediately when fully off the edges)
- Win: touching the yellow square triggers a 3 s zoom-in, then advances to the next level

Controls (desktop):
- Left/Right Arrow: move
- Up Arrow: jump (consumes the one jump for this level attempt)
- Q / E: rotate world 90° CCW / CW (animated 700 ms)

Controls (mobile):
- Rotate the device 90° to rotate the world to match the device orientation (when supported).
- On-screen buttons appear on touch devices:
  - Bottom-left: Left, Right, Jump
  - Bottom-right: Rotate CCW/CW

Notes
- Physics are paused during the rotation animation to keep axis-aligned collision. Red-platform fading also pauses during rotation.
- If you’d like physics to continue during rotation (harder), or different keys, say the word and I’ll adjust.

Dev
- No build step; open `index.html` in a browser.
- Files: `index.html`, `src/main.js`, `src/game.js`, `src/levels.js`, `style.css`.

Known design caveat
- With player = 150 px and platform width = 5% of viewport width, on small screens platforms may be narrower than the player. This is per spec; we can increase width (e.g., 15–25%) or scale player by viewport if you prefer.

## Deploy (Netlify)

This repo includes a `netlify.toml` configured for a static site:

- Publish directory: `.` (repo root)
- No build command
- Revalidate for `/src/*.js` and `style.css` (no fingerprinting)
- No-cache for HTML

Deploy options:

- Netlify UI: New site from Git → select this repo → set Publish directory to `.` and leave Build command empty.
- Netlify CLI: `npm i -g netlify-cli` then:
  - `netlify deploy --dir=.` (preview)
  - `netlify deploy --prod --dir=.` (production)
