/* =========================
   FIREBASE
========================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getDatabase,
    ref,
    push,
    get,
    query,
    orderByChild,
    limitToLast
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyDQwrHSGzxEPGhbJhQP5Ij2YT1AKPEMXQk",
    authDomain: "burdy-3836e.firebaseapp.com",
    databaseURL: "https://burdy-3836e-default-rtdb.firebaseio.com/",
    projectId: "burdy-3836e",
    storageBucket: "burdy-3836e.firebasestorage.app",
    messagingSenderId: "666892581152",
    appId: "1:666892581152:web:87ba6d960e2ea408143f45"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

let authReady = null;

function ensureAuth() {
    if (!authReady) {
        authReady = signInAnonymously(auth)
            .then(() => true)
            .catch((error) => {
                console.error("Firebase auth error:", error);
                return false;
            });
    }

    return authReady;
}

ensureAuth();


/* =========================
   ELEMENTS
========================= */

const bird = document.getElementById("bird");
const birdImage = document.getElementById("birdImage");
const game = document.getElementById("game");
const scoreDisplay = document.getElementById("score");

const camera = document.getElementById("camera");
const photoCanvas = document.getElementById("photoCanvas");
const takePhotoButton = document.getElementById("takePhotoButton");
const retakeButton = document.getElementById("retakeButton");
const photoPreview = document.getElementById("photoPreview");
const nameSection = document.getElementById("nameSection");
const playerNameInput = document.getElementById("playerName");
const startButton = document.getElementById("startButton");

const cameraScreen = document.getElementById("cameraScreen");
const cameraError = document.getElementById("cameraError");

const leaderboardScreen = document.getElementById("leaderboardScreen");
const leaderboardList = document.getElementById("leaderboardList");
const backButton = document.getElementById("backButton");


/* =========================
   INITIAL STATE
========================= */

bird.style.display = "none";


/* =========================
   PLAYER DATA
========================= */

let playerName = "";
let playerPhoto = "";
let stream = null;
let cameraStarting = false;


/* =========================
   GAME DATA
========================= */

let birdY = 300;
let velocity = 0;

const gravity = 0.5;
const jumpStrength = -8;

let gameStarted = false;
let gameOver = false;
let score = 0;
let pipes = [];
let frameCount = 0;


/* =========================
   CAMERA UI STATE
========================= */

const cameraBaseElements = Array.from(cameraScreen.children);
let gameOverOverlay = null;

function showCameraBase() {
    cameraBaseElements.forEach((element) => {
        element.style.display = "";
    });
}

function hideCameraBase() {
    cameraBaseElements.forEach((element) => {
        element.style.display = "none";
    });
}

function resetCameraUI() {
    if (gameOverOverlay) {
        gameOverOverlay.remove();
        gameOverOverlay = null;
    }

    showCameraBase();

    camera.style.display = "block";
    photoPreview.style.display = "none";
    takePhotoButton.style.display = "inline-block";
    retakeButton.style.display = "none";
    nameSection.style.display = "none";
    cameraError.textContent = "";
}

function showCameraError(error) {
    console.error("Camera error:", error);

    if (error?.name === "NotAllowedError") {
        cameraError.textContent =
            "Camera permission is blocked. Allow camera access in your browser.";
        return;
    }

    if (error?.name === "NotFoundError") {
        cameraError.textContent =
            "No camera was found on this device.";
        return;
    }

    if (error?.name === "NotReadableError") {
        cameraError.textContent =
            "The camera is being used by another app.";
        return;
    }

    cameraError.textContent =
        "Unable to open the camera. Please allow camera access.";
}


/* =========================
   CAMERA
========================= */

async function startCamera() {
    if (cameraStarting) {
        return false;
    }

    if (stream && stream.getVideoTracks().some((track) => track.readyState === "live")) {
        return true;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        cameraError.textContent =
            "Camera is not supported by this browser.";
        return false;
    }

    cameraStarting = true;

    try {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: "user"
                    }
                },
                audio: false
            });
        } catch (firstError) {
            console.warn("Front camera request failed; trying default camera.", firstError);

            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
        }

        camera.srcObject = stream;
        camera.muted = true;
        camera.autoplay = true;
        camera.playsInline = true;
        camera.setAttribute("playsinline", "");
        camera.setAttribute("webkit-playsinline", "");
        camera.style.transform = "scaleX(1)";
        camera.style.display = "block";

        await new Promise((resolve) => {
            if (camera.readyState >= 2 && camera.videoWidth > 0) {
                resolve();
                return;
            }

            const done = () => {
                camera.removeEventListener("loadedmetadata", done);
                resolve();
            };

            camera.addEventListener("loadedmetadata", done, { once: true });
        });

        try {
            await camera.play();
        } catch (playError) {
            console.warn("Camera play warning:", playError);
        }

        cameraStarting = false;
        cameraError.textContent = "";
        return true;
    } catch (error) {
        cameraStarting = false;
        stream = null;
        showCameraError(error);
        return false;
    }
}

