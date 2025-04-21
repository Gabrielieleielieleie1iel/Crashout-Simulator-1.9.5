// -------------------- Global Variables and Game Constants --------------------
let globalHighScore = parseFloat(localStorage.getItem("globalHighScore")) || 0; // Persistent high score from previous sessions
let redInvincibilityUntil = 0;
let pinkPowerupEndTime = 0;  // doubles game speed
let brownPowerupEndTime = 0; // increases weight and reduces jump power
let whitePowerupEndTime = 0; // inverts colors
let yellowPowerupEndTime = 0; // brightens entire screen (rare)
let purplePowerupEndTime = 0; // not used for timing now; teleport effect happens immediately
let orangePowerupEndTime = 0; // likewise

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageDiv = document.getElementById("message");
const retryButton = document.getElementById("retryButton");

// UI & Tutorial elements
const tutorialToggle = document.getElementById("tutorialToggle");
const tutorialGuide = document.getElementById("tutorialGuide");
const tabPowerup = document.getElementById("tabPowerup");
const tabPlatform = document.getElementById("tabPlatform");
const contentPowerup = document.getElementById("contentPowerup");
const contentPlatform = document.getElementById("contentPlatform");
const backgroundMusic = document.getElementById("backgroundMusic");

// Powerup durations (in ms)
const PINK_DURATION = 5000;
const BROWN_DURATION = 5000;
const WHITE_DURATION = 10000;
const YELLOW_DURATION = 10000; // yellow powerup brightens screen for 10 seconds

// Helpers
const pinkMultiplier = () => performance.now() < pinkPowerupEndTime ? 2 : 1;
const isBrownActive = () => performance.now() < brownPowerupEndTime;

// Game constants
const GRAVITY = 0.5;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 5;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 10;
const baseJumpStrength = -12;
const boostedJumpStrength = -16;
let jumpBoostEndTime = 0;

// Brown powerup adjustments (only affecting weak platforms)
const BROWN_JUMP_MULTIPLIER = 0.75;
const BROWN_GRAVITY_MULTIPLIER = 1.25;

// Automatic downward scroll speed
const AUTO_DOWNWARD_SPEED = 0.5;

// Fall damage threshold remains at 300 for fairness.
const FALL_DAMAGE_THRESHOLD = 300;
let fallStartY = null;

// Score and Camera
let baseY = 0;
let maxScore = 0;
let cameraOffset = 0;

// Player Object
let player = {
  x: 0,
  y: 0,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  vx: 0,
  vy: 0
};

// Spike Event & Cover Settings (rock slide effect)
const coverWidth = 20;
const spikeWidth = 20;
const spikeHeight = 20;
const verticalSpikeSpeed = 0.5;
const maxLunge = 140 - coverWidth;

const warningDuration = 2000;
const strikeDuration = 200;
const retractDuration = 300;

let spikeEventState = "idle";
let spikeEventTime = performance.now() + getRandomIdleInterval();
let spikeStrikeSides = { left: false, right: false };
let strikeStartTime = 0;
let retractStartTime = 0;
let leftSpikeVerticalOffset = 0;
let rightSpikeVerticalOffset = 0;
let spikeImmunityUntil = 0; // Used for complete immunity (cyan powerup)

// Jump physics variables
let jumpKeyHeld = false;
let jumpStartTime = 0;

// Easing functions
function easeOutQuad(t) { return t * (2 - t); }
function easeInQuad(t) { return t * t; }
function getRandomIdleInterval() { return 3000 + Math.random() * 2000; }

// -------------------- UI and Tutorial Setup --------------------
document.addEventListener("DOMContentLoaded", function() {
  // The guide toggle is now fixed via the HTML onclick inline handler.
  tabPowerup.addEventListener("click", function() {
    contentPowerup.style.display = "block";
    contentPlatform.style.display = "none";
    tabPowerup.classList.add("activeTab");
    tabPlatform.classList.remove("activeTab");
  });
  tabPlatform.addEventListener("click", function() {
    contentPlatform.style.display = "block";
    contentPowerup.style.display = "none";
    tabPlatform.classList.add("activeTab");
    tabPowerup.classList.remove("activeTab");
  });
});

