// === solo_game.js ===

// 1. Read URL parameter
const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('level') || 'easy';

// 2. Map difficulty to settings
let gridSize = 3;
let puzzleImage = '../images/background-1.jpg'; // You can change this if you have more images

switch (difficulty) {
  case 'easy':
    gridSize = 3;
    break;
  case 'medium':
    gridSize = 5;
    break;
  case 'hard':
    gridSize = 7;
    break;
  default:
    gridSize = 3;
    break;
}

console.log(`Difficulty: ${difficulty}, Grid Size: ${gridSize}`);

// Countdown logic
function startCountdown(callback) {
  const countdownEl = document.getElementById('countdown');
  let count = 3;
  countdownEl.textContent = count;
  countdownEl.classList.add('visible');

  const interval = setInterval(() => {
    count--;
    if (count === 0) {
      countdownEl.textContent = 'Go!';
    } else {
      countdownEl.textContent = count;
    }

    if (count < 0) {
      clearInterval(interval);
      countdownEl.classList.remove('visible');
      if (callback) callback();
    }
  }, 1000);
}

// Timer logic
let timerInterval = null;
let startTime = null;

function startTimer() {
  const timeValue = document.getElementById('timeValue');
  startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const seconds = Math.floor(elapsedMs / 1000) % 60;
    const minutes = Math.floor(elapsedMs / 60000);

    timeValue.textContent = 
      `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  }, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// Prepare RNG and Camera
// Prepare RNG and Camera
const rngInstance = new rng();
const cameraInstance = new camera(1000);
window.thiscamera = cameraInstance; 


// Save reference to the puzzle (so you can update later if needed)
let currentPuzzle = null;

document.getElementById('startButton').addEventListener('click', () => {
  // Start countdown
  startCountdown(() => {
    // Start timer
    startTimer();

    // Generate puzzle
    const layout = [gridSize, gridSize];
    const seed = Math.floor(Math.random() * 1000000);
    const style = { edges: 'regular' };
    const motif = puzzleImage;
    const dimensions = [1.0, 1.0]; // You can adjust this if you want

    const parentDiv = document.getElementById('puzzle-board');

    currentPuzzle = new puzzle(layout, seed, style, motif, dimensions, parentDiv);

    rngInstance.seed(seed);
    currentPuzzle.make_puzzlepiece_tiling(1, rngInstance);
    currentPuzzle.generatePieceClippaths();
    currentPuzzle.insertPieces();

    console.log('Puzzle generated!');
  });
});

document.getElementById("puzzle-board").addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomSpeed = 1.1;
  if (event.deltaY < 0) {
    thiscamera.zoom *= zoomSpeed;
  } else {
    thiscamera.zoom /= zoomSpeed;
  }
  thispuzzle.updatePiecePositions();
  thispuzzle.updatePieceTransformation();
});