startCamera();


/* =========================
   TAKE PHOTO
========================= */

async function waitForVideoReady(timeoutMs = 4000) {
    const startTime = Date.now();

    while (
        Date.now() - startTime < timeoutMs &&
        (!camera.videoWidth || !camera.videoHeight)
    ) {
        await new Promise(function(resolve) {
            window.setTimeout(resolve, 100);
        });
    }

    return Boolean(
        camera.videoWidth &&
        camera.videoHeight
    );
}

async function takePhoto() {
    // If the stream is not ready, start/request it now.
    if (
        !stream ||
        !camera.videoWidth ||
        !camera.videoHeight
    ) {
        cameraError.textContent = "Starting camera...";

        const ready = await startCamera();

        if (!ready) {
            return;
        }
    }

    // Wait for actual video frames/dimensions on slower phones.
    const videoReady = await waitForVideoReady();

    if (!videoReady) {
        cameraError.textContent =
            "Camera is not ready yet. Please tap Take Photo again.";
        return;
    }

    photoCanvas.width = camera.videoWidth;
    photoCanvas.height = camera.videoHeight;

    const context = photoCanvas.getContext("2d");

    if (!context) {
        cameraError.textContent = "Unable to capture the photo.";
        return;
    }

    context.drawImage(
        camera,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
    );

    playerPhoto = photoCanvas.toDataURL("image/png");

    photoPreview.src = playerPhoto;
    photoPreview.style.display = "block";
    camera.style.display = "none";
    takePhotoButton.style.display = "none";
    retakeButton.style.display = "inline-block";
    nameSection.style.display = "flex";
    cameraError.textContent = "";

    if (stream) {
        stream.getTracks().forEach(function(track) {
            track.stop();
        });
        stream = null;
    }
}

let takePhotoBusy = false;
let lastTakePhotoActivation = 0;

async function handleTakePhoto(event) {
    const now = Date.now();

    // Prevent duplicate pointer/touch/click activation.
    if (now - lastTakePhotoActivation < 700) {
        return;
    }

    if (takePhotoBusy) {
        return;
    }

    lastTakePhotoActivation = now;
    takePhotoBusy = true;

    if (event) {
        if (event.cancelable) {
            event.preventDefault();
        }
        event.stopPropagation();
    }

    try {
        await takePhoto();
    } finally {
        takePhotoBusy = false;
    }
}

// Primary handler for touch, pen, and mouse.
takePhotoButton.addEventListener(
    "pointerdown",
    handleTakePhoto,
    { passive: false }
);

// Keyboard activation / older browser fallback.
takePhotoButton.addEventListener(
    "click",
    handleTakePhoto
);

/* =========================
   RETAKE PHOTO
========================= */

async function retakePhoto() {
    photoPreview.style.display = "none";
    retakeButton.style.display = "none";
    nameSection.style.display = "none";
    takePhotoButton.style.display = "inline-block";
    camera.style.display = "block";
    cameraError.textContent = "";

    await startCamera();
}

function handleRetake(event) {
    event.preventDefault();
    event.stopPropagation();
    void retakePhoto();
}

retakeButton.addEventListener("click", handleRetake);


/* =========================
   START GAME
========================= */

function startPlayerGame() {
    playerName = playerNameInput.value.trim();

    if (!playerName) {
        cameraError.textContent = "Please enter your name.";
        playerNameInput.focus();
        return;
    }

    if (!playerPhoto) {
        cameraError.textContent = "Please take your picture first.";
        return;
    }

    birdImage.src = playerPhoto;
    birdImage.style.transform = "scaleX(1)";
    startGame();
}

function handleStartGame(event) {
    event.preventDefault();
    event.stopPropagation();
    startPlayerGame();
}