// -------------------- Platform Generation --------------------
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
    ghost: false,
    spike: false
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
  if (Math.random() < 0.1) { platform.spike = true; }
  
  // Powerup assignment with new distribution:
  // First try for common ones: red, cyan, purple, darkblue, pink, brown.
  if (Math.random() < 0.2) {
    let r = Math.random();
    if (r < 0.05) {
      platform.powerup = { type: "white", collected: false };
    } else if (r < 0.35) {
      platform.powerup = { type: "red", collected: false };
    } else if (r < 0.55) {
      platform.powerup = { type: "cyan", collected: false };
    } else if (r < 0.70) {
      platform.powerup = { type: "purple", collected: false }; // Teleports DOWN (fixed below)
    } else if (r < 0.80) {
      platform.powerup = { type: "darkblue", collected: false };
    } else if (r < 0.95) {
      platform.powerup = { type: "pink", collected: false };
    } else {
      platform.powerup = { type: "brown", collected: false };
    }
  }
  // Then, try to assign an orange powerup (teleports UP) with a moderate chance
  if (!platform.powerup && Math.random() < 0.03) {
    platform.powerup = { type: "orange", collected: false };
  }
  // Finally, try for the yellow powerup as the rarest (~1% chance)
  if (!platform.powerup && Math.random() < 0.01) {
    platform.powerup = { type: "yellow", collected: false };
  }
  return platform;
}

function generateInitialPlatforms() {
  platforms = [];
  let startPlatformY = 20;
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
    ghost: false,
    spike: false
  };
  platforms.push(spawnPlatform);
  baseY = startPlatformY;
  let currentY = startPlatformY;
  for (let i = 0; i < 15; i++) {
    let gapY = 30 + Math.random() * 40;
    let newY = currentY + gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
    currentY = newY;
  }
}

function generatePlatformsIfNeeded() {
  while (platforms[platforms.length - 1].y < cameraOffset + canvas.height + 100) {
    let lastY = platforms[platforms.length - 1].y;
    let gapY = 30 + Math.random() * 40;
    let newY = lastY + gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
  }
}

// -------------------- Fall Damage --------------------
function updateFallDamage(isLanding) {
  // If cyan (full immunity) is active, skip fall damage.
  if (performance.now() < spikeImmunityUntil) return;
  if (!isLanding && fallStartY === null) { fallStartY = player.y; }
  if (isLanding && fallStartY !== null) {
    if (player.y - fallStartY > FALL_DAMAGE_THRESHOLD) {
      gameOver = true;
      messageDiv.innerText = "Game Over! You hit the ground too hard!";
      retryButton.style.display = "block";
    }
    fallStartY = null;
  }
}

// -------------------- Automatic Downward Camera and Walls --------------------
let lastFrameTime = performance.now();
function updateCamera() {
  let now = performance.now();
  let dt = now - lastFrameTime;
  lastFrameTime = now;
  let targetOffset = player.y - canvas.height / 2;
  cameraOffset = Math.max(targetOffset, cameraOffset + AUTO_DOWNWARD_SPEED * dt * 0.06);
  if (player.y < cameraOffset - 50) {
    if (!(performance.now() < spikeImmunityUntil)) {
      gameOver = true;
      messageDiv.innerText = "Game Over! You were crushed by the pressure!";
      retryButton.style.display = "block";
    }
  }
  // Clamp horizontal position to simulate side walls.
  if (player.x < 0) { player.x = 0; }
  if (player.x + player.width > canvas.width) { player.x = canvas.width - player.width; }
}

