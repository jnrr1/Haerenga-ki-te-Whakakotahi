// script.js  (must be loaded with type="module")

// ——————————————————————————————————————————————
// 1. IMPORT MediaPipe (ES module)
// ——————————————————————————————————————————————
import { FilesetResolver, PoseLandmarker } from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.js";

// ——————————————————————————————————————————————
// 2. GET REFERENCES to HTML elements
// ——————————————————————————————————————————————
const dancerVideo   = document.getElementById("dancerVideo");
const webcamVideo   = document.getElementById("webcamVideo");
const overlayCanvas = document.getElementById("overlayCanvas");
const scoreValue    = document.getElementById("scoreValue");
const startButton   = document.getElementById("startButton");
const pauseButton   = document.getElementById('pauseButton');
const pauseOverlay  = document.getElementById('pauseOverlay');
const resumeButton  = document.getElementById('resumeButton');
const homeButton    = document.getElementById('homeButton');
const canvasCtx     = overlayCanvas.getContext("2d");

// ——————————————————————————————————————————————
// GLOBALS for countdown control
// ——————————————————————————————————————————————
let isPaused = false;
let gameRunning = false;
let countdownStarted = false;

// ——————————————————————————————————————————————
// ONE‑TIME hookup for submit button
// ——————————————————————————————————————————————
const submitBtn = document.getElementById('hsSubmitButton');
if (submitBtn) {
  submitBtn.addEventListener('click', () => {
    try {
      const dance = sessionStorage.getItem('lastDancePlayed');
      const name  = document.getElementById('hsNameInput')
                         .value.trim() || 'Anonymous';
      const list  = loadHighScoresFor(dance);
      list.push({ name, score: totalScore });
      list.sort((a,b) => b.score - a.score);
      saveHighScoresFor(dance, list);
      document.getElementById('highscoreOverlay')
              .classList.add('hidden');
    } catch (err) {
      console.error('Could not save high score:', err);
    }
  });
}


// ——————————————————————————————————————————————
// Pausable sleep function
// ——————————————————————————————————————————————
/**
 * Waits for roughly `ms` milliseconds, but pauses the timer while isPaused===true.
 * Resolves as soon as the full ms of *unpaused* time have elapsed.
 */
function sleepPausable(ms) {
  return new Promise(resolve => {
    const endTime = performance.now() + ms;
    function frame() {
      // If paused, just queue the next frame without advancing time
      if (isPaused) {
        requestAnimationFrame(frame);
        return;
      }
      const now = performance.now();
      if (now >= endTime) {
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  });
}


// ——————————————————————————————————————————————
// Pausable countdown
// ——————————————————————————————————————————————
async function runPausableCountdown() {
  const el = document.getElementById("countdown");
  el.classList.remove("hidden");
  el.classList.add("visible");
  for (let i = 3; i >= 1; --i) {
    el.textContent = i;
    await sleepPausable(1000);  // now true 1 s of unpaused time
  }
  el.textContent = "Dance!";
  await sleepPausable(1000);
  el.classList.remove("visible");
  el.classList.add("hidden");
}

// ——————————————————————————————————————————————
// 3. SET UP PoseLandmarker instances & offscreen canvases
// ——————————————————————————————————————————————
let poseLandmarkerUser   = null; // IMAGE mode for webcam
let poseLandmarkerDancer = null; // IMAGE mode for dancer video

let totalScore   = 0;
let frameCount   = 0;
let dancerResult = null;

// Offscreen canvas for capturing the webcam frame
const webcamCaptureCanvas = document.createElement("canvas");
webcamCaptureCanvas.width  = 480;
webcamCaptureCanvas.height = 360;
const webcamCtx = webcamCaptureCanvas.getContext("2d");

// Offscreen canvas for capturing the dancer frame
const dancerCaptureCanvas = document.createElement("canvas");
dancerCaptureCanvas.width  = 480;
dancerCaptureCanvas.height = 360;
const dancerCtx = dancerCaptureCanvas.getContext("2d");

// ——————————————————————————————————————————————
// 4. INITIALIZE the user’s webcam
// ——————————————————————————————————————————————
async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 480, height: 360 },
      audio: false,
    });
    webcamVideo.srcObject = stream;
    await new Promise((resolve) => {
      webcamVideo.onloadedmetadata = () => {
        const w = webcamVideo.videoWidth;
        const h = webcamVideo.videoHeight;
        overlayCanvas.width  = w;
        overlayCanvas.height = h;
        webcamVideo.play();
        resolve();
      };
    });
    console.log("Webcam initialized.");
  } catch (err) {
    console.error("Error accessing webcam:", err);
    alert("Could not access webcam. Please allow camera permission.");
  }
}

