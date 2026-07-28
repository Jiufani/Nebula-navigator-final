/*
  ════════════════════════════════════════════════════════════
  Nebula Navigator — game.js
  Author : Giovanni Castelblanco
  Course : ICS3U — Introduction to Computer Science

  Description:
    Standalone vanilla-JS game. All game logic lives here;
    the HTML file provides the canvas, HUD, and screen divs,
    and style.css handles all visual presentation.

  Sections:
    A. Constants
    B. DOM references
    C. Input handling (keyboard + touch)
    D. Screen management
    E. Game state initialisation
    F. Spawn helpers (asteroids, particles)
    G. Update loop  — physics, collisions, timers
    H. Draw loop    — canvas rendering
    I. HUD updater
    J. Game loop (requestAnimationFrame)
    K. Start / End helpers
    L. Boot
  ════════════════════════════════════════════════════════════
*/


/* ── A. Constants ───────────────────────────────────────── */
const MAX_TIME   = 60;    // seconds until warp gate opens
const MAX_FUEL   = 150;   // full tank — more fuel so players can dodge freely

// Fuel drain rates (per second)
// Idle is gentle; moving costs real fuel — players must commit to dodges
const FUEL_DRAIN_IDLE   = 1.5;  // drifting: empties in ~100s (never a passive threat)
const FUEL_DRAIN_MOVING = 6;    // thrusting: empties in ~25s if held constantly

// Height (px) of the HUD bar — ship is clamped below this so it never
// slides behind the fuel bar or timer (revision plan: high priority fix)
const HUD_HEIGHT = 80;

// Warp-animation duration in seconds after the 60-s timer expires
const WARP_DURATION = 3.5;


/* ── B. DOM references ──────────────────────────────────── */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// HUD elements
const elTimer      = document.getElementById('timer');
const elFuelBar    = document.getElementById('fuel-bar');
const elFuelBarBg  = document.getElementById('fuel-bar-bg');   // aria progressbar
const elLowFuel    = document.getElementById('low-fuel-warning');
const elLevel      = document.getElementById('level-display');
const elScore      = document.getElementById('score-display');
const elHud        = document.getElementById('hud');
const elMobile     = document.getElementById('mobile-controls');

// Overlay screens
const elScreenTitle  = document.getElementById('screen-title');
const elScreenInstr  = document.getElementById('screen-instructions');
const elScreenWin    = document.getElementById('screen-win');
const elScreenLose   = document.getElementById('screen-lose');
const elScreenCred   = document.getElementById('screen-credits');

// Result screen value displays
const elWinTime      = document.getElementById('win-time');
const elWinScore     = document.getElementById('win-score');
const elWinHighMsg   = document.getElementById('win-highscore-msg');
const elLoseTime     = document.getElementById('lose-time');
const elLoseScore    = document.getElementById('lose-score');
const elLoseHighMsg  = document.getElementById('lose-highscore-msg');

// Title high-score readout
const elTitleHS = document.getElementById('title-highscore');


/* ── C. Input handling ──────────────────────────────────── */

// Keyboard state — true while the key is held down
const keys = { up: false, down: false };

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') keys.up   = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') keys.up   = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
});

// Touch state — set by the on-screen arrow buttons
const touch = { up: false, down: false };

const btnUp   = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');

// Use pointer events so both mouse and touch work correctly
btnUp.addEventListener('pointerdown',   () => { touch.up   = true;  });
btnUp.addEventListener('pointerup',     () => { touch.up   = false; });
btnUp.addEventListener('pointercancel', () => { touch.up   = false; });
btnDown.addEventListener('pointerdown',   () => { touch.down = true;  });
btnDown.addEventListener('pointerup',     () => { touch.down = false; });
btnDown.addEventListener('pointercancel', () => { touch.down = false; });


/* ── D. Screen management ───────────────────────────────── */

// Map of screen name → DOM element for easy lookup
const screenMap = {
  title:        elScreenTitle,
  instructions: elScreenInstr,
  win:          elScreenWin,
  lose:         elScreenLose,
  credits:      elScreenCred,
};

