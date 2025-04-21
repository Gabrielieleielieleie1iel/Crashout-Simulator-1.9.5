// Global Variables and Game Constants
let globalHighScore = 0;
let redorangeInvincibilityUntil = 0;
let pinkPowerupEndTime = 0; // Pink powerup active time
let brownPowerupEndTime = 0; // Brown powerup active time
let whitePowerupEndTime = 0; // White powerup active time (new)

const PINK_DURATION = 5000;   // 5 seconds
const BROWN_DURATION = 5000;  // 5 seconds
const WHITE_DURATION = 10000; // 10 seconds for white powerup

// Helpers for powerup states
const pinkMultiplier = () => performance.now() < pinkPowerupEndTime ? 2 : 1;
const isPinkActive = () => performance.now() < pinkPowerupEndTime;
const isBrownActive = () => performance.now() < brownPowerupEndTime;

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageDiv = document.getElementById("message");
const retryButton = document.getElementById("retryButton");
const backgroundMusic = document.getElementById("backgroundMusic");

// Game constants (base values)
const GRAVITY = 0.5;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 5;
const baseJumpStrength = -12;
const boostedJumpStrength = -16;

// Brown powerup adjustments
const BROWN_JUMP_MULTIPLIER = 0.75;
const BROWN_GRAVITY_MULTIPLIER = 1.25;

let jumpBoostEndTime = 0;

// --- Updated Lava Settings ---
// Doubled initial lava speed and increased increment.
let baseLavaSpeed = 1.0;
const maxLavaSpeed = 3.0; // remains capped
const lavaSpeedIncrement = 0.1;
let lastLavaIncreaseTime = performance.now();
let lavaSlowEndTime = 0;
const lavaSlowFactor = 0.5;

let lavaProjectiles = [];
let lastProjectileSpawnTime = performance.now();
const projectileSpawnInterval = 1000;
const projectileSize = 10;

let lavaTargetY = 0;
let lavaTransitionStart = null;
let lavaStartY = 0;
const lavaTransitionDuration = 800;

// Score and Camera
let baseY = 0;
let maxScore = 0;
let cameraOffset = 0;
let lavaY = 0;
let highestPlatformY = 0;

// --- Updated Spike Event Settings ---
// Increase spike lunge range and speed up spike strike/retract.
const coverWidth = 20;
const spikeWidth = 20;
const spikeHeight = 20;
const verticalSpikeSpeed = 0.5;
const maxLunge = 160 - coverWidth; // increased range

const warningDuration = 2000;
const strikeDuration = 150; // faster strike
const retractDuration = 200; // faster retract

let spikeEventState = "idle";
let spikeEventTime = performance.now() + getRandomIdleInterval();
let spikeStrikeSides = { left: false, right: false };
let strikeStartTime = 0;
let retractStartTime = 0;
let leftSpikeVerticalOffset = 0;
let rightSpikeVerticalOffset = 0;
let spikeImmunityUntil = 0;

// Easing functions
function easeOutQuad(t) {
  return t * (2 - t);
}
function easeInQuad(t) {
  return t * t;
}
function getRandomIdleInterval() {
  return 3000 + Math.random() * 2000;
}

// --- White Powerup Rendering Wrapper ---
// When white powerup is active, flip canvas and invert colors.
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

// --- Platform Generation ---
let platforms = [];
function createPlatform(x, y) {
  let platform = {
    x: x,
    y: y,
    width: 80,
    height: 10,
    moving: false,
    disappearing: false,
    disappearStartTime: null,
    powerup: null,
    ghost: false
  };
  let movingChance = globalHighScore >= 3000 ? 0.5 : 0.3;
  let disappearingChance = globalHighScore >= 3000 ? 0.4 : 0.2;
  if (Math.random() < movingChance) {
    platform.moving = true;
    platform.moveSpeed = 1 + Math.random();
    platform.direction = Math.random() < 0.5 ? 1 : -1;
    platform.minX = Math.max(0, platform.x - 30);
    platform.maxX = Math.min(canvas.width - platform.width, platform.x + 30);
  }
  if (Math.random() < disappearingChance) {
    platform.disappearing = true;
  }
  // --- Powerup Assignment ---
  if (Math.random() < 0.2) {
    let r = Math.random();
    let type;
    if (r < 0.05) {
      type = "white";
    } else {
      if (globalHighScore >= 6666) {
        if (r < 0.05 + 0.125 * 0.95) type = "jump";
        else if (r < 0.05 + 0.125 * 0.95 * 2) type = "lava";
        else if (r < 0.05 + 0.125 * 0.95 * 3) type = "red";
        else if (r < 0.05 + 0.125 * 0.95 * 4) type = "orange";
        else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95) type = "redorange";
        else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2) type = "cyan";
        else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95) type = "purple";
        else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95 + 0.05 * 0.95) type = "darkblue";
        else if (r < 0.05 + 0.125 * 0.95 * 4 + 0.075 * 0.95 * 2 + 0.1 * 0.95 + 0.05 * 0.95 + 0.1 * 0.95) type = "pink";
        else type = "brown";
      } else {
        if (r < 0.125) type = "jump";
        else if (r < 0.250) type = "lava";
        else if (r < 0.375) type = "red";
        else if (r < 0.500) type = "orange";
        else if (r < 0.575) type = "redorange";
        else if (r < 0.650) type = "cyan";
        else if (r < 0.750) type = "purple";
        else if (r < 0.800) type = "darkblue";
        else if (r < 0.900) type = "pink";
        else type = "brown";
      }
    }
    platform.powerup = { type: type, collected: false };
  }
  if (Math.random() < 0.1) {
    platform.ghost = true;
    platform.disappearing = true;
  }
  return platform;
}