// ——————————————————————————————————————————————
// 5. LOAD both PoseLandmarker models in IMAGE mode
// ——————————————————————————————————————————————
async function loadPoseModel() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  poseLandmarkerUser = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    },
    runningMode: "IMAGE",
    numPoses: 1,
  });
  console.log("MediaPipe PoseLandmarker (USER/IMAGE) loaded.");

  poseLandmarkerDancer = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    },
    runningMode: "IMAGE",
    numPoses: 1,
  });
  console.log("MediaPipe PoseLandmarker (DANCER/IMAGE) loaded.");
}

// ——————————————————————————————————————————————
// 6. COMPUTE per-frame similarity
// ——————————————————————————————————————————————
const COMPARE_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

function computeFrameScore(userLM, dancerLM) {
  let totalDist = 0;
  const n = COMPARE_INDICES.length;
  for (let idx of COMPARE_INDICES) {
    if (userLM[idx] && dancerLM[idx]) {
      const dx = userLM[idx].x - dancerLM[idx].x;
      const dy = userLM[idx].y - dancerLM[idx].y;
      totalDist += Math.hypot(dx, dy);
    } else {
      totalDist += 1.0;
    }
  }
  const avgDist = totalDist / n;
  const threshold = 0.3;
  let score = 0;
  if (avgDist < threshold) {
    score = (1 - avgDist / threshold) * 100;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ——————————————————————————————————————————————
// 7. DRAW any pose with a given style
// ——————————————————————————————————————————————
function drawPose(result, lineColor = "cyan", circleColor = "red", lineWidth = 2) {
  if (!result || !result.landmarks || result.landmarks.length < 1) return;
  const landmarks = result.landmarks[0];
  const connections = [
    [0, 1], [0, 2], [11, 13], [13, 15],
    [12, 14], [14, 16], [11, 12], [23, 24],
    [11, 23], [12, 24], 
    [23,25],[25,27], // left hip→knee→ankle
    [24,26],[26,28]  // right hip→knee→ankle
  ];

  // Draw lines
  canvasCtx.lineWidth = lineWidth;
  canvasCtx.strokeStyle = lineColor;
  connections.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    canvasCtx.beginPath();
    canvasCtx.moveTo(p1.x * overlayCanvas.width, p1.y * overlayCanvas.height);
    canvasCtx.lineTo(p2.x * overlayCanvas.width, p2.y * overlayCanvas.height);
    canvasCtx.stroke();
  });

  // Draw circles
  canvasCtx.fillStyle = circleColor;
  landmarks.forEach(pt => {
    canvasCtx.beginPath();
    const x = pt.x * overlayCanvas.width;
    const y = pt.y * overlayCanvas.height;
    canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
    canvasCtx.fill();
  });
}

// ——————————————————————————————————————————————
// 8. MAIN loop
// ——————————————————————————————————————————————
function startProcessingLoop() {
  async function onFrame() {
    // ————————————————————————————————————
    // [unchanged] same frame processing as before
    webcamCtx.drawImage(webcamVideo, 0, 0, 480, 360);
    const userResult = poseLandmarkerUser.detect(webcamCaptureCanvas);
    console.log('User landmarks @', webcamVideo.currentTime.toFixed(2), userResult.landmarks[0]);

        // Always compare against the global DANCE_START
    const D = window.DANCE_START || 0;

    if (dancerVideo.currentTime >= D) {
      // Now that video has reached the start-of-dance mark,
      // render the dancer + user poses
      dancerCtx.drawImage(dancerVideo, 0, 0, 480, 360);
      dancerResult = poseLandmarkerDancer.detect(dancerCaptureCanvas);
      canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      drawPose(dancerResult, '#888', '#888', 1);
      drawPose(userResult, 'cyan', 'red', 2);

      if (userResult.landmarks.length && dancerResult.landmarks.length) {
        const frameScore = computeFrameScore(
          userResult.landmarks[0],
          dancerResult.landmarks[0]
        );
        totalScore += frameScore;
        scoreValue.textContent = totalScore;
      }
    } else {
      // Intro period — only draw the user
      canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      drawPose(userResult, 'cyan', 'red', 2);
    }


    if (!dancerVideo.paused && !dancerVideo.ended) {
      requestAnimationFrame(onFrame);
    } else if (dancerVideo.ended) {
      startButton.disabled = false;
      startButton.textContent = "Start Again";
      gameRunning = false;
      console.log("Dance finished. Final score:", totalScore);

      const danceName = sessionStorage.getItem('lastDancePlayed'); // Or however you store it

      if (danceName) {
        const eligible = await isHighScore(danceName, totalScore);

        if (eligible) {
          document.getElementById('finalScore').textContent = totalScore;
          document.getElementById('highscoreOverlay').classList.remove('hidden');

          document.getElementById('hsMenuButton').addEventListener('click', () => {
          window.location.href = 'selector.html';
          });
        } else {
          console.log('Score not high enough for leaderboard.');
          // Optionally navigate or show a message
        }
      } else {
        console.warn('Dance name not found in session storage.');
      }
    }
  }
  requestAnimationFrame(onFrame);
}

