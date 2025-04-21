// --------------------------
// baby.js
// --------------------------

// Global Variables and Game Constants
let globalHighScore = 0;

// Powerup end times
let pinkPowerupEndTime = 0; 
let brownPowerupEndTime = 0; 
let whitePowerupEndTime = 0;
let jumpBoostEndTime = 0;  

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageDiv = document.getElementById("message");
const retryButton = document.getElementById("retryButton");

// Powerup durations
const PINK_DURATION = 5000;   // 5 seconds
const BROWN_DURATION = 5000;  // 5 seconds
const WHITE_DURATION = 10000; // 10 seconds

// Helper: returns 2 if pink powerup active, else 1.
const pinkMultiplier = () => performance.now() < pinkPowerupEndTime ? 2 : 1;
// Helper: Brown powerup check
const isBrownActive = () => performance.now() < brownPowerupEndTime;

// Base physics constants
const GRAVITY = 0.5;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 5;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 10;
const baseJumpStrength = -12;
const boostedJumpStrength = -16;
const HUGE_JUMP_STRENGTH = -40;

// Brown powerup effect multipliers
const BROWN_JUMP_MULTIPLIER = 0.75;
const BROWN_GRAVITY_MULTIPLIER = 1.25;

// Score & Camera
let baseY = 0;
let maxScore = 0;
let cameraOffset = 0;

// Player
let player = {
  x: 0,
  y: 0,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  vx: 0,
  vy: 0
};

// Variables for jump physics
let jumpKeyHeld = false;
let jumpStartTime = 0;

// Rare flash event data
let flashActive = false;
let flashStartTime = 0;
const FLASH_DURATION = 5000; // 5 seconds

// Preload the rare event image & audio
const flashImage = new Image();
flashImage.src = "dont_forget.png"; // Make sure this path is correct
const flashAudio = new Audio("lobotomy.mp3"); // Make sure this path is correct

// Platforms array
let platforms = [];

// For tracking ground contact
let isOnGround = false;

// Game Over flag
let gameOver = false;

// Easing functions (if needed for animations)
function easeOutQuad(t) {
  return t * (2 - t);
}
function easeInQuad(t) {
  return t * t;
}

// --------------------------
// Platform Generation
// --------------------------
function createPlatform(x, y) {
  let platform = {
    x: x,
    y: y,
    width: PLATFORM_WIDTH,
    height: PLATFORM_HEIGHT,
    moving: false,
    disappearing: false,
    disappearStartTime: null,
    powerup: null
  };
  let movingChance = globalHighScore >= 3000 ? 0.5 : 0.3;
  let disappearingChance = globalHighScore >= 3000 ? 0.4 : 0.2;

  // Possibly make platform move
  if (Math.random() < movingChance) {
    platform.moving = true;
    platform.moveSpeed = 1 + Math.random();
    platform.direction = Math.random() < 0.5 ? 1 : -1;
    platform.minX = Math.max(0, platform.x - 30);
    platform.maxX = Math.min(canvas.width - PLATFORM_WIDTH, platform.x + 30);
  }

  // Possibly make platform disappear
  if (Math.random() < disappearingChance) {
    platform.disappearing = true;
  }

  // Assign powerups with ~20% chance
  if (Math.random() < 0.2) {
    let r = Math.random();
    if (r < 0.05) {
      platform.powerup = { type: "white", collected: false };
    } else if (r < 0.05 + 0.125) {
      platform.powerup = { type: "jump", collected: false };
    } else if (r < 0.05 + 0.125 + 0.075) {
      platform.powerup = { type: "redorange", collected: false };
    } else if (r < 0.05 + 0.125 + 0.075 + 0.075) {
      platform.powerup = { type: "cyan", collected: false };
    } else if (r < 0.05 + 0.125 + 0.075 + 0.075 + 0.1) {
      platform.powerup = { type: "purple", collected: false };
    } else if (r < 0.05 + 0.125 + 0.075 + 0.075 + 0.1 + 0.05) {
      platform.powerup = { type: "darkblue", collected: false };
    } else if (r < 0.05 + 0.125 + 0.075 + 0.075 + 0.1 + 0.05 + 0.1) {
      platform.powerup = { type: "pink", collected: false };
    } else {
      platform.powerup = { type: "brown", collected: false };
    }
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
    powerup: null
  };
  platforms.push(spawnPlatform);

  let highestPlatformY = startPlatformY;
  for (let i = 0; i < 15; i++) {
    let gapY = 30 + Math.random() * 40;
    let newY = highestPlatformY - gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
    highestPlatformY = newY;
  }
}

