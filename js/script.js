// Get elements
const urlParams = new URLSearchParams(window.location.search);
const difficulty = urlParams.get('difficulty') || 'easy';

const gameBoard = document.getElementById('puzzle-board');
const startButton = document.getElementById('startButton');
const timerDisplay = document.getElementById('timeValue');

let totalPieces = 9;
let puzzleImagePath = '../images/background-1.jpg';
let rotationLimit = 0;

if (difficulty === 'medium') {
    totalPieces = 25;
    puzzleImagePath = '../images/background-3.jpg';
    rotationLimit = 45;
} else if (difficulty === 'hard') {
    totalPieces = 49;
    puzzleImagePath = '../images/background-4.jpg';
    rotationLimit = 360;
}

const puzzleImage = new Image();
let pieceWidthSize, pieceHeightSize;
let scaledImageWidth, scaledImageHeight;

let timerInterval;
let startTime = 0;

let pieces = [];

let edgeTypes = [];

let draggedPiece = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let boardRect = null;
let pendingFrame = false;
let lastBoardX = 0;
let lastBoardY = 0;
let dragGroup = [];
let groupOrigins = new Map();  // piece → { x, y }

function assignEdgeTypes(gridSize) {
    edgeTypes = [];
    for (let row = 0; row < gridSize; row++) {
        edgeTypes[row] = [];
        for (let col = 0; col < gridSize; col++) {
            const piece = { top: 0, right: 0, bottom: 0, left: 0 };

            // Top Edge
            piece.top = (row === 0) ? 0 : -edgeTypes[row - 1][col].bottom;

            // Left Edge
            piece.left = (col === 0) ? 0 : -edgeTypes[row][col - 1].right;

            // Right Edge
            piece.right = (col === gridSize - 1) ? 0 : (Math.random() < 0.5 ? 1 : -1);

            // Bottom Edge
            piece.bottom = (row === gridSize - 1) ? 0 : (Math.random() < 0.5 ? 1 : -1);

            edgeTypes[row][col] = piece;
        }
    }
}

function calculatePadding(piece, tabRadius, borderWidth) {
    return {
        top:    (piece.top === 1)    ? tabRadius + borderWidth : 0,
        right:  (piece.right === 1)  ? tabRadius + borderWidth : 0,
        bottom: (piece.bottom === 1) ? tabRadius + borderWidth : 0,
        left:   (piece.left === 1)   ? tabRadius + borderWidth : 0,
    };
}

function buildPiecePath(piece, w, h, tabRadius) {
    const path = new Path2D();

    // Start at top-left corner
    path.moveTo(0, 0);

    // ==== TOP EDGE ====
    if (piece.top === 0) {
        path.lineTo(w, 0);
    } else {
        const cx = w / 2;
        path.lineTo(cx - tabRadius, 0);
        path.arc(cx, 0, tabRadius, Math.PI, 0, piece.top === -1); // false for tab, true for blank
        path.lineTo(w, 0);
    }

    // ==== RIGHT EDGE ====
    if (piece.right === 0) {
        path.lineTo(w, h);
    } else {
        const cy = h / 2;
        path.lineTo(w, cy - tabRadius);
        path.arc(w, cy, tabRadius, -Math.PI / 2, Math.PI / 2, piece.right === -1);
        path.lineTo(w, h);
    }

    // ==== BOTTOM EDGE ====
    if (piece.bottom === 0) {
        path.lineTo(0, h);
    } else {
        const cx = w / 2;
        path.lineTo(cx + tabRadius, h);
        path.arc(cx, h, tabRadius, 0, Math.PI, piece.bottom === -1);
        path.lineTo(0, h);
    }

    // ==== LEFT EDGE ====
    if (piece.left === 0) {
        path.lineTo(0, 0);
    } else {
        const cy = h / 2;
        path.lineTo(0, cy + tabRadius);
        path.arc(0, cy, tabRadius, Math.PI / 2, -Math.PI / 2, piece.left === -1);
        path.lineTo(0, 0);
    }

    path.closePath();
    return path;
}


