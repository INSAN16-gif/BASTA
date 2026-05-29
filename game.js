// Detect orientation changes
window.addEventListener("orientationchange", function() {
    // Small delay to allow browser to calculate new dimensions
    setTimeout(() => {
        window.location.reload(); 
    }, 500);
});

// Also check resize for desktop window resizing
window.addEventListener("resize", function() {
    if (window.innerWidth < 900 && window.innerHeight > window.innerWidth) {
        // Portrait mode logic
    }
});


function playSfx(id) {
    const audio = document.getElementById(id);
    audio.currentTime = 0;
    audio.play().catch(e => console.log("SFX play failed:", e));
}
// Add this to your game.js
function setupButtonControls() {
    // Map button IDs to the keyboard event keys your game uses
    const controls = {
        'up': 'ArrowUp',
        'down': 'ArrowDown',
        'left': 'ArrowLeft',
        'right': 'ArrowRight'
    };

    // Helper to simulate key presses
    const pressKey = (key, isDown) => {
        // Assuming your game uses a 'keys' object to track movement
        // If your game uses different logic, replace 'keys[key] = isDown' 
        // with your specific movement function
        if (typeof keys !== 'undefined') {
            keys[key] = isDown;
        }
    };

    // Attach listeners for each D-pad button
    Object.keys(controls).forEach(id => {
        const btn = document.getElementById(id);
        
        // Handle touch and mouse events for better compatibility
        ['mousedown', 'touchstart'].forEach(evt => {
            btn.addEventListener(evt, (e) => {
                e.preventDefault();
                pressKey(controls[id], true);
            });
        });

        ['mouseup', 'mouseleave', 'touchend'].forEach(evt => {
            btn.addEventListener(evt, (e) => {
                e.preventDefault();
                pressKey(controls[id], false);
            });
        });
    });

    // Bomb Button handler
    const bombBtn = document.getElementById('bombBtn');
    bombBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Call your existing plantBomb function here
        if (typeof plantBomb === 'function') {
            plantBomb(); 
        }
    });
}

// Call this once your game initializes
setupButtonControls();


// Function for dynamic viewport adjustments
function resizeGameViewport() {
    const wrapper = document.getElementById("gameWrapper");
    const paddingValue = 20; 
    const targetWidth = 608; 
    const availableWidth = window.innerWidth - paddingValue;

    if (availableWidth < targetWidth) {
        const scaleFactor = availableWidth / targetWidth;
        wrapper.style.transform = `scale(${scaleFactor})`;
    } else {
        wrapper.style.transform = `scale(1)`;
    }
}

window.addEventListener("resize", resizeGameViewport);
window.addEventListener("orientationchange", resizeGameViewport);
document.addEventListener("DOMContentLoaded", resizeGameViewport);

// CORE GAME CANVAS & INTERFACE LINKS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const monitorCanvas = document.getElementById("monitorCanvas");
const monitorCtx = monitorCanvas.getContext("2d");

const timerText = document.getElementById("timerDisplay");
const endScreen = document.getElementById("endScreen");
const endStatusText = document.getElementById("endStatusText");
const endScoreText = document.getElementById("endScoreText");
// Ensure buttons always point to the initGame function
document.getElementById("btnHeaderRetry").addEventListener("click", () => {
    initGame();
});

document.getElementById("btnTryAgain").addEventListener("click", () => {
    initGame();
});

const statSpeed = document.getElementById("statSpeed");
const statBombs = document.getElementById("statBombs");
const statFire = document.getElementById("statFire");
const statBossHp = document.getElementById("statBossHp");

const TILE_SIZE = 32; 
const GRID_W = 19;
const GRID_H = 14; 

const T_EMPTY = 0;
const T_WALL = 1;      
const T_OBSTACLE = 2;  
const T_PADLOCK = 3;   
const T_EXIT = 4;      

const P_SPEED = 1;
const P_BOMB = 2;
const P_FIRE = 3;

let cachedBossFrame = null;
let bossTrail = [];
let grid = [];
let itemsGrid = []; 
let player = {};
let enemies = [];
let bombs = [];
let explosions = [];

let boss = null;

let gameStarted = false;
let startTime = 0;
let elapsedRaceTime = 0;
let isGameOver = false;

let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

let cachedFrame = null;
let lastFrameTime = 0;

const CACHE_INTERVAL = 30; // Only re-process every 30ms (approx 30fps)
// CHROMA KEY PROCESSING OFFSCREEN ENGINE
const chromaCanvas = document.createElement("canvas");
const chromaCtx = chromaCanvas.getContext("2d");