let currentScreen = 'title'; // tracks which overlay is active
let highScore = parseInt(localStorage.getItem('nebula_highscore') || '0', 10);

// Show one named overlay and hide everything else
function showScreen(name) {
  currentScreen = name;

  // Hide every overlay screen
  Object.values(screenMap).forEach(el => el.classList.add('hidden'));
  elHud.classList.add('hidden');
  elMobile.classList.add('hidden');

  if (name === 'playing') {
    // Show HUD; show touch buttons only on narrow viewports
    elHud.classList.remove('hidden');
    if (window.matchMedia('(max-width: 767px)').matches) {
      elMobile.classList.remove('hidden');
    }
    startGame();
  } else if (screenMap[name]) {
    screenMap[name].classList.remove('hidden');
    // Move focus into the newly shown screen for keyboard accessibility
    const firstBtn = screenMap[name].querySelector('button');
    if (firstBtn) firstBtn.focus();
  }
}

// Pad a number with leading zeros to a fixed width (e.g. pad(7,5) → "00007")
function pad(n, len) {
  return n.toString().padStart(len, '0');
}

// Keep the title-screen high score display in sync with localStorage
function refreshTitleScore() {
  elTitleHS.textContent = pad(highScore, 5);
}
refreshTitleScore();

// ── Button event listeners ─────────────────────────────────
document.getElementById('btn-start').addEventListener('click',        () => showScreen('playing'));
document.getElementById('btn-instructions').addEventListener('click', () => showScreen('instructions'));
document.getElementById('btn-acknowledge').addEventListener('click',  () => showScreen('title'));
document.getElementById('btn-credits').addEventListener('click',      () => showScreen('credits'));
document.getElementById('btn-credits-back').addEventListener('click', () => showScreen('title'));
document.getElementById('btn-win-again').addEventListener('click',    () => showScreen('playing'));
document.getElementById('btn-win-title').addEventListener('click',    () => showScreen('title'));
document.getElementById('btn-lose-again').addEventListener('click',   () => showScreen('playing'));
document.getElementById('btn-lose-title').addEventListener('click',   () => showScreen('title'));


/* ── E. Game-state initialisation ───────────────────────── */

// All live game data lives in this object, reset fresh each play
let gs = null;  // gs = "game state"
let rafId = null;

// Canvas sizing — called on load and on every resize event
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initGame() {
  const w = canvas.width;
  const h = canvas.height;

  // Generate background star field
  const stars = [];
  for (let i = 0; i < 160; i++) {
    stars.push({
      x:          Math.random() * w,
      y:          Math.random() * h,
      size:       Math.random() * 2 + 0.4,
      speed:      Math.random() * 0.5 + 0.1,
      brightness: 0.3 + Math.random() * 0.7,
    });
  }

  gs = {
    ship: {
      y:              h / 2,  // vertical position (x is fixed at 10% of width)
      vy:             0,      // vertical velocity
      radius:         15,     // collision / drawing radius
      flameIntensity: 0,      // 0–1, drives engine flame animation
    },
    asteroids:       [],
    stars,
    particles:       [],    // explosion + trail particles
    warpStreaks:     [],    // warp-tunnel streak lines (used during warp phase)
    fuel:            MAX_FUEL,
    timeRemaining:   MAX_TIME,
    difficultyLevel: 1,
    score:           0,
    multiplier:      1,
    lastTime:        performance.now(),
    flashOpacity:    0,    // full-screen flash when level increases
    warpPhase:       false,
    gameOver:        false,
  };
}


/* ── F. Spawn helpers ───────────────────────────────────── */

// Create a new asteroid off the right edge with jagged polygon vertices
function spawnAsteroid(level) {
  const w = canvas.width;
  const h = canvas.height;

  const baseRadius  = 20 + Math.random() * 30;
  const numVertices = 7 + Math.floor(Math.random() * 5);
  const vertices    = [];

  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * Math.PI * 2;
    const r     = baseRadius * (0.65 + Math.random() * 0.35);
    vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }

  gs.asteroids.push({
    x:        w + baseRadius + 10,
    y:        Math.random() * h,
    vx:       -(5 + level * 1.4 + Math.random() * 3),
    radius:   baseRadius,
    vertices,
    rot:      Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.06,
    passed:   false,   // true once the asteroid passes the ship (for scoring)
  });
}

