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

        authReady =
            signInAnonymously(auth)
                .then(function () {
                    return true;
                })
                .catch(function (error) {

                    console.error(
                        "Firebase auth error:",
                        error
                    );

                    return false;

                });

    }

    return authReady;

}

// Start signing in right away so it's ready by the time
// a score needs to be saved or the leaderboard is opened.
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

const leaderboardScreen =
    document.getElementById("leaderboardScreen");

const leaderboardList =
    document.getElementById("leaderboardList");

const backButton =
    document.getElementById("backButton");

// Hide player character until game starts
bird.style.display = "none";


/* =========================
   PLAYER DATA
========================= */

let playerName = "";
let playerPhoto = "";

let stream = null;


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
   CAMERA
========================= */

async function startCamera() {

    try {

        stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

        camera.srcObject = stream;

    } catch (error) {

        cameraError.textContent =
            "Please allow camera access.";

        console.error(error);
    }
}

startCamera();


/* =========================
   TAKE PHOTO
========================= */

takePhotoButton.addEventListener("click", function () {

    if (!camera.videoWidth) {
        return;
    }

    photoCanvas.width = camera.videoWidth;
    photoCanvas.height = camera.videoHeight;

    const context =
        photoCanvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
    );

    playerPhoto =
        photoCanvas.toDataURL("image/png");

    photoPreview.src = playerPhoto;

    photoPreview.style.display = "block";

    camera.style.display = "none";

    takePhotoButton.style.display = "none";

    retakeButton.style.display = "block";

    nameSection.style.display = "flex";


    // Stop camera

    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

    }

});


/* =========================
   RETAKE PHOTO
========================= */

retakeButton.addEventListener("click", function () {

    photoPreview.style.display = "none";

    retakeButton.style.display = "none";

    nameSection.style.display = "none";

    takePhotoButton.style.display = "block";

    camera.style.display = "block";

    startCamera();

});


/* =========================
   START GAME
========================= */

startButton.addEventListener("click", function () {

    playerName =
        playerNameInput.value.trim();


    if (playerName === "") {

        cameraError.textContent =
            "Please enter your name.";

        return;
    }


    if (playerPhoto === "") {

        cameraError.textContent =
            "Please take your picture first.";

        return;
    }


    // Put player's face on bird

    birdImage.src = playerPhoto;

    // Show player only when game starts
    bird.style.display = "block";

    // Hide camera screen
    cameraScreen.style.display = "none";


    // Start game
    startGame();

});


/* =========================
   JUMP
========================= */

function jump() {

    if (!gameStarted || gameOver) {
        return;
    }

    velocity = jumpStrength;
}


document.addEventListener(
    "keydown",
    function (event) {

        if (event.code === "Space") {

            event.preventDefault();

            jump();
        }

    }
);


game.addEventListener(
    "click",
    function (event) {

        if (
            event.target.tagName !== "BUTTON" &&
            event.target.tagName !== "INPUT"
        ) {

            jump();
        }

    }
);

/* =========================
   MOBILE TOUCH CONTROL
========================= */

game.addEventListener(
    "touchstart",
    function (event) {

        // Prevent scrolling while playing
        event.preventDefault();

        // Do nothing when pressing buttons or input
        if (
            event.target.tagName === "BUTTON" ||
            event.target.tagName === "INPUT"
        ) {
            return;
        }

        jump();
    },
    { passive: false }
);


/* =========================
   DIFFICULTY
========================= */

function getDifficulty() {

    const gap =
        Math.max(
            180,
            240 - score * 2
        );

    const speed =
        Math.min(
            5,
            2.5 + score * 0.08
        );

    return {
        gap: gap,
        speed: speed
    };

}


/* =========================
   CREATE PIPE
========================= */