// Helper function to remove green screen channels dynamically
function getChromaKeyedFrame(sourceElement, width, height) {
    chromaCanvas.width = width;
    chromaCanvas.height = height;
    // Currently you have this in drawGame():
    // Draw raw current visual frame
    chromaCtx.drawImage(sourceElement, 0, 0, width, height);
    
    try {
        const frame = chromaCtx.getImageData(0, 0, width, height);
        const data = frame.data;
        
        // Loop through pixels: Red = data[i], Green = data[i+1], Blue = data[i+2], Alpha = data[i+3]
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // If the pixel is predominantly green, make it fully transparent
            if (g > 105 && g > r * 1.2 && g > b * 1.2) {
                data[i + 3] = 0; 
            }
        }
        chromaCtx.putImageData(frame, 0, 0);
    } catch (e) {
        // Fallback safety filter if local browser blocks image data read
    }
    return chromaCanvas;
}

const MAP_TEMPLATE = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
    [2,1,2,1,0,0,0,1,1,1,0,1,0,0,0,1,0,0,0], 
    [2,1,0,1,0,1,1,1,0,0,0,1,0,1,1,1,0,0,0], 
    [2,1,0,1,0,0,0,1,0,1,1,1,0,0,0,1,0,0,0], 
    [2,0,0,1,1,1,0,1,0,0,0,1,1,1,0,1,0,0,0], 
    [2,1,0,1,0,0,0,1,1,1,0,1,0,0,0,1,0,0,0], 
    [2,1,0,1,0,1,1,1,0,0,0,1,0,1,1,1,0,0,0], 
    [2,1,0,1,0,0,0,1,0,1,1,1,0,0,0,1,0,0,0], 
    [2,1,0,1,1,1,0,1,0,0,0,1,1,1,0,1,0,0,0], 
    [0,0,0,1,0,0,0,1,1,1,0,1,0,0,0,1,0,0,0], 
    [0,1,0,1,0,1,1,1,0,0,0,1,0,1,1,1,0,0,0], 
    [0,1,0,1,0,0,0,1,0,1,1,1,0,0,0,1,0,0,0], 
    [0,1,0,1,1,1,0,1,0,0,0,1,1,1,0,1,0,1,1], 
    [0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,0,3,4]  
];

function initGame() {
    // 1. Reset Game State
    isGameOver = false;
    gameStarted = false;
    player.hasWon = false;
    elapsedRaceTime = 0;
    
    // 2. Hide UI
    document.getElementById("endScreen").style.display = "none";
    timerText.innerText = "0.00s";
    
    // 3. Reset Game Entities
    bombs = [];
    explosions = [];
    enemies = [];
    grid = [];
    itemsGrid = [];

    // 4. Initialize Canvas
    canvas.width = GRID_W * TILE_SIZE;
    canvas.height = GRID_H * TILE_SIZE;

    // 5. Build Grid
    for (let r = 0; r < GRID_H; r++) {
        grid[r] = [...MAP_TEMPLATE[r]];
        itemsGrid[r] = new Array(GRID_W).fill(T_EMPTY);
    }

    // 6. Setup Items
    let obstaclePositions = [];
    for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
            if (grid[r][c] === T_OBSTACLE) obstaclePositions.push({r, c});
        }
    }
    obstaclePositions.sort(() => Math.random() - 0.5);
    
    if (obstaclePositions.length >= 8) {
        itemsGrid[obstaclePositions[0].r][obstaclePositions[0].c] = P_SPEED;
        itemsGrid[obstaclePositions[1].r][obstaclePositions[1].c] = P_SPEED;
        itemsGrid[obstaclePositions[2].r][obstaclePositions[2].c] = P_SPEED;
        itemsGrid[obstaclePositions[3].r][obstaclePositions[3].c] = P_BOMB;
        itemsGrid[obstaclePositions[4].r][obstaclePositions[4].c] = P_BOMB;
        itemsGrid[obstaclePositions[5].r][obstaclePositions[5].c] = P_BOMB;
        itemsGrid[obstaclePositions[6].r][obstaclePositions[6].c] = P_FIRE;
        itemsGrid[obstaclePositions[7].r][obstaclePositions[7].c] = P_FIRE;
    }

    // 7. Reset Player/Boss
    player = { x: 3, y: 3, size: 23, renderSize: 54, speed: 7.2, maxBombs: 1, fireRange: 1, hasWon: false };
    enemies = [
        { x: 17*TILE_SIZE+4, y: 0*TILE_SIZE+4, size: 22, speed: 1.2, dirX: 1, dirY: 0, type: 'red' },
        { x: 7*TILE_SIZE+4, y: 1*TILE_SIZE+4, size: 22, speed: 1.2, dirX: 0, dirY: 1, type: 'red' },
        { x: 13*TILE_SIZE+4, y: 2*TILE_SIZE+4, size: 22, speed: 1.2, dirX: -1, dirY: 0, type: 'red' },
        { x: 0*TILE_SIZE+4, y: 6*TILE_SIZE+4, size: 22, speed: 1.5, dirX: 1, dirY: 0, type: 'purple' },
        { x: 7*TILE_SIZE+4, y: 6*TILE_SIZE+4, size: 22, speed: -1.2, dirY: 0, type: 'purple' },
        { x: 6*TILE_SIZE+4, y: 8*TILE_SIZE+4, size: 22, speed: 1.8, dirX: 1, dirY: 0, type: 'pink' },
        { x: 16*TILE_SIZE+4, y: 10*TILE_SIZE+4, size: 22, speed: 1.8, dirX: 0, dirY: -1, type: 'pink' }
    ];
    boss = { x: 16*TILE_SIZE+2, y: 12*TILE_SIZE+2, size: 28, baseSpeed: 0.9, speed: 0.9, hp: 1, maxHp: 10, dirX: -1, dirY: 0, lastBombDropped: 0, bombCooldown: 3000, lastFlameShot: 0, flameCooldown: 5000, isEscaping: false, escapeTimer: 0 };

    updateUiStats();
    setTimeout(resizeGameViewport, 50);
}