// Spawn a burst of particles at (x, y) — used for explosions
function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 1;
    gs.particles.push({
      x, y,
      vx:      Math.cos(angle) * speed,
      vy:      Math.sin(angle) * speed,
      life:    0,
      maxLife: 30 + Math.random() * 30,
      color,
      size:    Math.random() * 3 + 1,
    });
  }
}

// Spawn a single engine-trail particle behind the ship
function spawnTrail(x, y) {
  gs.particles.push({
    x, y,
    vx:      -Math.random() * 3 - 2,
    vy:      (Math.random() - 0.5) * 1.2,
    life:    0,
    maxLife: 12 + Math.random() * 14,
    color:   '#00f0ff',
    size:    Math.random() * 2.5 + 1,
  });
}

// Initialise the warp-tunnel streaks that animate at end of round
function initWarpStreaks() {
  const w = canvas.width;
  const h = canvas.height;
  gs.warpStreaks = [];
  for (let i = 0; i < 80; i++) {
    gs.warpStreaks.push({
      x:     Math.random() * w,
      y:     Math.random() * h,
      len:   Math.random() * 80 + 20,
      speed: Math.random() * 18 + 10,
      alpha: Math.random() * 0.7 + 0.3,
    });
  }
}


/* ── G. Update loop ─────────────────────────────────────── */