function generatePlatformsIfNeeded() {
  let highestPlatformY = Math.min(...platforms.map(p => p.y));
  while (highestPlatformY > cameraOffset - 100) {
    let gapY = 30 + Math.random() * 40;
    let newY = highestPlatformY - gapY;
    let newX = Math.random() * (canvas.width - PLATFORM_WIDTH);
    platforms.push(createPlatform(newX, newY));
    highestPlatformY = newY;
  }
}

// --------------------------
// Teleport for Purple Powerup
// --------------------------
function teleportPlayerUpwards(currentPlatform) {
  let platformsAbove = platforms.filter(p => p.y < currentPlatform.y);
  if (platformsAbove.length === 0) return;

  // Sort from highest to lowest
  platformsAbove.sort((a, b) => b.y - a.y);
  let targetIndex = 6;
  while (
    targetIndex < platformsAbove.length &&
    platformsAbove[targetIndex].powerup &&
    !platformsAbove[targetIndex].powerup.collected
  ) {
    targetIndex++;
  }
  let targetPlatform = targetIndex < platformsAbove.length
    ? platformsAbove[targetIndex]
    : platformsAbove[platformsAbove.length - 1];

  if (targetPlatform) {
    player.x = targetPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
    player.y = targetPlatform.y - PLAYER_HEIGHT;
    cameraOffset = player.y - canvas.height / 2;
    console.log("Teleported to platform at y:", targetPlatform.y);
  }
}

// --------------------------
// Reset Game
// --------------------------
function resetGame() {
  gameOver = false;
  messageDiv.innerText = "";
  retryButton.style.display = "none";

  // Reset powerup timers
  jumpBoostEndTime = 0;
  pinkPowerupEndTime = 0;
  brownPowerupEndTime = 0;
  whitePowerupEndTime = 0;

  generateInitialPlatforms();
  let startPlatform = platforms[0];
  player.x = startPlatform.x + (PLATFORM_WIDTH - PLAYER_WIDTH) / 2;
  player.y = startPlatform.y - PLAYER_HEIGHT;
  player.vx = 0;
  player.vy = 0;
  baseY = startPlatform.y;
  maxScore = 0;
  cameraOffset = player.y - canvas.height / 2;

  requestAnimationFrame(gameLoop);
}

retryButton.addEventListener("click", resetGame);

// --------------------------
// Input Handling
// --------------------------
let keys = {};
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  keys[key] = true;

  // Jump initiation
  if ((key === "w" || e.key === " " ) && isOnGround && !jumpKeyHeld) {
    jumpKeyHeld = true;
    jumpStartTime = performance.now();
    let jumpStrength = (performance.now() < jumpBoostEndTime)
      ? boostedJumpStrength
      : baseJumpStrength;

    // If moving sideways, slightly stronger jump
    if (keys["a"] || keys["arrowleft"] || keys["d"] || keys["arrowright"]) {
      jumpStrength *= 1.2;
    }
    // Brown powerup reduces jump
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
  if (key === "w" || e.key === " ") {
    jumpKeyHeld = false;
  }
});

// --------------------------
// Collision Detection
// --------------------------
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
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

// --------------------------
// Update Functions
// --------------------------
function updatePlayerMovement() {
  let speedMultiplier = pinkMultiplier();
  if (isBrownActive()) {
    speedMultiplier *= 0.75;
  }

  if (keys["a"] || keys["arrowleft"]) {
    player.vx = -PLAYER_SPEED * speedMultiplier;
  } else if (keys["d"] || keys["arrowright"]) {
    player.vx = PLAYER_SPEED * speedMultiplier;
  } else {
    player.vx = 0;
  }

  player.vy += GRAVITY * (isBrownActive() ? BROWN_GRAVITY_MULTIPLIER : 1) * speedMultiplier;

  // If jump key not held, apply extra gravity while rising
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
      platform.x += platform.moveSpeed * platform.direction * speedMultiplier;
      if (platform.x <= platform.minX || platform.x >= platform.maxX) {
        platform.direction *= -1;
      }
    }
  });

  // Remove fully disappeared platforms
  platforms = platforms.filter(platform => {
    if (platform.disappearing && platform.disappearStartTime !== null) {
      return (performance.now() - platform.disappearStartTime < 2000);
    }
    return true;
  });
}

// Inversion effect for white powerup
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

function drawPlatformsAndPowerups() {
  platforms.forEach(platform => {
    let drawY = platform.y - cameraOffset;

    // Disappearing platform style
    if (platform.disappearing) {
      ctx.strokeStyle = "black";
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(platform.x, drawY, platform.width, platform.height);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "saddlebrown";
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);
    }

    // Powerup
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (PLATFORM_WIDTH - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let col;
      switch(platform.powerup.type) {
        case "white":     col = "white";     break;
        case "jump":      col = "yellow";    break;
        case "redorange": col = "orangered"; break;
        case "cyan":      col = "cyan";      break;
        case "purple":    col = "purple";    break;
        case "darkblue":  col = "darkblue";  break;
        case "pink":      col = "pink";      break;
        case "brown":     col = "brown";     break;
        default:          col = "white";
      }
      ctx.fillStyle = col;
      ctx.fillRect(powerupX, powerupY, powerupWidth, powerupHeight);
    }
  });
}