// -------------------- Teleportation Functions --------------------
// Teleport UP (for orange powerup): Move to a higher platform.
function teleportPlayerUpwards() {
  let platformsAbove = platforms.filter(p => p.y < player.y);
  if (platformsAbove.length === 0) return;
  platformsAbove.sort((a, b) => b.y - a.y);
  let targetIndex = 2; // Teleport a few platforms upward.
  let targetPlatform = targetIndex < platformsAbove.length ? platformsAbove[targetIndex] : platformsAbove[platformsAbove.length - 1];
  if (targetPlatform) {
    player.x = targetPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
    player.y = targetPlatform.y - PLAYER_HEIGHT;
    cameraOffset = Math.min(cameraOffset, player.y - canvas.height / 2);
    console.log("Teleported up to platform at y:", targetPlatform.y);
  }
}

// Teleport DOWN (for purple powerup): Move to a lower platform.
function teleportPlayerDownwards() {
  let platformsBelow = platforms.filter(p => p.y > player.y);
  if (platformsBelow.length === 0) return;
  platformsBelow.sort((a, b) => a.y - b.y);
  let targetIndex = 2; // Teleport a few platforms downward.
  let targetPlatform = targetIndex < platformsBelow.length ? platformsBelow[targetIndex] : platformsBelow[platformsBelow.length - 1];
  cameraOffset = Math.max(cameraOffset, player.y - canvas.height / 2);
  if (targetPlatform) {
    player.x = targetPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
    player.y = targetPlatform.y - PLAYER_HEIGHT;
    // Ensure camera follows downward movement.
    cameraOffset = Math.max(cameraOffset, player.y - canvas.height / 2);
    console.log("Teleported down to platform at y:", targetPlatform.y);
  }
}

// -------------------- Darkness Overlay --------------------
function drawDarknessOverlay() {
  // Skip darkness if yellow powerup is active.
  if (performance.now() < yellowPowerupEndTime) return;
  let centerX = player.x + player.width / 2;
  let centerY = player.y - cameraOffset + player.height / 2;
  let innerRadius = 100;
  let outerRadius = innerRadius * 3;
  let gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// -------------------- Reset Game --------------------
let currentMode = "descend";
function resetGame(mode) {
  currentMode = mode || "descend";
  gameOver = false;
  messageDiv.innerText = "";
  retryButton.style.display = "none";
  
  redInvincibilityUntil = 0;
  pinkPowerupEndTime = 0;
  brownPowerupEndTime = 0;
  whitePowerupEndTime = 0;
  yellowPowerupEndTime = 0;
  
  generateInitialPlatforms();
  let startPlatform = platforms[0];
  player.x = startPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
  player.y = startPlatform.y - PLAYER_HEIGHT;
  player.vx = 0;
  player.vy = 0;
  fallStartY = null;
  maxScore = 0;
  // Do NOT reset globalHighScore here so that the record persists
  cameraOffset = 0;
  lastFrameTime = performance.now();
  
  spikeEventState = "idle";
  spikeEventTime = performance.now() + getRandomIdleInterval();
  spikeStrikeSides.left = false;
  spikeStrikeSides.right = false;
  
  requestAnimationFrame(gameLoop);
}
retryButton.addEventListener("click", function() { resetGame(currentMode); });

// -------------------- Input Handling --------------------
let keys = {};
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if ((e.key === "w" || e.key === " " || e.key === "W") && isOnGround && !jumpKeyHeld) {
    jumpKeyHeld = true;
    jumpStartTime = performance.now();
    let jumpStrength = (performance.now() < jumpBoostEndTime) ? boostedJumpStrength : baseJumpStrength;
    if (keys["a"] || keys["arrowleft"] || keys["A"] || keys["d"] || keys["arrowright"] || keys["D"]) {
      jumpStrength *= 1.2;
    }
    if (isBrownActive()) { jumpStrength *= BROWN_JUMP_MULTIPLIER; }
    player.vy = jumpStrength;
    isOnGround = false;
  }
});
document.addEventListener("keyup", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = false;
  if (e.key === "w" || e.key === " " || e.key === "W") { jumpKeyHeld = false; }
});