function update(time) {
  if (!gs || gs.gameOver) return;

  // dt = seconds elapsed since last frame; capped to avoid huge jumps after tab-switch
  const dt = Math.min((time - gs.lastTime) / 1000, 0.05);
  gs.lastTime = time;

  // ts = time-scale factor for frame-rate independent movement
  const ts = dt * 60;

  const w = canvas.width;
  const h = canvas.height;

  // ── Timer countdown ─────────────────────────────────────
  gs.timeRemaining -= dt;

  // When the timer reaches 0, switch to the warp-phase
  if (!gs.warpPhase && gs.timeRemaining <= 0) {
    gs.timeRemaining = 0;
    gs.warpPhase     = true;
    initWarpStreaks();
  }

  // After WARP_DURATION seconds of warp animation, trigger the win state
  if (gs.warpPhase && gs.timeRemaining < -WARP_DURATION) {
    endGame(true);
    return;
  }

  // ── Ship movement ────────────────────────────────────────
  const movingUp   = keys.up   || touch.up;
  const movingDown = keys.down || touch.down;

  if (!gs.warpPhase) {
    // Apply acceleration in the pressed direction
    const ACCEL    = 0.5;
    const FRICTION = 0.92;
    if (movingUp)   gs.ship.vy -= ACCEL * ts;
    if (movingDown) gs.ship.vy += ACCEL * ts;
    gs.ship.vy *= Math.pow(FRICTION, ts);
    gs.ship.y  += gs.ship.vy * ts;

    // Clamp ship within the playfield:
    //   • Top edge: ship must stay below HUD bar (revision plan fix)
    //   • Bottom edge: ship must stay above the bottom border
    const topClamp    = HUD_HEIGHT + gs.ship.radius;
    const bottomClamp = h - gs.ship.radius - 10;
    if (gs.ship.y < topClamp)    { gs.ship.y = topClamp;    gs.ship.vy = 0; }
    if (gs.ship.y > bottomClamp) { gs.ship.y = bottomClamp; gs.ship.vy = 0; }

  } else {
    // During warp phase the ship glides to vertical centre and accelerates right
    gs.ship.y  += (h / 2 - gs.ship.y) * 0.06;
    gs.ship.vy  = 0;
  }

  // ── Engine flame intensity ───────────────────────────────
  const targetFlame = (movingUp || movingDown) ? 1 : 0.25;
  gs.ship.flameIntensity += (targetFlame - gs.ship.flameIntensity) * 0.18;
  if (Math.random() < gs.ship.flameIntensity * 0.5) {
    spawnTrail(w * 0.1 - 22, gs.ship.y + (Math.random() - 0.5) * 4);
  }

  // ── Fuel consumption (only during normal play) ───────────
  // Revision plan: fuel must feel threatening — rebalanced drain rates
  if (!gs.warpPhase) {
    const drain = (movingUp || movingDown) ? FUEL_DRAIN_MOVING : FUEL_DRAIN_IDLE;
    gs.fuel -= drain * dt;

    if (gs.fuel <= 0) {
      // Ship ran out of fuel — stranded in space
      gs.fuel = 0;
      endGame(false);
      return;
    }
  }

  // ── Difficulty scaling — increase level every 10 seconds ─
  if (!gs.warpPhase) {
    const targetLevel = Math.floor((MAX_TIME - gs.timeRemaining) / 10) + 1;
    if (targetLevel > gs.difficultyLevel) {
      gs.difficultyLevel = targetLevel;
      gs.multiplier      = targetLevel;
      gs.flashOpacity    = 1;  // triggers full-screen flash in draw()
    }
  }

  // Fade out the level-up flash each frame
  if (gs.flashOpacity > 0) {
    gs.flashOpacity -= 0.025 * ts;
    if (gs.flashOpacity < 0) gs.flashOpacity = 0;
  }

  // ── Star scroll ──────────────────────────────────────────
  const starMultiplier = gs.warpPhase ? 12 : 1;
  gs.stars.forEach(star => {
    star.x -= star.speed * starMultiplier * ts;
    if (star.x < 0) {
      star.x = w;
      star.y = Math.random() * h;
    }
  });

  // ── Asteroid spawning ────────────────────────────────────
  if (!gs.warpPhase) {
    // Spawn chance rises aggressively with difficulty level
    const spawnChance = 0.035 + gs.difficultyLevel * 0.012;
    if (Math.random() < spawnChance * ts) {
      spawnAsteroid(gs.difficultyLevel);
    }
  }

  // ── Asteroid movement & collision ────────────────────────
  const shipX = w * 0.1;  // ship is pinned to 10% across the canvas

  for (let i = gs.asteroids.length - 1; i >= 0; i--) {
    const ast = gs.asteroids[i];
    ast.x   += ast.vx * ts;
    ast.rot += ast.rotSpeed * ts;

    // Score a point (multiplied by level) when an asteroid passes the ship
    if (!ast.passed && ast.x < shipX) {
      ast.passed = true;
      gs.score  += 1 * gs.multiplier;
    }

    // Collision detection — circle vs circle (only during normal play)
    if (!gs.warpPhase) {
      const dx   = ast.x - shipX;
      const dy   = ast.y - gs.ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < gs.ship.radius + ast.radius - 6) {
        // Hit! Spawn particle bursts then end the round
        spawnExplosion(shipX, gs.ship.y, '#00f0ff', 32);
        spawnExplosion(ast.x, ast.y,   '#b026ff', 20);
        endGame(false);
        return;
      }
    }

    // Remove asteroids that have scrolled fully off the left edge
    if (ast.x < -ast.radius * 2) {
      gs.asteroids.splice(i, 1);
    }
  }

  // ── Particle update (trail + explosions) ─────────────────
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.x    += p.vx * ts;
    p.y    += p.vy * ts;
    p.life += ts;
    if (p.life >= p.maxLife) {
      gs.particles.splice(i, 1);
    }
  }

  // ── Warp streak update ───────────────────────────────────
  if (gs.warpPhase) {
    gs.warpStreaks.forEach(s => {
      s.x -= s.speed * ts;
      if (s.x + s.len < 0) {
        // Reset streak to the right edge for a seamless loop
        s.x     = w + s.len;
        s.y     = Math.random() * h;
        s.speed = Math.random() * 18 + 10;
        s.alpha = Math.random() * 0.7 + 0.3;
        s.len   = Math.random() * 80 + 20;
      }
    });
  }

  // ── Sync HUD display ─────────────────────────────────────
  updateHUD();
}