function generatePuzzlePieces() {
    const gridSize = Math.sqrt(totalPieces);
    const tabRadius = Math.min(pieceWidthSize, pieceHeightSize) * 0.25;
    const borderWidth = 2;

    assignEdgeTypes(gridSize);

    gameBoard.innerHTML = '';
    pieces = [];

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {

            const piece = edgeTypes[row][col];
            const padding = calculatePadding(piece, tabRadius, borderWidth);

            // 👉 Calculate the maximum margin (the largest of all padding sides)
            const margin = Math.max(padding.top, padding.right, padding.bottom, padding.left);

            const canvas = document.createElement('canvas');
            canvas.width = pieceWidthSize + margin * 2;
            canvas.height = pieceHeightSize + margin * 2;

            const ctx = canvas.getContext('2d');
            ctx.translate(margin, margin);

            const path = buildPiecePath(piece, pieceWidthSize, pieceHeightSize, tabRadius);

            ctx.save();
            ctx.clip(path);
            ctx.drawImage(
                puzzleImage,
                -col * pieceWidthSize,
                -row * pieceHeightSize,
                scaledImageWidth,
                scaledImageHeight
            );
            ctx.restore();

            ctx.lineWidth = borderWidth;
            ctx.strokeStyle = 'white';
            ctx.stroke(path);

            canvas.classList.add('puzzle-piece');
            canvas.style.position = 'absolute';
            canvas.style.width = `${canvas.width}px`;
            canvas.style.height = `${canvas.height}px`;
            canvas.style.left = `${Math.random() * (gameBoard.offsetWidth - canvas.width)}px`;
            canvas.style.top = `${Math.random() * (gameBoard.offsetHeight - canvas.height)}px`;

            // inside generatePuzzlePieces(), after setting canvas.style.left & top
            canvas.dataset.row        = row;
            canvas.dataset.col        = col;
            canvas.dataset.originLeft = canvas.style.left;
            canvas.dataset.originTop  = canvas.style.top;

            canvas.dataset.group = crypto.randomUUID();  // each piece starts in its own group
            canvas.dataset.snapped = 'false';
            let angle = 0;
            if (rotationLimit > 0) {
                angle = (Math.random() - 0.5) * 2 * rotationLimit;
                canvas.style.transform = `rotate(${angle}deg)`;
            }
            canvas.dataset.rot = angle
            // 👉 Save the margin for dragging correction
            canvas.dataset.margin = margin;

            gameBoard.appendChild(canvas);
            pieces.push(canvas);

            canvas.style.cursor = 'grab';
        }
    }
}



function resizePuzzlePieces() {
    const gridSize = Math.sqrt(totalPieces);

    const widthScale = puzzleImage.naturalWidth / gameBoard.offsetWidth;
    const heightScale = puzzleImage.naturalHeight / gameBoard.offsetHeight;
    const scaleFactor = Math.max(widthScale, heightScale);

    scaledImageWidth = puzzleImage.naturalWidth / scaleFactor;
    scaledImageHeight = puzzleImage.naturalHeight / scaleFactor;

    pieceWidthSize = scaledImageWidth / gridSize;
    pieceHeightSize = scaledImageHeight / gridSize;

    const boardWidth = gameBoard.offsetWidth;
    const boardHeight = gameBoard.offsetHeight;

    pieces.forEach(piece => {
        // piece.style.width = `${pieceWidthSize}px`;
        // piece.style.height = `${pieceHeightSize}px`;

        let left = parseFloat(piece.style.left);
        let top = parseFloat(piece.style.top);

        if (left + pieceWidthSize > boardWidth) {
            left = boardWidth - pieceWidthSize;
        }
        if (top + pieceHeightSize > boardHeight) {
            top = boardHeight - pieceHeightSize;
        }
        if (left < 0) {
            left = 0;
        }
        if (top < 0) {
            top = 0;
        }

        // piece.style.left = `${left}px`;
        // piece.style.top = `${top}px`;
    });
}