startButton.addEventListener("click", handleStartGame);


/* =========================
   JUMP
========================= */

function jump() {
    if (!gameStarted || gameOver) {
        return;
    }

    velocity = jumpStrength;
}


document.addEventListener("keydown", function (event) {
    if (event.code === "Space") {
        event.preventDefault();
        jump();
    }
});


/* =========================
   GAME TAP CONTROL
========================= */

game.addEventListener("pointerdown", function (event) {
    if (
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("a")
    ) {
        return;
    }

    if (!gameStarted || gameOver) {
        return;
    }

    event.preventDefault();
    jump();
});


/* =========================
   DIFFICULTY
========================= */

function getDifficulty() {
    const gap = Math.max(
        180,
        240 - score * 2
    );

    const speed = Math.min(
        5,
        2.5 + score * 0.08
    );

    return {
        gap,
        speed
    };
}


/* =========================
   CREATE PIPE
========================= */

function createPipe() {
    const difficulty = getDifficulty();
    const gap = difficulty.gap;

    const maxTop = 550 - gap;
    const minTop = 80;

    const topHeight =
        Math.floor(
            Math.random() * (maxTop - minTop)
        ) + minTop;

    const bottomHeight =
        700 - topHeight - gap;

    const topPipe = document.createElement("div");
    topPipe.classList.add("pipe", "topPipe");
    topPipe.style.width = "65px";
    topPipe.style.height = `${topHeight}px`;

    const bottomPipe = document.createElement("div");
    bottomPipe.classList.add("pipe", "bottomPipe");
    bottomPipe.style.width = "65px";
    bottomPipe.style.height = `${bottomHeight}px`;

    topPipe.style.left = "500px";
    bottomPipe.style.left = "500px";

    game.appendChild(topPipe);
    game.appendChild(bottomPipe);

    pipes.push({
        top: topPipe,
        bottom: bottomPipe,
        x: 500,
        passed: false
    });
}


/* =========================
   COLLISION
========================= */

function checkCollision(birdRect, pipeRect) {
    return !(
        birdRect.right < pipeRect.left ||
        birdRect.left > pipeRect.right ||
        birdRect.bottom < pipeRect.top ||
        birdRect.top > pipeRect.bottom
    );
}


/* =========================
   SAVE SCORE
========================= */

async function saveScore() {
    if (score <= 0) {
        return;
    }

    try {
        const authenticated = await ensureAuth();

        if (!authenticated) {
            return;
        }

        const leaderboardRef = ref(database, "leaderboard");

        await push(leaderboardRef, {
            name: playerName,
            photo: playerPhoto,
            score
        });
    } catch (error) {
        console.error(
            "Error saving score to Firebase:",
            error
        );
    }
}


/* =========================
   GAME OVER
========================= */

async function endGame() {
    if (gameOver) {
        return;
    }

    gameOver = true;
    gameStarted = false;
    bird.style.display = "none";

    await saveScore();
    showGameOver();
}


/* =========================
   GAME OVER SCREEN
========================= */

function showGameOver() {
    if (gameOverOverlay) {
        gameOverOverlay.remove();
    }

    hideCameraBase();

    gameOverOverlay = document.createElement("div");
    gameOverOverlay.className = "gameOverOverlay";

    gameOverOverlay.innerHTML = `
        <img
            src="${playerPhoto}"
            class="gameOverFace"
            alt="Player"
        >

        <h1>GAME OVER</h1>

        <p class="gameOverName"></p>

        <p class="gameOverScore"></p>

        <button id="playAgainButton" class="btn btn--primary">
            Play Again
        </button>

        <button id="showLeaderboardButton" class="btn btn--primary">
            Leaderboard
        </button>
    `;

    gameOverOverlay.querySelector(".gameOverName").textContent = playerName;
    gameOverOverlay.querySelector(".gameOverScore").textContent = `Score: ${score}`;

    cameraScreen.appendChild(gameOverOverlay);
    cameraScreen.style.display = "flex";

    gameOverOverlay
        .querySelector("#playAgainButton")
        .addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            startGame();
        });

    gameOverOverlay
        .querySelector("#showLeaderboardButton")
        .addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            void showLeaderboard();
        });
}


/* =========================
   START / RESTART GAME
========================= */