/* ── H. Draw loop ───────────────────────────────────────── */

function draw() {
  if (!gs) return;

  const w = canvas.width;
  const h = canvas.height;

  // Background fill
  ctx.fillStyle = '#05020a';
  ctx.fillRect(0, 0, w, h);

  // ── Stars ─────────────────────────────────────────────────
  gs.stars.forEach(star => {
    ctx.fillStyle = `rgba(255,255,255,${star.brightness})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Warp-tunnel streaks (revision plan: proper warp animation) ─
  if (gs.warpPhase) {
    // Blue-purple vignette to sell the warp-tunnel feel
    const cx = w / 2;
    const cy = h / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(176,38,255,0.25)');
    grad.addColorStop(1, 'rgba(0,240,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Horizontal speed-streak lines
    gs.warpStreaks.forEach(s => {
      const color = Math.random() > 0.5 ? '0,240,255' : '176,38,255';
      ctx.strokeStyle = `rgba(${color},${s.alpha})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.len, s.y);
      ctx.stroke();
    });

    // "WARPING" message so players know they've succeeded (revision plan fix)
    const warpProgress = Math.min(1, -gs.timeRemaining / WARP_DURATION);
    const msgAlpha     = Math.min(1, warpProgress * 3);
    ctx.font         = `bold clamp(24px,4vw,40px) Orbitron, monospace`;
    ctx.font         = `bold ${Math.round(w * 0.035 + 20)}px Orbitron, monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = `rgba(0,240,255,${msgAlpha})`;
    ctx.shadowBlur   = 20;
    ctx.shadowColor  = '#00f0ff';
    ctx.fillText('WARPING TO SAFETY…', w / 2, h * 0.18);
    ctx.shadowBlur   = 0;
  }

  // ── Particles ─────────────────────────────────────────────
  gs.particles.forEach(p => {
    const alpha = 1 - p.life / p.maxLife;
    const isBlue = p.color === '#00f0ff';
    ctx.fillStyle = isBlue
      ? `rgba(0,240,255,${alpha})`
      : `rgba(176,38,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Asteroids ─────────────────────────────────────────────
  gs.asteroids.forEach(ast => {
    ctx.save();
    ctx.translate(ast.x, ast.y);
    ctx.rotate(ast.rot);
    ctx.shadowBlur  = 14;
    ctx.shadowColor = 'rgba(176,38,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(ast.vertices[0].x, ast.vertices[0].y);
    for (let i = 1; i < ast.vertices.length; i++) {
      ctx.lineTo(ast.vertices[i].x, ast.vertices[i].y);
    }
    ctx.closePath();
    ctx.fillStyle   = '#0a0515';
    ctx.fill();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#b026ff';
    ctx.stroke();
    ctx.restore();
  });

  // ── Ship ──────────────────────────────────────────────────
  const shipX = w * 0.1;
  ctx.save();
  ctx.translate(shipX, gs.ship.y);

  // During warp phase the ship slides toward the centre of the screen
  if (gs.warpPhase) {
    const progress = Math.min(1, Math.max(0, -gs.timeRemaining / WARP_DURATION));
    ctx.translate((w / 2 - shipX) * progress * progress, 0);
  }

  // Tilt ship slightly in the direction it's moving
  ctx.rotate(gs.ship.vy * 0.045);

  // Engine flame — length/brightness varies with flameIntensity
  ctx.beginPath();
  ctx.moveTo(-16, -5);
  ctx.lineTo(-16 - (14 * gs.ship.flameIntensity + Math.random() * 6), 0);
  ctx.lineTo(-16, 5);
  ctx.closePath();
  ctx.fillStyle   = '#ff007f';
  ctx.shadowBlur  = 22;
  ctx.shadowColor = '#ff007f';
  ctx.fill();
  ctx.shadowBlur  = 0;

  // Ship hull
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-16, 13);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-16, -13);
  ctx.closePath();
  ctx.fillStyle   = '#0a0515';
  ctx.shadowBlur  = 14;
  ctx.shadowColor = '#00f0ff';
  ctx.fill();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = '#00f0ff';
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Cockpit window
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10, 0);
  ctx.lineTo(5, -4);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,240,255,0.45)';
  ctx.fill();

  ctx.restore();

  // ── Level-up flash overlay ────────────────────────────────
  // Flashes white + level text when the difficulty increases
  if (gs.flashOpacity > 0) {
    ctx.fillStyle = `rgba(255,255,255,${gs.flashOpacity * 0.25})`;
    ctx.fillRect(0, 0, w, h);

    const fontSize = Math.round(w * 0.04 + 24);
    ctx.font         = `900 ${fontSize}px Orbitron, monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = `rgba(0,240,255,${gs.flashOpacity})`;
    ctx.shadowBlur   = 20;
    ctx.shadowColor  = '#00f0ff';
    ctx.fillText(`LEVEL ${gs.difficultyLevel}`, w / 2, h / 2);
    ctx.shadowBlur   = 0;
  }
}


/* ── I. HUD updater ─────────────────────────────────────── */

// Called every frame during gameplay to keep HUD values current
function updateHUD() {
  if (!gs) return;

  // ── Fuel bar ─────────────────────────────────────────────
  const fuelPct = Math.max(0, (gs.fuel / MAX_FUEL) * 100);
  elFuelBar.style.width = fuelPct + '%';

  // Update aria attribute so screen readers get the correct value
  elFuelBarBg.setAttribute('aria-valuenow', Math.round(fuelPct));

  // Revision plan: pulsing critical-fuel warning below 30%
  const isCritical = fuelPct < 30;
  elFuelBar.classList.toggle('critical', isCritical);
  elLowFuel.classList.toggle('hidden',  !isCritical);

  // ── Timer ────────────────────────────────────────────────
  if (gs.warpPhase) {
    elTimer.textContent = '00';
    elTimer.classList.add('urgent');
  } else {
    const secs = Math.max(0, Math.ceil(gs.timeRemaining));
    elTimer.textContent = secs.toString().padStart(2, '0');
    // Flash red in the final 10 seconds
    elTimer.classList.toggle('urgent', secs <= 10);
  }

  // ── Score & level ────────────────────────────────────────
  elScore.textContent = pad(gs.score, 5);
  elLevel.textContent = `LEVEL ${pad(gs.difficultyLevel, 2)}`;
}


/* ── J. Game loop ───────────────────────────────────────── */

// Main loop — called by the browser at (ideally) 60 fps
function gameLoop(time) {
  if (currentScreen !== 'playing') return;
  update(time);
  draw();
  rafId = requestAnimationFrame(gameLoop);
}


/* ── K. Start / End helpers ─────────────────────────────── */

function startGame() {
  // Cancel any running loop from a previous game first
  cancelAnimationFrame(rafId);
  initGame();
  rafId = requestAnimationFrame(gameLoop);
}

function endGame(won) {
  // Guard against being called twice (e.g., collision + out-of-bounds in same frame)
  if (!gs || gs.gameOver) return;
  gs.gameOver = true;
  cancelAnimationFrame(rafId);

  // Compute final stats
  const finalScore = gs.score;
  const finalTime  = (MAX_TIME - Math.max(0, gs.timeRemaining)).toFixed(1);

  // Check and persist high score
  const isNewHigh = finalScore > highScore;
  if (isNewHigh) {
    highScore = finalScore;
    localStorage.setItem('nebula_highscore', highScore.toString());
    refreshTitleScore();
  }

  if (won) {
    elWinTime.textContent  = finalTime + 's';
    elWinScore.textContent = finalScore;
    elWinHighMsg.classList.toggle('hidden', !isNewHigh);
    showScreen('win');
  } else {
    elLoseTime.textContent  = finalTime + 's';
    elLoseScore.textContent = finalScore;
    elLoseHighMsg.classList.toggle('hidden', !isNewHigh);
    showScreen('lose');
  }
}


/* ── L. Boot ────────────────────────────────────────────── */
// Show the title screen when the page first loads
showScreen('title');