function generateInitialPlatforms() {
  platforms = [];
  let startPlatformY = 580;
  let startPlatformX = canvas.width / 2 - 40;
  let spawnPlatform = {
    x: startPlatformX,
    y: startPlatformY,
    width: 80,
    height: 10,
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
    let newX = Math.random() * (canvas.width - 80);
    platforms.push(createPlatform(newX, newY));
    highestPlatformY = newY;
  }
}

function generatePlatformsIfNeeded() {
  while (highestPlatformY > cameraOffset - 100) {
    let gapY = 30 + Math.random() * 40;
    let newY = highestPlatformY - gapY;
    let newX = Math.random() * (canvas.width - 80);
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
    player.x = targetPlatform.x + (80 - PLAYER_WIDTH) / 2;
    player.y = targetPlatform.y - PLAYER_HEIGHT;
    cameraOffset = player.y - canvas.height / 2;
  }
}

// --- Reset Game ---
function resetGame() {
  gameOver = false;
  messageDiv.innerText = "";
  retryButton.style.display = "none";
  baseLavaSpeed = 0.6;
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
  player.x = startPlatform.x + (80 - PLAYER_WIDTH) / 2;
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
let keys = {};
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if ((e.key === "w" || e.key === " " || e.key === "W") && isOnGround && !jumpKeyHeld) {
    jumpKeyHeld = true;
    jumpStartTime = performance.now();
    let jumpStrength = (performance.now() < jumpBoostEndTime) ? boostedJumpStrength : baseJumpStrength;
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

// --- Updated Player Movement ---
function updatePlayerMovement() {
  let speedMultiplier = pinkMultiplier();
  if (isBrownActive()) {
    speedMultiplier *= 0.75;
  }
  if (keys["a"] || keys["arrowleft"] || keys["A"]) {
    player.vx = -PLAYER_SPEED * speedMultiplier;
  } else if (keys["d"] || keys["arrowright"] || keys["arrowleft"]) {
    player.vx = PLAYER_SPEED * speedMultiplier;
  } else {
    player.vx = 0;
  }
  
  let gravityEffect = GRAVITY * (isBrownActive() ? BROWN_GRAVITY_MULTIPLIER : 1) * speedMultiplier;
  player.vy += gravityEffect;
  
  player.x += player.vx;
  player.y += player.vy;
}

// --- Update Platforms ---
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

// --- Update Lava and Projectiles ---
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

// --- Update Spike Events ---
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
// Draw wall covers and spikes in black.
function drawCoverBoxes() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, coverWidth, canvas.height);
  ctx.fillRect(canvas.width - coverWidth, 0, coverWidth, canvas.height);
}
function drawWallSpikes() {
  const wallSpikeWidth = 15;
  const wallSpikeHeight = 15;
  ctx.fillStyle = "black";
  for (let y = 0; y < canvas.height; y += wallSpikeHeight * 1.2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(coverWidth, y + wallSpikeHeight / 2);
    ctx.lineTo(0, y + wallSpikeHeight);
    ctx.closePath();
    ctx.fill();
  }
  for (let y = 0; y < canvas.height; y += wallSpikeHeight * 1.2) {
    ctx.beginPath();
    ctx.moveTo(canvas.width, y);
    ctx.lineTo(canvas.width - coverWidth, y + wallSpikeHeight / 2);
    ctx.lineTo(canvas.width, y + wallSpikeHeight);
    ctx.closePath();
    ctx.fill();
  }
}
function drawFillerBoxes() {
  ctx.fillStyle = "black";
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
    ctx.fillStyle = "black";
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
      messageDiv.innerText = "The souls of the damned have reached you. Better luck next time.";
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
    ctx.fillStyle = "black";
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
      messageDiv.innerText = "The souls of the damned have reached you. Better luck next time.";
      retryButton.style.display = "block";
    }
  }
}
function drawWarningOverlays() {
  if (spikeEventState === "warning") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    if (spikeStrikeSides.left) ctx.fillRect(0, 0, 50, canvas.height);
    if (spikeStrikeSides.right) ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);
  }
}
function drawSpikes() {
  drawCoverBoxes();
  drawFillerBoxes();
  drawLungingSpikes();
  drawWarningOverlays();
  drawWallSpikes();
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
      ctx.fillStyle = "rgba(67,67,67," + alpha + ")";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    } else if (platform.disappearing) {
      ctx.strokeStyle = "black";
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(platform.x, drawY, platform.width, platform.height);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "#333333";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    }
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (platform.width - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let col;
      switch(platform.powerup.type) {
        case "white": col = "white"; break;
        case "jump": col = "yellow"; break;
        case "lava": col = "green"; break;
        case "red": col = "black"; break;
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
    ctx.fillStyle = "black";
    ctx.fillRect(0, lavaScreenY, canvas.width, canvas.height - lavaScreenY);
  }
  
  lavaProjectiles.forEach(proj => {
    ctx.fillStyle = "black";
    ctx.fillRect(proj.x, proj.y - cameraOffset, projectileSize, projectileSize);
  });
}
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
      let powerupX = platform.x + (platform.width - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let powerupRect = { x: powerupX, y: powerupY, width: powerupWidth, height: powerupHeight };
      if (isColliding(playerRect, powerupRect)) {
        platform.powerup.collected = true;
        switch(platform.powerup.type) {
          case "white":
            whitePowerupEndTime = performance.now() + WHITE_DURATION;
            break;
          case "jump":
            jumpBoostEndTime = performance.now() + 3000;
            break;
          case "lava":
            lavaSlowEndTime = performance.now() + 5000;
            break;
          case "red":
            if (performance.now() < spikeImmunityUntil) break;
            gameOver = true;
            messageDiv.innerText = "You have been corrupted by an unknown object.";
            retryButton.style.display = "block";
            break;
          case "orange":
            player.y = lavaY - 20 - player.height;
            cameraOffset = player.y - canvas.height / 2;
            break;
          case "redorange":
            player.vy = -40;
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
        }
      }
    }
  });
  
  if (player.y + getPlayerRect().height > lavaY) {
    gameOver = true;
    messageDiv.innerText = "You were unable to escape. Better luck next time.";
    retryButton.style.display = "block";
  }
  if (player.y > cameraOffset + canvas.height) {
    gameOver = true;
    messageDiv.innerText = "Watch your step, fool.";
    retryButton.style.display = "block";
  }
  
  let playerRect2 = getPlayerRect();
  lavaProjectiles.forEach(proj => {
    let projRect = { x: proj.x, y: proj.y - cameraOffset, width: projectileSize, height: projectileSize };
    if (isColliding(playerRect2, projRect) && performance.now() >= redorangeInvincibilityUntil) {
      gameOver = true;
      messageDiv.innerText = "You have been corrupted by an unknown object.";
      retryButton.style.display = "block";
    }
  });
  
  // Check collision with permanent wall spikes
  if (player.x < coverWidth) {
    gameOver = true;
    messageDiv.innerText = "Never touch the walls, for the souls of the damned rest there.";
    retryButton.style.display = "block";
  }
  if (player.x + getPlayerRect().width > canvas.width - coverWidth) {
    gameOver = true;
    messageDiv.innerText = "Never touch the walls, for the souls of the damned rest there.";
    retryButton.style.display = "block";
  }
}

