// Global Variables and Game Constants
let globalHighScore = 0;
let redorangeInvincibilityUntil = 0;
let pinkPowerupEndTime = 0; // Pink powerup active time
let brownPowerupEndTime = 0; // Brown powerup active time
let whitePowerupEndTime = 0; // White powerup active time (new)

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageDiv = document.getElementById("message");
const retryButton = document.getElementById("retryButton");
const startMenu = document.getElementById("startMenu");
const startButton = document.getElementById("startButton");
const tutorialToggle = document.getElementById("tutorialToggle");
const tutorialGuide = document.getElementById("tutorialGuide");
const tabPowerup = document.getElementById("tabPowerup");
const tabPlatform = document.getElementById("tabPlatform");
const contentPowerup = document.getElementById("contentPowerup");
const contentPlatform = document.getElementById("contentPlatform");
const backgroundMusic = document.getElementById("backgroundMusic");

// Powerup durations and multipliers
const PINK_DURATION = 5000;  // 5 seconds
const BROWN_DURATION = 5000; // 5 seconds
const WHITE_DURATION = 10000; // 10 seconds for white powerup

// Helper: returns 2 if pink powerup active, else 1.
const pinkMultiplier = () => performance.now() < pinkPowerupEndTime ? 2 : 1;
// Helper: returns true if brown powerup is active.
const isBrownActive = () => performance.now() < brownPowerupEndTime;

// Game constants (base values)
const GRAVITY = 0.5;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 5;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 10;
const baseJumpStrength = -12;
const boostedJumpStrength = -16;
const HUGE_JUMP_STRENGTH = -40;
let jumpBoostEndTime = 0;

// For Brown powerup: reduce jump strength and increase gravity.
const BROWN_JUMP_MULTIPLIER = 0.75;  // lighter jump
const BROWN_GRAVITY_MULTIPLIER = 1.25; // heavier

// Lava settings
let baseLavaSpeed = 0.3;
const maxLavaSpeed = 0.6;
const lavaSpeedIncrement = 0.05;
let lastLavaIncreaseTime = performance.now();
let lavaSlowEndTime = 0;  // green powerup duration
const lavaSlowFactor = 0.5;  // slows speeds when active

// Lava projectile settings
let lavaProjectiles = [];
let lastProjectileSpawnTime = performance.now();
const projectileSpawnInterval = 2000; // every 2 seconds
const projectileSize = 10;

// Smooth lava teleport transition variables
let lavaTargetY = 0;
let lavaTransitionStart = null;
let lavaStartY = 0;
const lavaTransitionDuration = 800; // in ms

// Score and Camera
let baseY = 0;
let maxScore = 0;
let cameraOffset = 0;
let lavaY = 0;
let highestPlatformY = 0;

// Player Object
let player = {
  x: 0,
  y: 0,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  vx: 0,
  vy: 0
};

// Spike Event & Cover Settings
const coverWidth = 20;
const spikeWidth = 20;
const spikeHeight = 20;
const verticalSpikeSpeed = 0.5;
const maxLunge = 140 - coverWidth; // maximum lunge distance

// Durations (in ms) for spike event phases
const warningDuration = 2000;
const strikeDuration = 200;
const retractDuration = 300;

// Spike event state variables
let spikeEventState = "idle";
let spikeEventTime = performance.now() + getRandomIdleInterval();
let spikeStrikeSides = { left: false, right: false };
let strikeStartTime = 0;
let retractStartTime = 0;
let leftSpikeVerticalOffset = 0;
let rightSpikeVerticalOffset = 0;
let spikeImmunityUntil = 0; // For cyan powerup immunity

// Variables for jump physics enhancements
let jumpKeyHeld = false;
let jumpStartTime = 0;

// Easing functions for animations
function easeOutQuad(t) {
  return t * (2 - t);
}
function easeInQuad(t) {
  return t * t;
}
function getRandomIdleInterval() {
  return 3000 + Math.random() * 2000;
}