function renderPlayer() {
  let now = performance.now();
  let playerColor = "blue";
  if (now < jumpBoostEndTime) {
    playerColor = "orange";
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

// --------------------------
// Collision & Powerup Handling
// --------------------------
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

    // Landing on a platform from above
    if (isColliding(playerRect, platformRect)) {
      if (player.vy >= 0 && prevY + playerRect.height <= platform.y + 5) {
        // Adjust player position to platform top
        player.y = platform.y - (isBrownActive() ? player.height * 1.25 : player.height);
        player.vy = 0;
        isOnGround = true;

        // If platform is disappearing, start the timer
        if (platform.disappearing && platform.disappearStartTime === null) {
          // Brown powerup accelerates disappearance
          platform.disappearStartTime = isBrownActive()
            ? performance.now() - 2000
            : performance.now();
        }
      }
    }

    // Powerup collection
    if (platform.powerup && !platform.powerup.collected) {
      let powerupWidth = 15, powerupHeight = 15;
      let powerupX = platform.x + (PLATFORM_WIDTH - powerupWidth) / 2;
      let powerupY = platform.y - powerupHeight - 2 - cameraOffset;
      let powerupRect = {
        x: powerupX,
        y: powerupY,
        width: powerupWidth,
        height: powerupHeight
      };
      if (isColliding(playerRect, powerupRect)) {
        platform.powerup.collected = true;
        switch(platform.powerup.type) {
          case "jump":
            jumpBoostEndTime = performance.now() + 3000;
            break;
          case "redorange":
            player.vy = HUGE_JUMP_STRENGTH;
            break;
          case "cyan":
            // If you have a damage system, you could grant invincibility
            break;
          case "purple":
            teleportPlayerUpwards(platform);
            break;
          case "darkblue":
            // Possibly trigger some effect, like a screen shake
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

  // Falling off bottom of screen
  if (player.y > cameraOffset + canvas.height) {
    gameOver = true;
    messageDiv.innerText = "Aw, poor baby! Shh, don't cry now.";
    retryButton.style.display = "block";
  }
}

// --------------------------
// Rare Jump-Scare Feature
// --------------------------
function tryFlashEvent() {
  // 1 in 1 trillion chance
  if (!flashActive && Math.random() < 1e-12) {
    flashActive = true;
    flashStartTime = performance.now();

    // Start the audio
    flashAudio.currentTime = 0;
    flashAudio.play();
  }
}

// Draw the jump-scare overlay if active
function drawFlashOverlay() {
  // If flash is active, fill the canvas with black, then draw the image
  let timeSinceFlash = performance.now() - flashStartTime;
  if (timeSinceFlash <= FLASH_DURATION) {
    // Draw black background over the entire canvas
    ctx.save();
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the scary image in the center
    // We'll size it to fit roughly within the canvas
    let imgWidth = canvas.width * 0.8;
    let imgHeight = canvas.height * 0.8;
    let xPos = (canvas.width - imgWidth) / 2;
    let yPos = (canvas.height - imgHeight) / 2;
    ctx.drawImage(flashImage, xPos, yPos, imgWidth, imgHeight);
    ctx.restore();
  } else {
    // Past the 5-second mark, end the flash
    flashActive = false;
    flashAudio.pause();
  }
}

// --------------------------
// Main Game Loop
// --------------------------
function gameLoop() {
  if (gameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update
  updatePlayerMovement();
  updatePlatforms();
  handleCollisions();
  generatePlatformsIfNeeded();

  // Update camera
  cameraOffset = Math.min(player.y - canvas.height / 2, cameraOffset);

  // Score
  let currentHeight = baseY - player.y;
  if (currentHeight > maxScore) {
    maxScore = currentHeight;
  }
  globalHighScore = Math.max(globalHighScore, maxScore);

  // Attempt the rare jump-scare
  tryFlashEvent();

  // Normal rendering if flash is not covering the screen
  withWhitePowerupEffect(() => {
    drawPlatformsAndPowerups();
    renderPlayer();
    ctx.fillStyle = "black";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + Math.floor(maxScore), 10, 30);
    ctx.fillText("High Score: " + Math.floor(globalHighScore), 10, 55);
  });

  // If a flash event is active, draw the overlay on top
  if (flashActive) {
    drawFlashOverlay();
  }

  requestAnimationFrame(gameLoop);
}

// Start the game
resetGame();