function updateUiStats() {
    statSpeed.innerText = player.speed.toFixed(1);
    statBombs.innerText = player.maxBombs;
    statFire.innerText = player.fireRange;
    
    // Explicitly set the text. Ensure the container has enough space.
    if (boss) {
        statBossHp.innerText = `${boss.hp}/${boss.maxHp}`;
    } else {
        statBossHp.innerText = "DEFEATED"; 
    }
}

function triggerStart() {
    if (!gameStarted && !isGameOver && !player.hasWon) {
        gameStarted = true;
        startTime = Date.now();
    }
}

function plantBomb(owner = 'player') {
    if (isGameOver || player.hasWon) return;
    triggerStart();

    let targetX, targetY, range, duration;

    if (owner === 'player') {
        let activePlayerBombs = bombs.filter(b => b.owner === 'player').length;
        if (activePlayerBombs >= player.maxBombs) return;

        targetX = Math.floor((player.x + player.size / 2) / TILE_SIZE);
        targetY = Math.floor((player.y + player.size / 2) / TILE_SIZE);
        range = player.fireRange;
        duration = 2000;
        playSfx("sfxPlaceBomb");
    } else if (owner === 'boss' && boss) {
        targetX = Math.floor((boss.x + boss.size / 2) / TILE_SIZE);
        targetY = Math.floor((boss.y + boss.size / 2) / TILE_SIZE);
        range = 2; 
        duration = 2000;
    }

    let existing = bombs.find(b => b.gridX === targetX && b.gridY === targetY);
    if (existing) return;

    bombs.push({
        gridX: targetX,
        gridY: targetY,
        placedAt: Date.now(),
        duration: duration,
        range: range,
        owner: owner,
        isJustPlaced: true // Add this flag
    
    });
}