// -------------------- Collision Detection --------------------
function isColliding(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
function getPlayerRect() {
  if (isBrownActive()) {
    return { x: player.x, y: player.y - cameraOffset, width: player.width * 1.25, height: player.height * 1.25 };
  } else {
    return { x: player.x, y: player.y - cameraOffset, width: player.width, height: player.height };
  }
}

// -------------------- Update Functions --------------------
let isOnGround = false;
function updatePlayerMovement() {
  let speedMultiplier = pinkMultiplier();
  if (isBrownActive()) { speedMultiplier *= 0.75; }
	if (keys["a"] || keys["arrowleft"] || keys["A"]) {
    player.vx = -PLAYER_SPEED * speedMultiplier;
  } else if (keys["d"] || keys["arrowright"] || keys["D"]) {
    player.vx = PLAYER_SPEED * speedMultiplier;
  } else {
    player.vx = 0;
  }
  let gravityEffect = GRAVITY * (isBrownActive() ? BROWN_GRAVITY_MULTIPLIER : 1) * speedMultiplier;
  player.vy += gravityEffect;
  if (!jumpKeyHeld && player.vy < 0) {
    player.vy += GRAVITY * 1.5 * speedMultiplier;
  }
  player.x += player.vx;
  player.y += player.vy;
}

function updatePlatforms() {
  let speedMultiplier = pinkMultiplier();
  platforms.forEach(platform => {
    if (platform.moving) {
      let platformSpeedFactor = speedMultiplier;
      platform.x += platform.moveSpeed * platform.direction * platformSpeedFactor;
      if (platform.x <= platform.minX || platform.x >= platform.maxX) {
        platform.direction *= -1;
      }
    }
  });
  // Ghost platforms remain unchanged.
}

// -------------------- Spike Event (Rock Slide Effect) --------------------
function updateSpikeEvents() {
  let now = performance.now();
  let speedMultiplier = pinkMultiplier();
  let effectiveWarningDuration = warningDuration / speedMultiplier;
  let effectiveStrikeDuration = strikeDuration / speedMultiplier;
  let effectiveRetractDuration = retractDuration / speedMultiplier;
  
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

// -------------------- Rendering Functions --------------------
function withWhitePowerupEffect(drawFunc) {
  if (performance.now() < whitePowerupEndTime) {
    ctx.save();
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    ctx.filter = 'invert(1)';
    drawFunc();
    ctx.restore();
  } else {
    drawFunc();
  }
}

// Draw side walls for the cave.
function drawWalls() {
  ctx.fillStyle = "#444";
  ctx.fillRect(0, 0, 10, canvas.height);
  ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);
}

function drawCoverBoxes() {
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, coverWidth, canvas.height);
  ctx.fillRect(canvas.width - coverWidth, 0, coverWidth, canvas.height);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.strokeRect(canvas.width - coverWidth, 0, coverWidth, canvas.height);
}

// Updated rock slide effect for spike event.
function drawFillerBoxes() {
  if (spikeStrikeSides.left) {
    let nowLocal = performance.now();
    let duration = strikeDuration / pinkMultiplier();
    let progress = spikeEventState === "strike" ? Math.min((nowLocal - strikeStartTime) / duration, 1)
                  : spikeEventState === "retract" ? 1 - easeOutQuad(Math.min((nowLocal - retractStartTime) / (retractDuration / pinkMultiplier()), 1))
                  : 0;
    let offset = easeOutQuad(progress) * maxLunge;
    ctx.fillStyle = "#666";
    for (let i = 0; i < canvas.height / 20; i++) {
      ctx.fillRect(coverWidth + offset - 10, i * 20 + leftSpikeVerticalOffset, 20, 10);
    }
  }
  if (spikeStrikeSides.right) {
    let nowLocal = performance.now();
    let duration = strikeDuration / pinkMultiplier();
    let progress = spikeEventState === "strike" ? Math.min((nowLocal - strikeStartTime) / duration, 1)
                  : spikeEventState === "retract" ? 1 - easeOutQuad(Math.min((nowLocal - retractStartTime) / (retractDuration / pinkMultiplier()), 1))
                  : 0;
    let offset = easeOutQuad(progress) * maxLunge;
    ctx.fillStyle = "#666";
    for (let i = 0; i < canvas.height / 20; i++) {
      ctx.fillRect(canvas.width - coverWidth - offset - 10, i * 20 + rightSpikeVerticalOffset, 20, 10);
    }
  }
}