// ——————————————————————————————————————————————
// 8a. High Score Logic
// ——————————————————————————————————————————————

// ———— Helpers: read & write localStorage ————
function loadHighScoresFor(dance) {
  const all = JSON.parse(localStorage.getItem('highScores')||'{}');
  return all[dance]||[];
}
function saveHighScoresFor(dance, list) {
  const all = JSON.parse(localStorage.getItem('highScores')||'{}');
  all[dance] = list.slice(0,5);
  localStorage.setItem('highScores', JSON.stringify(all));
}
async function isHighScore(danceName, score) {
  const list = loadHighScoresFor(danceName);
  return list.length < 5 || score > list[list.length-1].score;
}

async function endGame(danceName, playerScore) {
    const eligible = await isHighScore(danceName, playerScore);

    if (eligible) {
        document.getElementById('highscoreOverlay').classList.remove('hidden');
    } else {
        console.log('Score not high enough for leaderboard.');
        // Optionally return to menu or show a message
    }
}

// ——————————————————————————————————————————————
// 9. Pause and Resume logic
// ——————————————————————————————————————————————
pauseButton.addEventListener('click', () => {
  isPaused = true;

  if (!dancerVideo.paused) {
    dancerVideo.pause();
  }

  pauseOverlay.classList.remove('hidden');
  pauseButton.disabled = true;
  pauseButton.textContent = 'Paused';
});

resumeButton.addEventListener('click', async () => {
  pauseOverlay.classList.add('hidden');
  isPaused = false;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Pause';

  if (gameRunning) {
    try {
      await dancerVideo.play();
    } catch (e) {
      console.warn('Autoplay resume blocked', e);
    }
    startProcessingLoop();
  }
});

// helper that waits until video.currentTime ≥ t
function waitForVideoTime(t) {
  return new Promise(resolve => {
    function onTimeUpdate() {
      if (dancerVideo.currentTime >= t) {
        dancerVideo.removeEventListener('timeupdate', onTimeUpdate);
        resolve();
      }
    }
    dancerVideo.addEventListener('timeupdate', onTimeUpdate);
    onTimeUpdate();
  });
}

homeButton.addEventListener('click', () => {
  window.location.href = 'selector.html';
});

// ——————————————————————————————————————————————
// 10. START button logic
// ——————————————————————————————————————————————
// single launch + loop kick-off fn
async function launchVideoAndLoop() {
  dancerVideo.currentTime = 0;
  dancerVideo.muted       = false;
  await dancerVideo.play().catch(() => {});
  gameRunning = true;
  startProcessingLoop();
  startButton.textContent = "Game Running…";
}

startButton.addEventListener("click", async () => {
  // — disable + loading text —
  startButton.disabled    = true;
  startButton.textContent = "Loading…";


  // — init webcam & model —
  await initWebcam();
  await loadPoseModel();

  // — reset state —
  totalScore        = 0;
  frameCount        = 0;
  dancerResult      = null;
  scoreValue.textContent = "0";
  countdownStarted  = false;
  document.getElementById('highscoreOverlay').classList.add('hidden');

  const D = window.DANCE_START || 0;

  if (D > 3) {
    // ─ long intro → start & loop, then countdown at (D−3)
    await launchVideoAndLoop();
    await waitForVideoTime(D - 3);
    await runPausableCountdown();

  } else if (D === 3) {
    // ─ exactly 3s → start & loop, then immediate countdown
    await launchVideoAndLoop();
    await runPausableCountdown();

  } else {
    // ─ short intro (<3s) → hold video, countdown, then start & loop
    dancerVideo.pause();
    await runPausableCountdown();
    await launchVideoAndLoop();
  }
});