window.addEventListener("keydown", (e) => {
    if (e.key in keys) { triggerStart(); keys[e.key] = true; e.preventDefault(); }
    if (e.key === " " || e.code === "Space") { plantBomb('player'); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => { if (e.key in keys) keys[e.key] = false; });

function isColliding(x, y, size, entityType = 'other') {
    // 1. Map boundaries and static walls
    let corners = [
        {x: x, y: y}, 
        {x: x + size, y: y}, 
        {x: x, y: y + size}, 
        {x: x + size, y: y + size}
    ];

    for (let pt of corners) {
        let gX = Math.floor(pt.x / TILE_SIZE);
        let gY = Math.floor(pt.y / TILE_SIZE);
        if (gX < 0 || gX >= GRID_W || gY < 0 || gY >= GRID_H) return true;
        let tile = grid[gY][gX];
        if (tile === T_WALL || tile === T_OBSTACLE || tile === T_PADLOCK) return true;
    }

    // 2. Bomb Collision
if (entityType === 'player') {
    let pCenterX = x + size / 2;
    let pCenterY = y + size / 2;
    let pGridX = Math.floor(pCenterX / TILE_SIZE);
    let pGridY = Math.floor(pCenterY / TILE_SIZE);

    for (let bomb of bombs) {
        // 1. Check if the player is leaving the tile
        if (pGridX !== bomb.gridX || pGridY !== bomb.gridY) {
            bomb.isJustPlaced = false; 
        }

        // 2. ONLY bypass collision if the bomb is strictly 'isJustPlaced'
        // If it's NOT 'isJustPlaced', we perform the distance check no matter where the player is
        if (!bomb.isJustPlaced) {
            let bCenterX = bomb.gridX * TILE_SIZE + TILE_SIZE / 2;
            let bCenterY = bomb.gridY * TILE_SIZE + TILE_SIZE / 2;
            let dist = Math.sqrt(Math.pow(pCenterX - bCenterX, 2) + Math.pow(pCenterY - bCenterY, 2));

            if (dist < 16) return true;
        }
    }
}
    return false;
}

function checkRectOverlap(r1, r2) {
    return (r1.x < r2.x + r2.size && r1.x + r1.size > r2.x &&
            r1.y < r2.y + r2.size && r1.y + r1.size > r2.y);
}

function checkExplosionHarm(explosionCells) {
    for (let cell of explosionCells) {
        let expRect = { x: cell.x * TILE_SIZE, y: cell.y * TILE_SIZE, size: TILE_SIZE };
        
        if (!isGameOver && checkRectOverlap(player, expRect)) {
            isGameOver = true;
            showEndScreen(false, "Naputukan ka!😟😟😟😟😟");
            return;
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            if (checkRectOverlap(enemies[i], expRect)) {
                enemies.splice(i, 1);
            }

        }
        if (boss && checkRectOverlap(boss, expRect)) {
    // Reduce boss HP
    boss.hp -= 1;
    updateUiStats()
        }
    }
}

function showEndScreen(wonStatus, textDescription) {
    gameStarted = false;
    endScreen.style.display = "flex";
    
    // Stop the movement sound immediately upon game over
    document.getElementById("sfxMove").pause();
    document.getElementById("sfxMove").currentTime = 0;

    // Play defeat sound if the player lost
    if (!wonStatus) {
        setTimeout(() => {
        playSfx("sfxDefeat");
        }, 300);
    }

    if (wonStatus) {
        playSfx("sfxVictory");
        endStatusText.innerText = "VICTORY!";
        endStatusText.style.color = "#39ff14";
        endScoreText.innerText = "Cleared in: " + elapsedRaceTime.toFixed(2) + "s";
    } else {
        endStatusText.innerText = "GAME OVER";
        endStatusText.style.color = "#ff3333";
        endScoreText.innerText = textDescription;
    }
}

function checkBombChainReactions() {
    for (let i = 0; i < explosions.length; i++) {
        let expo = explosions[i];
        for (let cell of expo.cells) {
            for (let j = bombs.length - 1; j >= 0; j--) {
                let b = bombs[j];
                if (b.gridX === cell.x && b.gridY === cell.y) {
                    let targetedBomb = bombs.splice(j, 1)[0];
                    explode(targetedBomb);
                }
            }
        }
    }
}
function explodeBoss(bomb) {
    console.log("Boss bomb exploding in 5x5 square!");
    let cells = [];
    const range = 2; // Fixed range for 5x5 area

    // Loop through a 5x5 square
    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            let tx = bomb.gridX + dx;
            let ty = bomb.gridY + dy;

            if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                cells.push({x: tx, y: ty});
                if (grid[ty][tx] === T_OBSTACLE) {
                    grid[ty][tx] = T_EMPTY;
                }
            }
        }
    }
    explosions.push({cells: cells, placedAt: Date.now()});
    playSfx("sfxExplosion");
}
function explode(bomb) {
    // 1. Create a list of affected cells, starting with the center
    let cells = [{x: bomb.gridX, y: bomb.gridY}];

    // 2. Define the directions (Up, Down, Left, Right)
    const dirs = [{x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}];

    // 3. Expand the explosion based on range
    for (let dir of dirs) {
        for (let i = 1; i <= bomb.range; i++) {
            let tx = bomb.gridX + (dir.x * i);
            let ty = bomb.gridY + (dir.y * i);

            // Boundary check
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;

            // Stop if it hits a wall
            if (grid[ty][tx] === T_WALL) break;

            // Add cell to explosion
            cells.push({x: tx, y: ty});

            // Stop if it hits an obstacle (and destroy the obstacle)
            if (grid[ty][tx] === T_OBSTACLE) {
                grid[ty][tx] = T_EMPTY;
                break; 
            }
        }
    }

    // 4. Register the explosion and play sound
    explosions.push({cells: cells, placedAt: Date.now()});
    playSfx("sfxExplosion"); // Make sure you have an audio element with this ID
}