function findNeighbor(piece, dir) {
  // dir ∈ { 'top', 'right', 'bottom', 'left' }
  const row = +piece.dataset.row;
  const col = +piece.dataset.col;
  let nr = row, nc = col;

  if (dir === 'top')    nr--;
  if (dir === 'bottom') nr++;
  if (dir === 'left')   nc--;
  if (dir === 'right')  nc++;

  return pieces.find(p => +p.dataset.row === nr && +p.dataset.col === nc);
}

// ─── startDrag ───────────────────────────────────────────────────────────────
function startDrag(e) {
  e.preventDefault();
  // grab pointer coords
  const pX = e.clientX, pY = e.clientY;
  // find the piece
  const target = e.target.closest('.puzzle-piece');
  if (!target) return;

  draggedPiece = target;
  draggedPiece.style.zIndex   = 10;
  draggedPiece.style.cursor   = 'grabbing';

  // cache board dims once
  boardRect = gameBoard.getBoundingClientRect();

  // pointer relative to board
  const boardX = pX - boardRect.left;
  const boardY = pY - boardRect.top;

  // figure out current x,y from any existing transform
  const style = getComputedStyle(draggedPiece).transform;
  let curX = 0, curY = 0;
  if (style && style !== 'none') {
    const m = style.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),([^,]+)\)/);
    if (m) [ , curX, curY ] = m.map(parseFloat);
  }

  // how far inside the piece you clicked
  dragOffsetX = boardX - curX;
  dragOffsetY = boardY - curY;

  // listen to moves & up globally
  document.addEventListener('pointermove', drag, { passive: false });
  document.addEventListener('pointerup',   endDrag, { once: true });

// build the group & cache origins
  const oldId = draggedPiece.dataset.group;
  dragGroup = pieces.filter(p => p.dataset.group === oldId);
  groupOrigins.clear();
  dragGroup.forEach(p => {
    groupOrigins.set(p, {
      x: parseFloat(p.dataset.originLeft),
      y: parseFloat(p.dataset.originTop),
    });
  });
}

