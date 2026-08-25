const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtnOverlay = document.getElementById('restartBtnOverlay');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30; // 300 / 10 and 600 / 20

// Tetromino colors (neon style)
const COLORS = [
    null,
    '#00ffff', // I - Cyan
    '#0000ff', // J - Blue
    '#ff7f00', // L - Orange
    '#ffff00', // O - Yellow
    '#00ff00', // S - Green
    '#800080', // T - Purple
    '#ff0000'  // Z - Red
];

// Tetromino shapes
const PIECES = [
    [],
    // I
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    // J
    [[2,0,0], [2,2,2], [0,0,0]],
    // L
    [[0,0,3], [3,3,3], [0,0,0]],
    // O
    [[4,4], [4,4]],
    // S
    [[0,5,5], [5,5,0], [0,0,0]],
    // T
    [[0,6,0], [6,6,6], [0,0,0]],
    // Z
    [[7,7,0], [0,7,7], [0,0,0]]
];

let board = [];
let score = 0;
let level = 1;
let linesCleared = 0;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = false;
let animationId;

let player = {
    pos: {x: 0, y: 0},
    matrix: null
};

let nextPiece = null;

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function createPiece(typeIndex) {
    return PIECES[typeIndex];
}

function drawMatrix(matrix, offset, context = ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = COLORS[value];
                context.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                context.strokeStyle = 'rgba(0,0,0,0.5)';
                context.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                
                // Add a little highlight for neon effect
                context.fillStyle = 'rgba(255,255,255,0.3)';
                context.fillRect((x + offset.x) * BLOCK_SIZE + 2, (y + offset.y) * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE / 2);
            }
        });
    });
}

function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawMatrix(board, {x: 0, y: 0});
    if (player.matrix) {
        drawMatrix(player.matrix, player.pos);
    }
}

function drawNextPiece() {
    nextCtx.fillStyle = '#16213e';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        // Calculate offset to center the piece in the 120x120 canvas
        const nextBlockSize = 25;
        const offsetX = (nextCanvas.width / nextBlockSize - nextPiece[0].length) / 2;
        const offsetY = (nextCanvas.height / nextBlockSize - nextPiece.length) / 2;
        
        nextPiece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextCtx.fillStyle = COLORS[value];
                    nextCtx.fillRect((x + offsetX) * nextBlockSize, (y + offsetY) * nextBlockSize, nextBlockSize, nextBlockSize);
                    nextCtx.strokeStyle = 'rgba(0,0,0,0.5)';
                    nextCtx.strokeRect((x + offsetX) * nextBlockSize, (y + offsetY) * nextBlockSize, nextBlockSize, nextBlockSize);
                    
                    nextCtx.fillStyle = 'rgba(255,255,255,0.3)';
                    nextCtx.fillRect((x + offsetX) * nextBlockSize + 2, (y + offsetY) * nextBlockSize + 2, nextBlockSize - 4, nextBlockSize / 2);
                }
            });
        });
    }
}

function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function collide(board, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(board, player)) {
        player.pos.x -= offset;
    }
}

function playerReset() {
    if (!nextPiece) {
        nextPiece = createPiece(Math.floor(Math.random() * 7) + 1);
    }
    player.matrix = nextPiece;
    nextPiece = createPiece(Math.floor(Math.random() * 7) + 1);
    drawNextPiece();
    
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    
    if (collide(board, player)) {
        gameOver();
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function arenaSweep() {
    let rowCount = 1;
    let lines = 0;
    
    outer: for (let y = board.length - 1; y >= 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        
        score += rowCount * 10;
        rowCount *= 2;
        lines++;
    }
    
    if (lines > 0) {
        linesCleared += lines;
        level = Math.floor(linesCleared / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    }
}

function updateScore() {
    scoreElement.innerText = score;
    levelElement.innerText = level;
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.innerText = score;
}

function resetGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    level = 1;
    linesCleared = 0;
    dropInterval = 1000;
    isGameOver = false;
    isPaused = false;
    
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    pauseBtn.innerText = 'Pause';
    
    updateScore();
    nextPiece = null;
    playerReset();
    
    // reset timer
    lastTime = performance.now();
    update(lastTime);
}

function togglePause() {
    if (isGameOver) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        cancelAnimationFrame(animationId);
        pauseScreen.classList.remove('hidden');
        pauseBtn.innerText = 'Resume';
    } else {
        pauseScreen.classList.add('hidden');
        pauseBtn.innerText = 'Pause';
        lastTime = performance.now();
        update(lastTime);
    }
}

function update(time = 0) {
    if (isPaused || isGameOver) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    
    draw();
    animationId = requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    // Only handle gameplay keys if not game over and not paused
    if (isGameOver) return;
    
    // We allow pause toggle even if it's paused.
    // Wait, the prompt said '일시정지' (Pause) and '다시 시작' (Restart) buttons, not keys. 
    
    if (isPaused) return;

    if (event.keyCode === 37) { // Left arrow
        playerMove(-1);
    } else if (event.keyCode === 39) { // Right arrow
        playerMove(1);
    } else if (event.keyCode === 40) { // Down arrow
        playerDrop();
    } else if (event.keyCode === 38) { // Up arrow
        playerRotate(1);
    } else if (event.keyCode === 32) { // Spacebar
        playerHardDrop();
        event.preventDefault(); // Prevent default scroll behavior
    }
});

pauseBtn.addEventListener('click', () => {
    togglePause();
    // Blur to prevent key presses triggering the button if space was pressed
    pauseBtn.blur();
});

restartBtn.addEventListener('click', () => {
    resetGame();
    restartBtn.blur();
});

restartBtnOverlay.addEventListener('click', () => {
    resetGame();
    restartBtnOverlay.blur();
});

// Initialize
resetGame();