function drawLungingSpikes() {
  let nowLocal = performance.now();
  if (spikeStrikeSides.left) {
    let duration = strikeDuration / pinkMultiplier();
    let progress = spikeEventState === "strike" ? Math.min((nowLocal - strikeStartTime) / duration, 1)
                  : spikeEventState === "retract" ? 1 - easeOutQuad(Math.min((nowLocal - retractStartTime) / (retractDuration / pinkMultiplier()), 1))
                  : 0;
    let offset = easeOutQuad(progress) * maxLunge;
    let baseX = coverWidth + offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(coverWidth, 0, canvas.width - coverWidth, canvas.height);
    ctx.clip();
    ctx.fillStyle = "#555";
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
        !(performance.now() < spikeImmunityUntil) &&
        !(performance.now() < redInvincibilityUntil)) {
      gameOver = true;
      messageDiv.innerText = "Game Over! Left spikes struck you!";
      retryButton.style.display = "block";
    }
  }
  if (spikeStrikeSides.right) {
    let nowLocal = performance.now();
    let duration = strikeDuration / pinkMultiplier();
    let progress = spikeEventState === "strike" ? Math.min((nowLocal - strikeStartTime) / duration, 1)
                  : spikeEventState === "retract" ? 1 - easeOutQuad(Math.min((nowLocal - retractStartTime) / (retractDuration / pinkMultiplier()), 1))
                  : 0;
    let offset = easeOutQuad(progress) * maxLunge;
    let baseX = canvas.width - coverWidth - offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width - coverWidth, canvas.height);
    ctx.clip();
    ctx.fillStyle = "#555";
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
        !(performance.now() < spikeImmunityUntil) &&
        !(performance.now() < redInvincibilityUntil)) {
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

// -------------------- Darkness Overlay --------------------
function drawDarknessOverlay() {
  if (performance.now() < yellowPowerupEndTime) return;
  let centerX = player.x + player.width / 2;
  let centerY = player.y - cameraOffset + player.height / 2;
  let innerRadius = 100;
  let outerRadius = innerRadius * 3;
  let gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// -------------------- Updated Platform and Powerup Rendering --------------------
function drawPlatformsAndPowerups() {
  let now = performance.now();
  platforms.forEach(platform => {
    let drawY = platform.y - cameraOffset;
    if (platform.spike) {
      ctx.fillStyle = "#773322";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
      ctx.fillStyle = "#552211";
      let spikeCount = Math.floor(platform.width / 10);
      for (let i = 0; i < spikeCount; i++) {
        let spikeX = platform.x + i * 10;
        ctx.beginPath();
        ctx.moveTo(spikeX, drawY);
        ctx.lineTo(spikeX + 5, drawY - 8);
        ctx.lineTo(spikeX + 10, drawY);
        ctx.closePath();
        ctx.fill();
      }
    } else if (platform.ghost) {
      let alpha = 1;
      if (platform.disappearStartTime !== null) {
        alpha = Math.max(0, 1 - (now - platform.disappearStartTime) / 60);
      }
      ctx.fillStyle = "rgba(100,100,100," + alpha + ")";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    } else if (platform.disappearing) {
      ctx.strokeStyle = "black";
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(platform.x, drawY, platform.width, platform.height);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    }
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (PLATFORM_WIDTH - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let col;
      switch(platform.powerup.type) {
        case "white": col = "white"; break;
        case "red": col = "red"; break;
        case "cyan": col = "cyan"; break;
        case "purple": col = "purple"; break;
        case "darkblue": col = "darkblue"; break;
        case "pink": col = "pink"; break;
        case "brown": col = "brown"; break;
        case "yellow": col = "yellow"; break;
        case "orange": col = "orange"; break;
        default: col = "white";
      }
      ctx.fillStyle = col;
      ctx.fillRect(powerupX, powerupY, powerupWidth, powerupHeight);
    }
  });
}

// -------------------- Player Rendering --------------------
function renderPlayer() {
  let now = performance.now();
  let playerColor = "blue";
  if (now < spikeImmunityUntil) { playerColor = "cyan"; }
  else if (now < jumpBoostEndTime) { playerColor = "purple"; }
  if (now < pinkPowerupEndTime) { playerColor = "pink"; }
  if (isBrownActive()) { playerColor = "brown"; }
  let drawWidth = player.width;
  let drawHeight = player.height;
  if (isBrownActive()) { drawWidth *= 1.25; drawHeight *= 1.25; }
  ctx.fillStyle = playerColor;
  ctx.fillRect(player.x, player.y - cameraOffset, drawWidth, drawHeight);
}

// -------------------- Collision & Powerup Handling --------------------
function handleCollisions() {
  let prevY = player.y - player.vy;
  let playerRect = getPlayerRect();
  
  isOnGround = false;
  platforms.forEach(platform => {
    let platformRect = { x: platform.x, y: platform.y - cameraOffset, width: platform.width, height: platform.height };
    if (isColliding(playerRect, platformRect)) {
      if (platform.spike) {
        if (!(performance.now() < spikeImmunityUntil)) {
          gameOver = true;
          messageDiv.innerText = "Game Over! You were impaled by a Stalagmite!";
          retryButton.style.display = "block";
        }
      } else {
        if (player.vy >= 0 && prevY + playerRect.height <= platform.y + 5) {
          player.y = platform.y - player.height;
          player.vy = 0;
          isOnGround = true;
          updateFallDamage(true);
          if (platform.disappearing && platform.disappearStartTime === null) {
            platform.disappearStartTime = performance.now();
          }
          if (platform.powerup && !platform.powerup.collected) {
            platform.powerup.collected = true;
            switch(platform.powerup.type) {
              case "white":
                whitePowerupEndTime = performance.now() + WHITE_DURATION;
                break;
              case "red":
                if (!(performance.now() < spikeImmunityUntil)) {
                  gameOver = true;
                  messageDiv.innerText = "Game Over! You touched a Red Cube!";
                  retryButton.style.display = "block";
                }
                break;
              case "cyan":
                spikeImmunityUntil = performance.now() + 5000;
                break;
              case "purple":
                // Purple now teleports you DOWN
                teleportPlayerDownwards();
                break;
              case "orange":
                // Orange teleports you UP
                teleportPlayerUpwards();
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
              case "yellow":
                yellowPowerupEndTime = performance.now() + YELLOW_DURATION;
                break;
            }
          }
        }
      }
    }
  });
  
  if (!isOnGround) { updateFallDamage(false); }
}

// -------------------- Main Game Loop --------------------
let gameOver = false;
function gameLoop() {
  if (gameOver) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  updatePlayerMovement();
  updatePlatforms();
  updateSpikeEvents();
  handleCollisions();
  generatePlatformsIfNeeded();
  updateCamera();
  
  let currentDepth = player.y - baseY;
  if (currentDepth > maxScore) { 
    maxScore = currentDepth; 
    if (maxScore > globalHighScore) {
      globalHighScore = maxScore;
      localStorage.setItem("globalHighScore", globalHighScore);
    }
  }
  
  withWhitePowerupEffect(() => {
    drawPlatformsAndPowerups();
    drawSpikes();
    renderPlayer();
    drawWalls();
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Depth: " + Math.floor(maxScore), 10, 30);
    ctx.fillText("Record: " + Math.floor(globalHighScore), 10, 55);
  });
  
  drawDarknessOverlay();
  
  requestAnimationFrame(gameLoop);
}

resetGame("descend");