// ─── drag (throttled) ────────────────────────────────────────────────────────
function endDrag() {
  if (!draggedPiece) return;

  // --- A) Compute absolute coords of dropped piece ---
  const style = getComputedStyle(draggedPiece).transform;
  let tx = 0, ty = 0;
  if (style !== 'none') {
    const m = style.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),([^,]+)\)/);
    if (m) [ , tx, ty ] = m.map(parseFloat);
  }
  const origX = parseFloat(draggedPiece.dataset.originLeft);
  const origY = parseFloat(draggedPiece.dataset.originTop);
  const absX  = origX + tx;
  const absY  = origY + ty;

  // --- B) Check each of the 4 neighbor directions ---
  ['top','right','bottom','left'].forEach(dir => {
    const nbr = findNeighbor(draggedPiece, dir);
    if (!nbr || nbr.dataset.snapped === 'true') return;

    // Compute neighbor’s absolute position (same logic)
    const nbrStyle = getComputedStyle(nbr).transform;
    let ntx = 0, nty = 0;
    if (nbrStyle !== 'none') {
      const mm = nbrStyle.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),([^,]+)\)/);
      if (mm) [ , ntx, nty ] = mm.map(parseFloat);
    }
    const nOrigX = parseFloat(nbr.dataset.originLeft);
    const nOrigY = parseFloat(nbr.dataset.originTop);
    const nX = nOrigX + ntx, nY = nOrigY + nty;

    // Expected offset between A and B
    let expectedDX = 0, expectedDY = 0;
    if (dir === 'top')    expectedDY = -pieceHeightSize;
    if (dir === 'bottom') expectedDY =  pieceHeightSize;
    if (dir === 'left')   expectedDX = -pieceWidthSize;
    if (dir === 'right')  expectedDX =  pieceWidthSize;

    // Check within tolerance (20% of piece size)
    const dx = absX - nX, dy = absY - nY;
    const tol = Math.min(pieceWidthSize, pieceHeightSize) * 0.2;
    if (Math.abs(dx - expectedDX) < tol && Math.abs(dy - expectedDY) < tol) {
      // ---- C) SNAP BOTH PIECES ----
      const finalAX = nX + expectedDX;
      const finalAY = nY + expectedDY;

      [draggedPiece, nbr].forEach((p, idx) => {
        // clear any stray transforms
        p.style.transform = '';

        // pick target coords
        const x = idx === 0 ? finalAX : nX;
        const y = idx === 0 ? finalAY : nY;

        // set their left/top & mark snapped
        p.style.left                = `${x}px`;
        p.style.top                 = `${y}px`;
        p.dataset.originLeft        = x;
        p.dataset.originTop         = y;
        p.dataset.snapped           = 'true';
      });

      // ---- D) CLEAR NEIGHBOR’S ROTATION IF DESIRED ----
      nbr.style.transform = '';

      // ---- E) MERGE GROUPS ----
      const oldId = draggedPiece.dataset.group;
      const newId = nbr.dataset.group;
      pieces
        .filter(p => p.dataset.group === oldId)
        .forEach(p => p.dataset.group = newId);

      // ---- F) UPDATE CACHE FOR NEXT DRAG ----
      groupOrigins.set(draggedPiece, { x: finalAX, y: finalAY });
      groupOrigins.set(nbr,            { x: nX,      y: nY      });
    }
  });

  // --- G) Cleanup ---
  draggedPiece.style.zIndex = 3;
  draggedPiece.style.cursor = 'grab';
  draggedPiece = null;
  document.removeEventListener('pointermove', drag);

  // --- H) Check for completion ---
  if (pieces.every(p => p.dataset.snapped === 'true')) {
    onPuzzleComplete();
  }
}


// ─── rAF callback ────────────────────────────────────────────────────────────
function applyDrag() {
  pendingFrame = false;
  const deltaX = lastBoardX - dragOffsetX;
  const deltaY = lastBoardY - dragOffsetY;

  // move entire group
  dragGroup.forEach(p => {
    const o = groupOrigins.get(p);
    const rot = +p.dataset.rot || 0;
    p.style.transform = `rotate(${rot}deg) translate(${o.x + deltaX}px, ${o.y + deltaY}px)`;

  });
}

function drag(e) {
  e.preventDefault();
  if (!draggedPiece) return;

  lastBoardX = e.clientX - boardRect.left;
  lastBoardY = e.clientY - boardRect.top;

  if (!pendingFrame) {
    pendingFrame = true;
    requestAnimationFrame(applyDrag);
  }
}


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

startButton.addEventListener('click', () => {
    startButton.disabled = true;

    puzzleImage.src = puzzleImagePath;

    puzzleImage.onload = function () {
        const widthScale = puzzleImage.naturalWidth / gameBoard.offsetWidth;
        const heightScale = puzzleImage.naturalHeight / gameBoard.offsetHeight;

        const scaleFactor = Math.max(widthScale, heightScale);

        scaledImageWidth = puzzleImage.naturalWidth / scaleFactor;
        scaledImageHeight = puzzleImage.naturalHeight / scaleFactor;

        const gridSize = Math.sqrt(totalPieces);
        pieceWidthSize = scaledImageWidth / gridSize;
        pieceHeightSize = scaledImageHeight / gridSize;

        generatePuzzlePieces();
        startTimer();
    };
});

gameBoard.addEventListener('pointerdown', startDrag, { passive: false });

window.addEventListener('resize', () => {
    if (pieces.length > 0) {
        resizePuzzlePieces();
    }
});