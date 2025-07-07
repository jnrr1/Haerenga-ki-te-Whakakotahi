// Get Elements
const startButton = document.getElementById('startButton');
const puzzleBoard = document.getElementById('puzzle-board');
const timerDisplay = document.getElementById('timeValue');

let timerInterval;
let startTime;
let totalPieces;
let gridSize;

// Timer Functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        timerDisplay.textContent = formatTime(elapsedSeconds);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Difficulty to Grid Mapping
function getGridSize(difficulty) {
    switch (difficulty.toLowerCase()) {
        case 'easy': return 3; // 3x3
        case 'medium': return 4; // 4x4
        case 'hard': return 5; // 5x5
        default: return 3;
    }
}

// Start Game
startButton.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const difficulty = urlParams.get('difficulty') || 'easy';

    gridSize = getGridSize(difficulty);
    totalPieces = gridSize * gridSize;

    // Clear existing puzzle pieces
    puzzleBoard.querySelectorAll('.puzzle-piece').forEach(piece => piece.remove());

    generatePuzzlePieces();
    startTimer();
});

function generatePuzzlePieces() {
    const pieceWidth = (puzzleBoard.clientWidth * 0.85) / gridSize;
    const pieceHeight = (puzzleBoard.clientHeight * 0.85) / gridSize;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const piece = document.createElement('img');
            piece.classList.add('puzzle-piece');

            //piece.src = `../images/SVG/jigsaw-${gridSize}x${gridSize}_${col}_${row}_base.svg`;
            piece.src = `../images/SVG/jigsaw-3x3_0_0_base.png`;

            // Set size
            piece.style.width = `${pieceWidth}px`;
            piece.style.height = `${pieceHeight}px`;

            // Random Positioning within the puzzle board (with 15% margin area)
            const maxLeft = puzzleBoard.clientWidth - pieceWidth;
            const maxTop = puzzleBoard.clientHeight - pieceHeight;

            piece.style.left = `${Math.random() * maxLeft}px`;
            piece.style.top = `${Math.random() * maxTop}px`;

            piece.draggable = false; // Optional: prevent default dragging
            puzzleBoard.appendChild(piece);
        }
    }
}