function isBombNearby(boss, range) {
    for (let bomb of bombs) {
        let dist = Math.abs(bomb.gridX - Math.floor((boss.x + boss.size/2) / TILE_SIZE)) + 
                   Math.abs(bomb.gridY - Math.floor((boss.y + boss.size/2) / TILE_SIZE));
        if (dist <= range) return true;
    }
    return false;
}

function updateGame() {
    if (isGameOver || player.hasWon) return;

    // --- BOSS DEFEAT LOGIC (SINGLE RUNNER) ---
    if (boss && boss.hp <= 0) {
        // 1. Open the walls exactly once
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] === T_PADLOCK) { 
                    grid[r][c] = T_EMPTY; 
                }
            }
        }
        // 2. Kill the boss object so it never runs again
        boss = null; 
        updateUiStats();
        return; // EXIT here so the rest of the logic doesn't crash
    }

    // --- SOUND LOGIC ---
    // --- SOUND LOGIC ---
const moveSfx = document.getElementById("sfxMove");
let isMoving = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;

// Only perform actions if the state of movement has changed
if (isMoving && moveSfx.paused) {
    // We just started moving
    moveSfx.play().catch(e => console.log("Audio play blocked:", e));
} else if (!isMoving && !moveSfx.paused) {
    // We just stopped moving
    moveSfx.pause();
    moveSfx.currentTime = 0;
}

    // --- TIMER ---
    let now = Date.now();
    if (gameStarted) {
        elapsedRaceTime = (now - startTime) / 1000;
        timerText.innerText = elapsedRaceTime.toFixed(2) + "s";
    }

   // --- PLAYER MOVEMENT ---
    let nextX = player.x;
    let nextY = player.y;

    if (keys.ArrowUp)    nextY -= player.speed;
    if (keys.ArrowDown)  nextY += player.speed;
    
    // Check Y-axis collision first
    if (!isColliding(player.x, nextY, player.size, 'player')) {
        player.y = nextY;
    }

    if (keys.ArrowLeft)  nextX -= player.speed;
    if (keys.ArrowRight) nextX += player.speed;

    // Check X-axis collision second
    if (!isColliding(nextX, player.y, player.size, 'player')) {
        player.x = nextX;
    }
    // --- COLLISION & ITEMS ---
    let pGridX = Math.floor((player.x + player.size/2) / TILE_SIZE);
    let pGridY = Math.floor((player.y + player.size/2) / TILE_SIZE);
    
    if (pGridX >= 0 && pGridX < GRID_W && pGridY >= 0 && pGridY < GRID_H) {
        let activeItem = itemsGrid[pGridY][pGridX];
        if (grid[pGridY][pGridX] === T_EMPTY && activeItem !== T_EMPTY) {
            if (activeItem === P_SPEED) player.speed += 0.4;
            if (activeItem === P_BOMB) player.maxBombs += 1;
            if (activeItem === P_FIRE) player.fireRange += 1;
            itemsGrid[pGridY][pGridX] = T_EMPTY; 
            updateUiStats();
        }
        if (grid[pGridY][pGridX] === T_EXIT) {
            player.hasWon = true;
            showEndScreen(true, "");
            return;
        }
    }

   // --- BOMB & EXPLOSION PROCESSING ---
    for (let i = bombs.length - 1; i >= 0; i--) {
        let b = bombs[i];
        if (now - b.placedAt > b.duration) {
            bombs.splice(i, 1); // Remove bomb from array
            
            // Check who owns the bomb and trigger the correct explosion type
            if (b.owner === 'boss') {
                explodeBoss(b);
            } else {
                explode(b);
            }
        }
    }
    
    for (let i = explosions.length - 1; i >= 0; i--) {
        if (now - explosions[i].placedAt > 400) {
            explosions.splice(i, 1);
        } else {
            checkExplosionHarm(explosions[i].cells);
        }
    }
    checkBombChainReactions();

    // --- ENEMY AI ---
    for (let enemy of enemies) {
        enemy.x += enemy.dirX * enemy.speed;
        enemy.y += enemy.dirY * enemy.speed;
        if (isColliding(enemy.x, enemy.y, enemy.size)) {
            enemy.x -= enemy.dirX * enemy.speed;
            enemy.y -= enemy.dirY * enemy.speed;
            let newDir = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}][Math.floor(Math.random() * 4)];
            enemy.dirX = newDir.x; enemy.dirY = newDir.y;
        }
        if (checkRectOverlap(player, enemy)) {
            isGameOver = true;
            showEndScreen(false, "Eliminated!");
            return;
        }
    }
    // --- BOSS AI (Only runs if boss is not null) ---
    if (boss) {
        bossTrail.push({x: boss.x, y: boss.y});
        if (bossTrail.length > 10) bossTrail.shift();

        if (boss.isEscaping && now > boss.escapeTimer) {
            boss.isEscaping = false;
            boss.speed = boss.baseSpeed;
        }

        let bossGridX = Math.floor((boss.x + boss.size/2) / TILE_SIZE);
        let bossGridY = Math.floor((boss.y + boss.size/2) / TILE_SIZE);
        let distToPlayerX = Math.abs(pGridX - bossGridX);
        let distToPlayerY = Math.abs(pGridY - bossGridY);

        if (!boss.isEscaping && distToPlayerX <= 1 && distToPlayerY <= 1 && (now - boss.lastBombDropped > boss.bombCooldown)) {
            plantBomb('boss');
            boss.lastBombDropped = now;
            boss.speed = boss.baseSpeed * 8.5; 
            boss.isEscaping = true;
            boss.escapeTimer = now + 1200; 
            boss.dirX = (bossGridX > pGridX) ? 1 : -1;
            boss.dirY = (bossGridY > pGridY) ? 1 : -1;
        }
        if (isBombNearby(boss, 2)) {
        boss.isEscaping = true;
        boss.speed = boss.baseSpeed * 5.5; // Speed boost to escape
        boss.escapeTimer = now + 1500;    // Escape for 1.5 seconds
        
    }

        boss.x += boss.dirX * boss.speed;
        boss.y += boss.dirY * boss.speed;

        if (isColliding(boss.x, boss.y, boss.size, 'boss')) {
            boss.x -= boss.dirX * boss.speed;
            boss.y -= boss.dirY * boss.speed;
            let randDir = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}][Math.floor(Math.random() * 4)];
            boss.dirX = randDir.x; boss.dirY = randDir.y;
        }

        if (checkRectOverlap(player, boss)) {
            isGameOver = true;
            showEndScreen(false, "Crushed by the Boss!");
        }
    }
   
}
function drawGame() {
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map Floor Tiles
    for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
            let xPos = c * TILE_SIZE;
            let yPos = r * TILE_SIZE;
            // ... at the very end of drawGame(), before the final closing brace:

            ctx.fillStyle = ((r + c) % 2 === 0) ? "#111118" : "#141420";
            ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "#1b1b26";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
        }
    }
    // Obstacles and Walls Layer
    for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
            let tile = grid[r][c];
            let xPos = c * TILE_SIZE;
            let yPos = r * TILE_SIZE;

            if (tile === T_WALL) {
               // 1. Concrete Base
    ctx.fillStyle = "#3a3a3a"; 
    ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);

    // 2. Heavy Border (Reinforced edges)
    ctx.strokeStyle = "#252525";
    ctx.lineWidth = 4;
    ctx.strokeRect(xPos + 2, yPos + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // 3. Texture Detail (A few "scratches" or grain)
    ctx.strokeStyle = "#505050";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPos + 5, yPos + 5);
    ctx.lineTo(xPos + TILE_SIZE - 5, yPos + TILE_SIZE - 5);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(xPos + TILE_SIZE - 5, yPos + 5);
    ctx.lineTo(xPos + 5, yPos + TILE_SIZE - 5);
    ctx.stroke();
            } else if (tile === T_OBSTACLE) {
                // 1. Base color (Darker brick red)
    ctx.fillStyle = "#8b3a3a"; 
    ctx.fillRect(xPos + 1, yPos + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // 2. Add "Brick" Lines
    ctx.strokeStyle = "#4a1f1f"; // Dark grout color
    ctx.lineWidth = 2;
    
    // Draw horizontal mortar line
    ctx.beginPath();
    ctx.moveTo(xPos + 1, yPos + TILE_SIZE / 2);
    ctx.lineTo(xPos + TILE_SIZE - 1, yPos + TILE_SIZE / 2);
    ctx.stroke();

    // Draw vertical mortar line (offset to look like stacked bricks)
    ctx.beginPath();
    ctx.moveTo(xPos + TILE_SIZE / 2, yPos + 2);
    ctx.lineTo(xPos + TILE_SIZE / 2, yPos + TILE_SIZE - 2);
    ctx.stroke();

    // 3. Highlight (gives it a 3D blocky feel)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(xPos + 2, yPos + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            } else if (tile === T_PADLOCK) {
                ctx.fillStyle = "#2b1010";
                ctx.fillRect(xPos + 1, yPos + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                ctx.strokeStyle = "#ff3333";
                ctx.strokeRect(xPos + 2, yPos + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            } else if (tile === T_EXIT) {
                ctx.fillStyle = "#0044ff";
                ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            }

            let item = itemsGrid[r][c];
            if (tile === T_EMPTY && item !== T_EMPTY) {
                // 1. SET THE GLOW PROPERTIES
    ctx.shadowBlur = 10; // The "spread" of the glow
    ctx.shadowColor = "#ffffff"; // The color of the glow
                ctx.font = "bold 24px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
            if (item === P_SPEED) { 
        ctx.shadowColor = "#39ff14"; // Green glow for speed
        ctx.fillStyle = "#39ff14"; 
        ctx.fillText("⚡", xPos + (TILE_SIZE / 2), yPos + (TILE_SIZE / 2)); 
    }
    if (item === P_BOMB)  { 
        ctx.shadowColor = "#ff3333"; // Red glow for bombs
        ctx.fillStyle = "#ff3333"; 
        ctx.fillText("💣", xPos + (TILE_SIZE / 2), yPos + (TILE_SIZE / 2)); 
    }
    if (item === P_FIRE)  { 
        ctx.shadowColor = "#ffaa00"; // Orange glow for fire
        ctx.fillStyle = "#ffaa00"; 
        ctx.fillText("🔥", xPos + (TILE_SIZE / 2), yPos + (TILE_SIZE / 2)); 
    }

    // 3. IMPORTANT: RESET SHADOWS
    // If you don't reset this, EVERYTHING else drawn after this will glow!
    ctx.shadowBlur = 0;
}
        }
    }
    
// 2. Stroke the perimeter of the canvas
ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Bombs Ticking Rendering
let now = Date.now();
for (let bomb of bombs) {
    let elapsed = now - bomb.placedAt;
    let progress = Math.min(elapsed / bomb.duration, 1); // 0 to 1
    let timeLeft = 1 - progress; // 1 to 0

    // 1. Draw the Bomb Body
    ctx.fillStyle = "#990011";
    ctx.beginPath();
    ctx.arc(bomb.gridX * TILE_SIZE + (TILE_SIZE/2), bomb.gridY * TILE_SIZE + (TILE_SIZE/2), 12, 0, Math.PI*2);
    ctx.fill();

    // 2. Draw the Shrinking Timer Arc
    // This draws a circle that shrinks as the bomb gets closer to exploding
    ctx.strokeStyle = "#ee2424";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // We draw an arc from 0 to 2*PI * timeLeft
    ctx.arc(
        bomb.gridX * TILE_SIZE + (TILE_SIZE/2), 
        bomb.gridY * TILE_SIZE + (TILE_SIZE/2), 
        8, // Radius of the timer circle
        0, 
        Math.PI * 2 * timeLeft, 
        false
    );
    ctx.stroke();

    // 3. Optional: Pulsing Glow
    let radiusPulse = 12 + Math.sin(now / 80) * 1.5;
    ctx.fillStyle = "rgba(255, 0, 50, 0.2)";
    ctx.beginPath();
    ctx.arc(bomb.gridX * TILE_SIZE + (TILE_SIZE/2), bomb.gridY * TILE_SIZE + (TILE_SIZE/2), radiusPulse + 2, 0, Math.PI*2);
    ctx.fill();
}
   // Blast Waves Rendering
for (let exp of explosions) {
    let now = Date.now();
    let life = (now - exp.placedAt) / 400; // 0 to 1 life cycle
    let opacity = 1 - life;
    
    // We want the explosion to "expand" slightly as it ages
    let scale = 1 + (life * 0.2); 

    for (let cell of exp.cells) {
        let centerX = cell.x * TILE_SIZE + (TILE_SIZE / 2);
        let centerY = cell.y * TILE_SIZE + (TILE_SIZE / 2);
        let radius = (TILE_SIZE / 1.2) * scale;

        // 1. Draw a soft, glowing radial gradient (The "Fire" look)
        let gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${opacity})`);    // Bright white-hot center
        gradient.addColorStop(0.4, `rgba(255, 200, 0, ${opacity * 0.8})`); // Yellow core
        gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);               // Transparent red edges

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Add a subtle "Shockwave" ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
    }
}

    // Enemies Rendering
    for (let enemy of enemies) {
        ctx.fillStyle = enemy.type === 'red' ? "#ff2a2a" : enemy.type === 'purple' ? "#a336ff" : "#ff4da6";
        ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    }

   // --- BOSS RENDERING ---
if (boss !== null && typeof boss !== 'undefined') {
    const bossAsset = document.getElementById("bossImg");

if (!cachedBossFrame) {
        cachedBossFrame = getChromaKeyedFrame(bossAsset, bossAsset.width, bossAsset.height);
    }
    // 2. Define the size of the visual boss image
    // Make this larger than 'boss.size' (e.g., add 20 pixels)
    let renderWidth = boss.size + 20; 
    let renderHeight = boss.size + 40;

    // 3. Calculate offsets to center the bigger image over the boss indicator
    let offsetX = (renderWidth - boss.size) / 2;
    let offsetY = (renderHeight - boss.size) / 2;

    // 4. Generate the transparent frame
    let processedBoss = getChromaKeyedFrame(bossAsset, bossAsset.width, bossAsset.height);

    // 5. Draw the Image (using the offsets to shift it)
    ctx.drawImage(cachedBossFrame, boss.x - offsetX, boss.y - offsetY, renderWidth, renderHeight);
    // 6. Draw Health Bar (Stays on the original boss.size position)
    let healthPercent = boss.hp / boss.maxHp;
    let barWidth = boss.size;
    let barHeight = 4;
    let barX = boss.x;
    let barY = boss.y - 6;

    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = healthPercent > 0.5 ? "#39ff14" : "#ff3333";
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    } else {
    // Clear the cache when the boss is defeated to free memory
    cachedBossFrame = null;

}

  // --- RENDER PLAYER CHARACTER WITH LIVE CHROMA-KEYING ---
    if (!isGameOver) {
        let isMoving = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
        let activeAsset = isMoving ? document.getElementById("playerWalkVideo") : document.getElementById("playerIdleImg");

        if (isMoving) {
            if (activeAsset.tagName === 'VIDEO') {
                // FORCE LOOP: Check if the video reached the end
                // We use 0.1s buffer to ensure we catch it before it hits 0
                if (activeAsset.currentTime >= activeAsset.duration - 0.1) {
                    activeAsset.currentTime = 0;
                }
                
                // Keep it playing
                if (activeAsset.paused) {
                    activeAsset.play().catch(e => console.log("Playback failed:", e));
                }
            }
        } else {
            // Stop and reset when not moving
            if (activeAsset.tagName === 'VIDEO' && !activeAsset.paused) {
                activeAsset.pause();
                activeAsset.currentTime = 0;
            }
        }

        // Generate the transparent frame on-the-fly
        let processedFrame = getChromaKeyedFrame(activeAsset, activeAsset.videoWidth || activeAsset.width, activeAsset.videoHeight || activeAsset.height);

        let offset = (player.renderSize - player.size) / 2;
        let renderX = player.x - offset;
        let renderY = player.y - offset;

        ctx.drawImage(processedFrame, renderX, renderY, player.renderSize, player.renderSize);
        
        // Update monitor canvas
        monitorCtx.clearRect(0, 0, monitorCanvas.width, monitorCanvas.height);
        // Perfectly still version:
monitorCtx.drawImage(processedFrame, (monitorCanvas.width - 70) / 2, (monitorCanvas.height - 85) / 2, 70, 85);
    }
}


function mainGameLoop() {
    updateGame();
    drawGame();
    requestAnimationFrame(mainGameLoop);
}

// NEW BGM STARTER (Use this instead of the previous one)
const bgm = document.getElementById("bgmGame");

function startMusic() {
    if (bgm && bgm.paused) {
        bgm.play().catch(e => {
            console.log("Autoplay blocked, waiting for first interaction...");
        });
    }
}

// Try to start immediately (browser might block this, that's okay)
window.addEventListener("load", startMusic);

// Also listen for the very first click anywhere to ensure it starts if load failed
window.addEventListener("click", startMusic, { once: true });

// 3. START THE GAME
initGame();
mainGameLoop();