function createPipe() {

    const difficulty =
        getDifficulty();

    const gap =
        difficulty.gap;


    const maxTop =
        550 - gap;

    const minTop = 80;


    const topHeight =
        Math.floor(
            Math.random() *
            (maxTop - minTop)
        ) + minTop;


    const bottomHeight =
        700 -
        topHeight -
        gap;


    const topPipe =
        document.createElement("div");

    topPipe.classList.add(
        "pipe",
        "topPipe"
    );

    topPipe.style.width = "65px";

    topPipe.style.height =
        topHeight + "px";


    const bottomPipe =
        document.createElement("div");

    bottomPipe.classList.add(
        "pipe",
        "bottomPipe"
    );

    bottomPipe.style.width = "65px";

    bottomPipe.style.height =
        bottomHeight + "px";


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

function checkCollision(
    birdRect,
    pipeRect
) {

    return !(
        birdRect.right <
        pipeRect.left ||

        birdRect.left >
        pipeRect.right ||

        birdRect.bottom <
        pipeRect.top ||

        birdRect.top >
        pipeRect.bottom
    );

}


/* =========================
   GAME OVER
========================= */

function endGame() {

    if (gameOver) {
        return;
    }

    gameOver = true;

    gameStarted = false;

    saveScore();

    setTimeout(function () {

        showGameOver();

    }, 300);

}


/* =========================
   SAVE SCORE (Firebase Realtime Database)
========================= */

async function saveScore() {

    // Don't save zero score
    if (score <= 0) {
        return;
    }

    try {

        await ensureAuth();

        const leaderboardRef =
            ref(database, "leaderboard");

        await push(leaderboardRef, {

            name: playerName,

            photo: playerPhoto,

            score: score

        });

    } catch (error) {

        console.error(
            "Error saving score to Firebase:",
            error
        );

    }

}


/* =========================
   GAME OVER SCREEN
========================= */

function showGameOver() {

    // Hide player character
    bird.style.display = "none";

    cameraScreen.style.display = "flex";

    cameraScreen.innerHTML = `

        <img
            src="${playerPhoto}"
            class="gameOverFace"
            alt="Player"
        >

        <h1>GAME OVER</h1>

        <p class="gameOverName">
            ${playerName}
        </p>

        <p class="gameOverScore">
            Score: ${score}
        </p>

        <button id="playAgainButton">
            PLAY AGAIN
        </button>

        <button id="showLeaderboardButton">
            LEADERBOARD
        </button>

    `;


    document
        .getElementById("playAgainButton")
        .addEventListener(
            "click",
            function () {

                startGame();

            }
        );


    document
        .getElementById(
            "showLeaderboardButton"
        )
        .addEventListener(
            "click",
            function () {

                showLeaderboard();

            }
        );

}


/* =========================
   START / RESTART GAME
========================= */

function startGame() {

    // Remove old pipes

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


    bird.style.top =
        birdY + "px";


    birdImage.src =
        playerPhoto;

    // Show player character
    bird.style.display = "block";


    cameraScreen.style.display =
        "none";

}


/* =========================
   LEADERBOARD (Firebase Realtime Database)
========================= */

async function showLeaderboard() {

    // Hide game over/camera screen
    cameraScreen.style.display =
        "none";

    leaderboardScreen.style.display =
        "flex";


    leaderboardList.innerHTML =
        "<p>Loading leaderboard…</p>";


    try {

        await ensureAuth();

        const leaderboardRef =
            ref(database, "leaderboard");

        const topScoresQuery =
            query(
                leaderboardRef,
                orderByChild("score"),
                limitToLast(10)
            );

        const snapshot =
            await get(topScoresQuery);


        leaderboardList.innerHTML =
            "";


        if (!snapshot.exists()) {

            leaderboardList.innerHTML =
                "<p>No scores yet.</p>";

            return;

        }


        let entries = [];

        snapshot.forEach(function (child) {

            entries.push(child.val());

        });

        // limitToLast returns ascending order,
        // so put the highest score first.
        entries.sort(
            (a, b) =>
                b.score - a.score
        );


        entries.forEach(
            function (player, index) {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "leaderboardRow";


                row.innerHTML = `

                    <img
                        src="${player.photo}"
                        alt="Player"
                    >

                    <span>
                        ${index + 1}.
                        ${player.name}
                    </span>

                    <span>
                        ${player.score}
                    </span>

                `;


                leaderboardList.appendChild(
                    row
                );

            }
        );

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

backButton.addEventListener(
    "click",
    function () {

        leaderboardScreen.style.display =
            "none";

        cameraScreen.style.display =
            "flex";

    }
);


/* =========================
   GAME LOOP
========================= */

function gameLoop() {

    if (gameStarted) {

        frameCount++;


        /* GRAVITY */

        velocity += gravity;

        birdY += velocity;


        bird.style.top =
            birdY + "px";


        /* GROUND */

        if (birdY >= 640) {

            birdY = 640;

            endGame();

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

        const difficulty =
            getDifficulty();


        pipes.forEach(
            function (pipe) {

                pipe.x -=
                    difficulty.speed;


                pipe.top.style.left =
                    pipe.x + "px";


                pipe.bottom.style.left =
                    pipe.x + "px";


                /* SCORE */

                if (
                    !pipe.passed &&
                    pipe.x < 100
                ) {

                    pipe.passed = true;

                    score++;

                    scoreDisplay.textContent =
                        score;

                }


                /* COLLISION */

                const birdRect =
                    bird.getBoundingClientRect();


                const topRect =
                    pipe.top.getBoundingClientRect();


                const bottomRect =
                    pipe.bottom.getBoundingClientRect();


                if (
                    checkCollision(
                        birdRect,
                        topRect
                    ) ||
                    checkCollision(
                        birdRect,
                        bottomRect
                    )
                ) {

                    endGame();

                }

            }
        );


        /* REMOVE OLD PIPES */

        pipes =
            pipes.filter(
                function (pipe) {

                    if (pipe.x < -100) {

                        pipe.top.remove();

                        pipe.bottom.remove();

                        return false;

                    }

                    return true;

                }
            );

    }


    requestAnimationFrame(
        gameLoop
    );

}


gameLoop();