// --- Lighting Effects ---
// This function applies a 50% dark overlay over the entire canvas,
// then subtracts part of that overlay in a circular, radial gradient
// centered on the player. At the very center the full tint is removed,
// revealing the original (bright) background, while at the edges the tint remains.
function applyLightingEffects() {
  ctx.save();
  // Draw a full-canvas dark overlay at 50% opacity.
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Create a radial gradient to subtract the tint around the player.
  const lightRadius = 100; // Adjust for size of the aura.
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y - cameraOffset + player.height / 2;
  let gradient = ctx.createRadialGradient(playerCenterX, playerCenterY, 0, playerCenterX, playerCenterY, lightRadius);
  // At the center, subtract the full tint; at the edge, subtract none.
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.5)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(playerCenterX, playerCenterY, lightRadius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// --- Main Game Loop ---
let gameOver = false;
function gameLoop() {
  if (gameOver) return;
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
  
  // Draw game scene (platforms, spikes, player) with white powerup effect
  withWhitePowerupEffect(() => {
    drawPlatformsAndPowerups();
    drawSpikes();
    renderPlayer();
  });
  
  // Apply the aura lighting effect: the area around the player shows the original background.
  applyLightingEffects();
  
  // Draw the score text on top, so it isn’t darkened by the lighting effect.
  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText("Score: " + Math.floor(maxScore), 10, 30);
  ctx.fillText("High Score: " + Math.floor(globalHighScore), 10, 55);
  
  requestAnimationFrame(gameLoop);
}

// Player object and initialization
let player = {
  x: 0,
  y: 0,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  vx: 0,
  vy: 0
};

let jumpKeyHeld = false;
let jumpStartTime = 0;

resetGame();