function startGame() {
    pipes.forEach(function (pipe) {
        pipe.top.remove();
        pipe.bottom.remove();
    });

    pipes = [];

    birdY = 300;
    velocity = 0;
    score = 0;
    frameCount = 0;
    gameOver = false;
    gameStarted = true;

    scoreDisplay.textContent = "0";
    bird.style.top = `${birdY}px`;
    birdImage.src = playerPhoto;
    birdImage.style.transform = "scaleX(1)";
    bird.style.display = "block";

    if (gameOverOverlay) {
        gameOverOverlay.remove();
        gameOverOverlay = null;
    }

    showCameraBase();
    cameraScreen.style.display = "none";
}


/* =========================
   ONLINE LEADERBOARD
========================= */

async function showLeaderboard() {
    cameraScreen.style.display = "none";
    leaderboardScreen.style.display = "flex";
    leaderboardList.innerHTML = "<p>Loading leaderboard…</p>";

    try {
        const authenticated = await ensureAuth();

        if (!authenticated) {
            throw new Error("Firebase authentication failed.");
        }

        const leaderboardRef = ref(
            database,
            "leaderboard"
        );

        const topScoresQuery = query(
            leaderboardRef,
            orderByChild("score"),
            limitToLast(10)
        );

        const snapshot = await get(topScoresQuery);

        leaderboardList.innerHTML = "";

        if (!snapshot.exists()) {
            leaderboardList.innerHTML = "<p>No scores yet.</p>";
            return;
        }

        const entries = [];

        snapshot.forEach(function (child) {
            const data = child.val();

            if (
                data &&
                typeof data.name === "string" &&
                typeof data.photo === "string" &&
                typeof data.score === "number"
            ) {
                entries.push(data);
            }
        });

        entries.sort(function (a, b) {
            return b.score - a.score;
        });

        entries.forEach(function (player, index) {
            const row = document.createElement("div");
            row.className = "leaderboardRow";

            const image = document.createElement("img");
            image.src = player.photo;
            image.alt = "Player";

            const name = document.createElement("span");
            name.textContent = `${index + 1}. ${player.name}`;

            const scoreElement = document.createElement("span");
            scoreElement.textContent = String(player.score);

            row.appendChild(image);
            row.appendChild(name);
            row.appendChild(scoreElement);

            leaderboardList.appendChild(row);
        });
    } catch (error) {
        console.error(
            "Error loading leaderboard from Firebase:",
            error
        );

        leaderboardList.innerHTML =
            "<p>Couldn't load leaderboard.</p>";
    }
}


/* =========================
   BACK BUTTON
========================= */

backButton.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();

    leaderboardScreen.style.display = "none";

    if (gameOverOverlay) {
        cameraScreen.style.display = "flex";
    } else {
        cameraScreen.style.display = "flex";
    }
});


/* =========================
   GAME LOOP
========================= */

function gameLoop() {
    if (gameStarted) {
        frameCount++;

        /* GRAVITY */
        velocity += gravity;
        birdY += velocity;
        bird.style.top = `${birdY}px`;

        /* GROUND */
        if (birdY >= 640) {
            birdY = 640;
            void endGame();
        }

        /* CEILING */
        if (birdY <= 0) {
            birdY = 0;
            velocity = 0;
        }

        /* CREATE PIPES */
        if (frameCount % 120 === 0) {
            createPipe();
        }

        /* MOVE PIPES */
        const difficulty = getDifficulty();

        pipes.forEach(function (pipe) {
            pipe.x -= difficulty.speed;

            pipe.top.style.left = `${pipe.x}px`;
            pipe.bottom.style.left = `${pipe.x}px`;

            /* SCORE */
            if (!pipe.passed && pipe.x < 100) {
                pipe.passed = true;
                score++;
                scoreDisplay.textContent = String(score);
            }

            /* COLLISION */
            const birdRect = bird.getBoundingClientRect();
            const topRect = pipe.top.getBoundingClientRect();
            const bottomRect = pipe.bottom.getBoundingClientRect();

            if (
                checkCollision(birdRect, topRect) ||
                checkCollision(birdRect, bottomRect)
            ) {
                void endGame();
            }
        });

        /* REMOVE OLD PIPES */
        pipes = pipes.filter(function (pipe) {
            if (pipe.x < -100) {
                pipe.top.remove();
                pipe.bottom.remove();
                return false;
            }

            return true;
        });
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