// --- UI and Tutorial Setup ---
document.addEventListener("DOMContentLoaded", function() {
  startButton.addEventListener("click", function() {
    startMenu.style.display = "none";
    tutorialToggle.style.display = "none";
    tutorialGuide.style.display = "none";
    backgroundMusic.play().catch(error => console.error("Playback error:", error));
    resetGame();
  });
});

tutorialToggle.addEventListener("click", function() {
  tutorialGuide.style.display = (tutorialGuide.style.display === "none" || tutorialGuide.style.display === "") ? "block" : "none";
});
tabPowerup.addEventListener("click", function() {
  contentPowerup.style.display = "block";
  contentPlatform.style.display = "none";
});
tabPlatform.addEventListener("click", function() {
  contentPowerup.style.display = "none";
  contentPlatform.style.display = "block";
});

// --- Platform Generation ---
let platforms = [];
function createPlatform(x, y) {
  let platform = {
    x: x,
    y: y,
    width: PLATFORM_WIDTH,
    height: PLATFORM_HEIGHT,
    moving: false,
    disappearing: false,
    disappearStartTime: null,
    powerup: null,
    ghost: false // ghost platform flag
  };
  let movingChance = globalHighScore >= 3000 ? 0.5 : 0.3;
  let disappearingChance = globalHighScore >= 3000 ? 0.4 : 0.2;
  if (Math.random() < movingChance) {
    platform.moving = true;
    platform.moveSpeed = 1 + Math.random();
    platform.direction = Math.random() < 0.5 ? 1 : -1;
    platform.minX = Math.max(0, platform.x - 30);
    platform.maxX = Math.min(canvas.width - PLATFORM_WIDTH, platform.x + 30);
  }
  if (Math.random() < disappearingChance) {
    platform.disappearing = true;
  }
  // Powerup assignment with adjusted probabilities
  if (Math.random() < 0.2) {
    let r = Math.random();
    // Out of the 20% chance, 5% (i.e. overall 1%) will be the white powerup.
    if (r < 0.05) {
      platform.powerup = { type: "white", collected: false };
    } else {
      // Scale remaining thresholds by 0.95 to fill 95% of probability
      // Original thresholds:
      // jump: 0.125, lava: 0.125, red: 0.125, orange: 0.125, redorange: 0.075, cyan: 0.075, purple: 0.1, darkblue: 0.05, pink: 0.1, brown: 0.1
      if (r < 0.05 + 0.125 * 0.95) { // jump
        platform.powerup = { type: "jump", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 2) { // lava
        platform.powerup = { type: "lava", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 3) { // red
        platform.powerup = { type: "red", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4) { // orange
        platform.powerup = { type: "orange", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95) { // redorange
        platform.powerup = { type: "redorange", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2) { // cyan
        platform.powerup = { type: "cyan", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95) { // purple
        platform.powerup = { type: "purple", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95 + 0.05 * 0.95) { // darkblue
        platform.powerup = { type: "darkblue", collected: false };
      } else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95 + 0.05 * 0.95 + 0.1 * 0.95) { // pink
        platform.powerup = { type: "pink", collected: false };
      } else { // brown
        platform.powerup = { type: "brown", collected: false };
      }
    }
  }
  // Chance to create ghost platform
  if (Math.random() < 0.1) {
    platform.ghost = true;
    platform.disappearing = true;
  }
  return platform;
}

function generateInitialPlatforms() {
  platforms = [];
  let startPlatformY = 580;
  let startPlatformX = canvas.width / 2 - PLATFORM_WIDTH / 2;
  let spawnPlatform = {
    x: startPlatformX,
    y: startPlatformY,
    width: PLATFORM_WIDTH,
    height: PLATFORM_HEIGHT,
    moving: false,
    disappearing: false,
    disappearStartTime: null,
    powerup: null,
    ghost: false
  };
  platforms.push(spawnPlatform);
  highestPlatformY = startPlatformY;
  for (let i = 0; i < 15; i++) {
    let gapY = 30 + Math.random() * 40;
    let newY = highestPlatformY - gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
    highestPlatformY = newY;
  }
}

function generatePlatformsIfNeeded() {
  while (highestPlatformY > cameraOffset - 100) {
    let gapY = 30 + Math.random() * 40;
    let newY = highestPlatformY - gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
    highestPlatformY = newY;
  }
}

// --- Teleport for Purple Powerup ---
function teleportPlayerUpwards(currentPlatform) {
  let platformsAbove = platforms.filter(p => p.y < currentPlatform.y);
  if (platformsAbove.length === 0) return;
  platformsAbove.sort((a, b) => b.y - a.y);
  let targetIndex = 6;
  while (targetIndex < platformsAbove.length && platformsAbove[targetIndex].powerup && !platformsAbove[targetIndex].powerup.collected) {
    targetIndex++;
  }
  let targetPlatform = targetIndex < platformsAbove.length ? platformsAbove[targetIndex] : platformsAbove[platformsAbove.length - 1];
  if (targetPlatform) {
    player.x = targetPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
    player.y = targetPlatform.y - PLAYER_HEIGHT;
    cameraOffset = player.y - canvas.height / 2;
    console.log("Teleported to platform at y:", targetPlatform.y);
  }
}

// --- Reset Game ---
function resetGame() {
  gameOver = false;
  messageDiv.innerText = "";
  retryButton.style.display = "none";
  baseLavaSpeed = 0.3;
  lastLavaIncreaseTime = performance.now();
  lavaSlowEndTime = 0;
  jumpBoostEndTime = 0;
  spikeImmunityUntil = 0;
  redorangeInvincibilityUntil = 0;
  pinkPowerupEndTime = 0;
  brownPowerupEndTime = 0;
  whitePowerupEndTime = 0;
  lavaProjectiles = [];
  lavaTransitionStart = null;
  
  generateInitialPlatforms();
  let startPlatform = platforms[0];
  player.x = startPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
  player.y = startPlatform.y - PLAYER_HEIGHT;
  player.vx = 0;
  player.vy = 0;
  baseY = startPlatform.y;
  maxScore = 0;
  cameraOffset = player.y - canvas.height / 2;
  lavaY = startPlatform.y + 120;
  lavaTargetY = lavaY;
  
  spikeEventState = "idle";
  spikeEventTime = performance.now() + getRandomIdleInterval();
  spikeStrikeSides.left = false;
  spikeStrikeSides.right = false;
  
  requestAnimationFrame(gameLoop);
}

retryButton.addEventListener("click", resetGame);

// --- Input Handling ---
// Track key presses and specifically handle jump physics.
let keys = {};
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = true;
  // Handle jump initiation when on ground and jump key is pressed (W or Space)
  if ((e.key === "w" || e.key === " " || e.key === "W") && isOnGround && !jumpKeyHeld) {
    jumpKeyHeld = true;
    jumpStartTime = performance.now();
    let jumpStrength = (performance.now() < jumpBoostEndTime) ? boostedJumpStrength : baseJumpStrength;
    // If moving sideways, increase jump strength by 20%
    if (keys["a"] || keys["arrowleft"] || keys["A"] || keys["d"] || keys["arrowright"] || keys["D"]) {
      jumpStrength *= 1.2;
    }
    // If Brown powerup is active, reduce jump strength
    if (isBrownActive()) {
      jumpStrength *= BROWN_JUMP_MULTIPLIER;
    }
    player.vy = jumpStrength;
    isOnGround = false;
  }
});
document.addEventListener("keyup", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = false;
  if (e.key === "w" || e.key === " " || e.key === "W") {
    jumpKeyHeld = false;
  }
});

// --- Collision Detection ---
function isColliding(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
// Get player's collision rectangle (scale if Brown active)
function getPlayerRect() {
  if (isBrownActive()) {
    return {
      x: player.x,
      y: player.y - cameraOffset,
      width: player.width * 1.25,
      height: player.height * 1.25
    };
  } else {
    return {
      x: player.x,
      y: player.y - cameraOffset,
      width: player.width,
      height: player.height
    };
  }
}

// --- Update Functions ---
// Update player movement with new jump physics.
// Extra gravity is applied if the jump key is released mid-jump.
function updatePlayerMovement() {
  let speedMultiplier = pinkMultiplier();
  if (isBrownActive()) {
    speedMultiplier *= 0.75; // slower movement when brown is active
  }
  if (keys["a"] || keys["arrowleft"] || keys["A"]) {
    player.vx = -PLAYER_SPEED * speedMultiplier;
  } else if (keys["d"] || keys["arrowright"] || keys["D"]) {
    player.vx = PLAYER_SPEED * speedMultiplier;
  } else {
    player.vx = 0;
  }
  
  // Calculate gravity (adjust if Brown powerup is active)
  let gravityEffect = GRAVITY * (isBrownActive() ? BROWN_GRAVITY_MULTIPLIER : 1) * speedMultiplier;
  player.vy += gravityEffect;
  
  // If jump key is released and the player is still ascending, apply extra gravity to cut the jump short.
  if (!jumpKeyHeld && player.vy < 0) {
    player.vy += GRAVITY * 1.5 * speedMultiplier;
  }
  
  player.x += player.vx;
  player.y += player.vy;
}

// Update platforms (movement and disappearing).
// If Brown is active, disappearing platforms break instantly upon landing.
function updatePlatforms() {
  let speedMultiplier = pinkMultiplier();
  platforms.forEach(platform => {
    if (platform.moving) {
      let platformSpeedFactor = (performance.now() < lavaSlowEndTime ? lavaSlowFactor : 1) * speedMultiplier;
      platform.x += platform.moveSpeed * platform.direction * platformSpeedFactor;
      if (platform.x <= platform.minX || platform.x >= platform.maxX) {
        platform.direction *= -1;
      }
    }
  });
  platforms = platforms.filter(platform => {
    if (platform.disappearing && platform.disappearStartTime !== null) {
      return (performance.now() - platform.disappearStartTime < (isBrownActive() ? 0 : 2000));
    }
    return true;
  });
}

// Update lava rising and projectiles.
function updateLavaAndProjectiles() {
  let now = performance.now();
  let speedMultiplier = pinkMultiplier();
  if (now - lastLavaIncreaseTime >= 4000) {
    baseLavaSpeed = Math.min(maxLavaSpeed, baseLavaSpeed + lavaSpeedIncrement);
    lastLavaIncreaseTime = now;
  }
  let effectiveLavaSpeed = baseLavaSpeed * ((now < lavaSlowEndTime) ? lavaSlowFactor : 1) * speedMultiplier;
  if (!lavaTransitionStart) {
    lavaY -= effectiveLavaSpeed;
    if (lavaY - (player.y + player.height) > 300) {
      lavaTransitionStart = now;
      lavaStartY = lavaY;
      lavaTargetY = player.y + player.height + 20;
    }
  } else {
    let t = (now - lavaTransitionStart) / (lavaTransitionDuration / speedMultiplier);
    if (t >= 1) {
      lavaY = lavaTargetY;
      lavaTransitionStart = null;
    } else {
      lavaY = lavaStartY + (lavaTargetY - lavaStartY) * easeInQuad(t);
    }
  }
  
  if (now - lastProjectileSpawnTime > projectileSpawnInterval / speedMultiplier) {
    let projectileX = Math.random() * (canvas.width - 2 * coverWidth - projectileSize) + coverWidth;
    let projectileSpeed = -2 * ((now < lavaSlowEndTime) ? lavaSlowFactor : 1) * speedMultiplier;
    lavaProjectiles.push({ x: projectileX, y: lavaY, vy: projectileSpeed });
    lastProjectileSpawnTime = now;
  }
  lavaProjectiles.forEach(proj => {
    proj.y += proj.vy;
  });
  lavaProjectiles = lavaProjectiles.filter(proj => proj.y + projectileSize > 0);
}

// Update spike events (durations scaled by pink multiplier).
function updateSpikeEvents() {
  let now = performance.now();
  let speedMultiplier = pinkMultiplier();
  let effectiveWarningDuration = (now < lavaSlowEndTime ? warningDuration / lavaSlowFactor : warningDuration) / speedMultiplier;
  let effectiveStrikeDuration = (now < lavaSlowEndTime ? strikeDuration / lavaSlowFactor : strikeDuration) / speedMultiplier;
  let effectiveRetractDuration = (now < lavaSlowEndTime ? retractDuration / lavaSlowFactor : retractDuration) / speedMultiplier;
  
  if (now >= spikeEventTime) {
    if (spikeEventState === "idle") {
      spikeStrikeSides.left = Math.random() < 0.5;
      spikeStrikeSides.right = Math.random() < 0.5;
      if (!spikeStrikeSides.left && !spikeStrikeSides.right) {
        spikeStrikeSides.left = Math.random() < 0.5;
      }
      spikeEventState = "warning";
      spikeEventTime = now + effectiveWarningDuration;
    } else if (spikeEventState === "warning") {
      spikeEventState = "strike";
      strikeStartTime = now;
      spikeEventTime = now + effectiveStrikeDuration;
    } else if (spikeEventState === "strike") {
      spikeEventState = "retract";
      retractStartTime = now;
      spikeEventTime = now + effectiveRetractDuration;
    } else if (spikeEventState === "retract") {
      spikeEventState = "idle";
      spikeEventTime = now + getRandomIdleInterval() / speedMultiplier;
      spikeStrikeSides.left = false;
      spikeStrikeSides.right = false;
    }
  }
  leftSpikeVerticalOffset = (leftSpikeVerticalOffset + verticalSpikeSpeed) % spikeHeight;
  rightSpikeVerticalOffset = (rightSpikeVerticalOffset + verticalSpikeSpeed) % spikeHeight;
}

// --- Rendering Functions ---
// Wrap all drawing calls so that if the white powerup is active, the entire canvas is flipped and colors are inverted.
function withWhitePowerupEffect(drawFunc) {
  if (performance.now() < whitePowerupEndTime) {
    ctx.save();
    // Flip the canvas 180 degrees
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    // Invert colors
    ctx.filter = 'invert(1)';
    drawFunc();
    ctx.restore();
  } else {
    drawFunc();
  }
}

function drawCoverBoxes() {
  ctx.fillStyle = "#333";
  ctx.fillRect(0, 0, coverWidth, canvas.height);
  ctx.fillRect(canvas.width - coverWidth, 0, coverWidth, canvas.height);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.strokeRect(canvas.width - coverWidth, 0, coverWidth, canvas.height);
}

function drawFillerBoxes() {
  if (spikeStrikeSides.left) {
    let nowLocal = performance.now();
    let duration = (nowLocal < lavaSlowEndTime ? strikeDuration / lavaSlowFactor : strikeDuration) / pinkMultiplier();
    let progress = 0;
    if (spikeEventState === "strike") {
      progress = (nowLocal - strikeStartTime) / duration;
      progress = Math.min(progress, 1);
    } else if (spikeEventState === "retract") {
      duration = (nowLocal < lavaSlowEndTime ? retractDuration / lavaSlowFactor : retractDuration) / pinkMultiplier();
      progress = (nowLocal - retractStartTime) / duration;
      progress = Math.min(progress, 1);
      progress = 1 - easeOutQuad(progress);
    }
    let offset = easeOutQuad(progress) * maxLunge;
    ctx.fillRect(coverWidth, 0, offset, canvas.height);
  }
  if (spikeStrikeSides.right) {
    let nowLocal = performance.now();
    let duration = (nowLocal < lavaSlowEndTime ? strikeDuration / lavaSlowFactor : strikeDuration) / pinkMultiplier();
    let progress = 0;
    if (spikeEventState === "strike") {
      progress = (nowLocal - strikeStartTime) / duration;
      progress = Math.min(progress, 1);
    } else if (spikeEventState === "retract") {
      duration = (nowLocal < lavaSlowEndTime ? retractDuration / lavaSlowFactor : retractDuration) / pinkMultiplier();
      progress = (nowLocal - retractStartTime) / duration;
      progress = Math.min(progress, 1);
      progress = 1 - easeOutQuad(progress);
    }
    let offset = easeOutQuad(progress) * maxLunge;
    ctx.fillRect(canvas.width - coverWidth - offset, 0, offset, canvas.height);
  }
}

function drawLungingSpikes() {
  let nowLocal = performance.now();
  if (spikeStrikeSides.left) {
    let duration = (nowLocal < lavaSlowEndTime ? strikeDuration / lavaSlowFactor : strikeDuration) / pinkMultiplier();
    let progress = 0;
    if (spikeEventState === "strike") {
      progress = (nowLocal - strikeStartTime) / duration;
      progress = Math.min(progress, 1);
    } else if (spikeEventState === "retract") {
      duration = (nowLocal < lavaSlowEndTime ? retractDuration / lavaSlowFactor : retractDuration) / pinkMultiplier();
      progress = (nowLocal - retractStartTime) / duration;
      progress = Math.min(progress, 1);
      progress = 1 - easeOutQuad(progress);
    }
    let offset = easeOutQuad(progress) * maxLunge;
    let baseX = coverWidth + offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(coverWidth, 0, canvas.width - coverWidth, canvas.height);
    ctx.clip();
    ctx.fillStyle = "#333";
    for (let i = -1; i < canvas.height / spikeHeight + 1; i++) {
      let y = i * spikeHeight - leftSpikeVerticalOffset;
      ctx.beginPath();
      ctx.moveTo(baseX, y);
      ctx.lineTo(baseX + spikeWidth, y + spikeHeight / 2);
      ctx.lineTo(baseX, y + spikeHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (player.x < baseX + spikeWidth &&
        performance.now() >= spikeImmunityUntil &&
        performance.now() >= redorangeInvincibilityUntil) {
      gameOver = true;
      messageDiv.innerText = "Game Over! Left spikes struck you!";
      retryButton.style.display = "block";
    }
  }
  if (spikeStrikeSides.right) {
    let nowLocal = performance.now();
    let duration = (nowLocal < lavaSlowEndTime ? strikeDuration / lavaSlowFactor : strikeDuration) / pinkMultiplier();
    let progress = 0;
    if (spikeEventState === "strike") {
      progress = (nowLocal - strikeStartTime) / duration;
      progress = Math.min(progress, 1);
    } else if (spikeEventState === "retract") {
      duration = (nowLocal < lavaSlowEndTime ? retractDuration / lavaSlowFactor : retractDuration) / pinkMultiplier();
      progress = (nowLocal - retractStartTime) / duration;
      progress = Math.min(progress, 1);
      progress = 1 - easeOutQuad(progress);
    }
    let offset = easeOutQuad(progress) * maxLunge;
    let baseX = canvas.width - coverWidth - offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width - coverWidth, canvas.height);
    ctx.clip();
    ctx.fillStyle = "#333";
    for (let i = -1; i < canvas.height / spikeHeight + 1; i++) {
      let y = i * spikeHeight + rightSpikeVerticalOffset;
      ctx.beginPath();
      ctx.moveTo(baseX, y);
      ctx.lineTo(baseX - spikeWidth, y + spikeHeight / 2);
      ctx.lineTo(baseX, y + spikeHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (player.x + getPlayerRect().width > baseX - spikeWidth &&
        performance.now() >= spikeImmunityUntil &&
        performance.now() >= redorangeInvincibilityUntil) {
      gameOver = true;
      messageDiv.innerText = "Game Over! Right spikes struck you!";
      retryButton.style.display = "block";
    }
  }
}

function drawWarningOverlays() {
  if (spikeEventState === "warning") {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    if (spikeStrikeSides.left) ctx.fillRect(0, 0, 50, canvas.height);
    if (spikeStrikeSides.right) ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);
  }
}

function drawSpikes() {
  drawCoverBoxes();
  drawFillerBoxes();
  drawLungingSpikes();
  drawWarningOverlays();
}

function drawPlatformsAndPowerups() {
  let now = performance.now();
  platforms.forEach(platform => {
    let drawY = platform.y - cameraOffset;
    if (platform.ghost) {
      let alpha = 1;
      if (platform.disappearStartTime !== null) {
        alpha = Math.max(0, 1 - (now - platform.disappearStartTime) / 60);
      }
      ctx.fillStyle = "rgba(179, 85, 22," + alpha + ")";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    } else if (platform.disappearing) {
      ctx.strokeStyle = "black";
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(platform.x, drawY, platform.width, platform.height);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "saddlebrown";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    }
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (PLATFORM_WIDTH - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let col;
      switch(platform.powerup.type) {
        case "white": col = "white"; break;
        case "jump": col = "yellow"; break;
        case "lava": col = "green"; break;
        case "red": col = "red"; break;
        case "orange": col = "orange"; break;
        case "redorange": col = "orangered"; break;
        case "cyan": col = "cyan"; break;
        case "purple": col = "purple"; break;
        case "darkblue": col = "darkblue"; break;
        case "pink": col = "pink"; break;
        case "brown": col = "brown"; break;
        default: col = "white";
      }
      ctx.fillStyle = col;
      ctx.fillRect(powerupX, powerupY, powerupWidth, powerupHeight);
    }
  });
  
  let lavaScreenY = lavaY - cameraOffset;
  if (lavaScreenY < canvas.height) {
    ctx.fillStyle = "red";
    ctx.fillRect(0, lavaScreenY, canvas.width, canvas.height - lavaScreenY);
  }
  
  lavaProjectiles.forEach(proj => {
    ctx.fillStyle = "darkred";
    ctx.fillRect(proj.x, proj.y - cameraOffset, projectileSize, projectileSize);
  });
}

// Render the player; if Brown is active, scale up and color brown.
// Pink powerup takes precedence over normal color changes.
function renderPlayer() {
  let now = performance.now();
  let playerColor = "blue";
  if (now < spikeImmunityUntil) {
    playerColor = "cyan";
  } else if (now < jumpBoostEndTime) {
    playerColor = "orange";
  } else if (now < lavaSlowEndTime) {
    playerColor = "green";
  }
  if (now < pinkPowerupEndTime) {
    playerColor = "pink";
  }
  if (isBrownActive()) {
    playerColor = "brown";
  }
  let drawWidth = player.width;
  let drawHeight = player.height;
  if (isBrownActive()) {
    drawWidth *= 1.25;
    drawHeight *= 1.25;
  }
  ctx.fillStyle = playerColor;
  ctx.fillRect(player.x, player.y - cameraOffset, drawWidth, drawHeight);
}

// --- Collision & Powerup Handling ---
let isOnGround = false;
function handleCollisions() {
  let prevY = player.y - player.vy;
  let playerRect = getPlayerRect();
  
  platforms.forEach(platform => {
    let platformRect = {
      x: platform.x,
      y: platform.y - cameraOffset,
      width: platform.width,
      height: platform.height
    };
    if (isColliding(playerRect, platformRect)) {
      if (platform.ghost) {
        if (platform.disappearStartTime === null) {
          platform.disappearStartTime = performance.now();
        }
      } else {
        if (player.vy >= 0 && prevY + playerRect.height <= platform.y + 5) {
          player.y = platform.y - (isBrownActive() ? player.height * 1.25 : player.height);
          player.vy = 0;
          isOnGround = true;
          if (platform.disappearing && isBrownActive()) {
            platform.disappearStartTime = performance.now() - 2000;
          } else if (platform.disappearing && platform.disappearStartTime === null) {
            platform.disappearStartTime = performance.now();
          }
        }
      }
    }
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (PLATFORM_WIDTH - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let powerupRect = { x: powerupX, y: powerupY, width: powerupWidth, height: powerupHeight };
      if (isColliding(playerRect, powerupRect)) {
        platform.powerup.collected = true;
        switch(platform.powerup.type) {
          case "jump":
            jumpBoostEndTime = performance.now() + 3000;
            break;
          case "lava":
            lavaSlowEndTime = performance.now() + 5000;
            break;
          case "red":
            if (performance.now() < spikeImmunityUntil) break;
            gameOver = true;
            messageDiv.innerText = "Game Over! You touched a Red Cube!";
            retryButton.style.display = "block";
            break;
          case "orange":
            player.y = lavaY - 20 - player.height;
            cameraOffset = player.y - canvas.height / 2;
            break;
          case "redorange":
            player.vy = HUGE_JUMP_STRENGTH;
            redorangeInvincibilityUntil = performance.now() + 1000;
            break;
          case "cyan":
            spikeImmunityUntil = performance.now() + 5000;
            break;
          case "purple":
            teleportPlayerUpwards(platform);
            break;
          case "darkblue":
            spikeStrikeSides.left = Math.random() < 0.5;
            spikeStrikeSides.right = !spikeStrikeSides.left;
            spikeEventState = "strike";
            strikeStartTime = performance.now();
            spikeEventTime = performance.now() + strikeDuration;
            break;
          case "pink":
            pinkPowerupEndTime = performance.now() + PINK_DURATION;
            break;
          case "brown":
            brownPowerupEndTime = performance.now() + BROWN_DURATION;
            break;
          case "white":
            whitePowerupEndTime = performance.now() + WHITE_DURATION;
            break;
        }
      }
    }
  });
  
  if (player.y + getPlayerRect().height > lavaY) {
    gameOver = true;
    messageDiv.innerText = "Game Over! You have fallen into the lava!";
    retryButton.style.display = "block";
  }
  if (player.y > cameraOffset + canvas.height) {
    gameOver = true;
    messageDiv.innerText = "Game Over! Watch your step next time!";
    retryButton.style.display = "block";
  }
  
  let playerRect2 = getPlayerRect();
  lavaProjectiles.forEach(proj => {
    let projRect = { x: proj.x, y: proj.y - cameraOffset, width: projectileSize, height: projectileSize };
    if (isColliding(playerRect2, projRect) && performance.now() >= redorangeInvincibilityUntil) {
      gameOver = true;
      messageDiv.innerText = "Game Over! Lava projectile hit you!";
      retryButton.style.display = "block";
    }
  });
}

// --- Main Game Loop ---
let gameOver = false;
function gameLoop() {
  if (gameOver) return;
  let now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  updatePlayerMovement();
  updatePlatforms();
  updateLavaAndProjectiles();
  updateSpikeEvents();
  handleCollisions();
  generatePlatformsIfNeeded();
  
  cameraOffset = Math.min(player.y - canvas.height / 2, cameraOffset);
  
  let currentHeight = baseY - player.y;
  if (currentHeight > maxScore) {
    maxScore = currentHeight;
  }
  globalHighScore = Math.max(globalHighScore, maxScore);
  
  // Wrap all drawing with the white powerup effect if active.
  withWhitePowerupEffect(() => {
    drawPlatformsAndPowerups();
    drawSpikes();
    renderPlayer();
  
    ctx.fillStyle = "black";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + Math.floor(maxScore), 10, 30);
    ctx.fillText("High Score: " + Math.floor(globalHighScore), 10, 55);
  });
  
  requestAnimationFrame(gameLoop);
}

resetGame();
