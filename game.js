/* =========================================================
   FIREBASE
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

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


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyDQwrHSGzxEPGhbJhQP5Ij2YT1AKPEMXQk",

    authDomain:
        "burdy-3836e.firebaseapp.com",

    databaseURL:
        "https://burdy-3836e-default-rtdb.firebaseio.com/",

    projectId:
        "burdy-3836e",

    storageBucket:
        "burdy-3836e.firebasestorage.app",

    messagingSenderId:
        "666892581152",

    appId:
        "1:666892581152:web:87ba6d960e2ea408143f45"
};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const firebaseApp =
    initializeApp(firebaseConfig);

const database =
    getDatabase(firebaseApp);

const auth =
    getAuth(firebaseApp);


/* =========================================================
   ANONYMOUS LOGIN
========================================================= */

let authReady =
    signInAnonymously(auth);

authReady.catch(function(error) {

    console.error(
        "Firebase authentication error:",
        error
    );

});


async function ensureAuth() {

    try {

        await authReady;

    } catch (error) {

        console.error(
            "Retrying Firebase authentication:",
            error
        );

        authReady =
            signInAnonymously(auth);

        await authReady;

    }

}


/* =========================================================
   HTML ELEMENTS
========================================================= */

const bird =
    document.getElementById("bird");

const birdImage =
    document.getElementById("birdImage");

const game =
    document.getElementById("game");

const scoreDisplay =
    document.getElementById("score");

const camera =
    document.getElementById("camera");

const photoCanvas =
    document.getElementById("photoCanvas");

const takePhotoButton =
    document.getElementById("takePhotoButton");

const retakeButton =
    document.getElementById("retakeButton");

const photoPreview =
    document.getElementById("photoPreview");

const nameSection =
    document.getElementById("nameSection");

const playerNameInput =
    document.getElementById("playerName");

const startButton =
    document.getElementById("startButton");

const cameraScreen =
    document.getElementById("cameraScreen");

const cameraError =
    document.getElementById("cameraError");

const leaderboardScreen =
    document.getElementById("leaderboardScreen");

const leaderboardList =
    document.getElementById("leaderboardList");

const backButton =
    document.getElementById("backButton");


/* =========================================================
   INITIAL STATE
========================================================= */

bird.style.display = "none";


/* =========================================================
   PLAYER DATA
========================================================= */

let playerName = "";
let playerPhoto = "";
let stream = null;

let cameraStarting = false;


/* =========================================================
   GAME DATA
========================================================= */

let birdY = 300;
let velocity = 0;

const gravity = 0.5;
const jumpStrength = -8;

let gameStarted = false;
let gameOver = false;

let score = 0;

let pipes = [];

let frameCount = 0;


/* =========================================================
   CAMERA ERROR MESSAGE
========================================================= */

function showCameraError(error) {

    console.error("Camera error:", error);


    if (
        error &&
        error.name === "NotAllowedError"
    ) {

        cameraError.textContent =
            "Camera permission is blocked. Please allow camera access in your browser.";

        return;

    }


    if (
        error &&
        error.name === "NotFoundError"
    ) {

        cameraError.textContent =
            "No camera was found on this device.";

        return;

    }


    if (
        error &&
        error.name === "NotReadableError"
    ) {

        cameraError.textContent =
            "The camera is being used by another app.";

        return;

    }


    if (
        error &&
        error.name === "SecurityError"
    ) {

        cameraError.textContent =
            "Camera access was blocked by the browser.";

        return;

    }


    cameraError.textContent =
        "Unable to open the camera. Please allow camera access.";

}


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

    if (cameraStarting) {
        return false;
    }


    if (stream) {

        if (
            stream.getVideoTracks().some(
                function(track) {

                    return track.readyState === "live";

                }
            )
        ) {

            return true;

        }

    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        cameraError.textContent =
            "Camera is not supported by this browser.";

        return false;

    }


    cameraStarting = true;


    try {

        /* =================================================
           FIRST TRY: FRONT CAMERA
        ================================================= */

        try {

            stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({

                        video: {
                            facingMode: {
                                ideal: "user"
                            }
                        },

                        audio: false

                    });

        } catch (firstError) {

            console.log(
                "Front camera failed. Trying default camera..."
            );


            /* =================================================
               FALLBACK: ANY CAMERA
            ================================================= */

            stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({

                        video: true,

                        audio: false

                    });

        }


        camera.srcObject =
            stream;


        camera.muted =
            true;


        camera.autoplay =
            true;


        camera.playsInline =
            true;


        camera.setAttribute(
            "playsinline",
            ""
        );


        camera.setAttribute(
            "webkit-playsinline",
            ""
        );


        camera.style.transform =
            "scaleX(1)";


        camera.style.display =
            "block";


        /*
            Wait for the camera to provide
            actual video dimensions.
        */

        await new Promise(
            function(resolve) {

                if (
                    camera.readyState >= 2 &&
                    camera.videoWidth > 0
                ) {

                    resolve();

                    return;

                }


                camera.onloadedmetadata =
                    function() {

                        resolve();

                    };

            }
        );


        try {

            await camera.play();

        } catch (playError) {

            console.log(
                "Camera play warning:",
                playError
            );

        }


        cameraStarting =
            false;


        cameraError.textContent =
            "Camera ready!";


        return true;


    } catch (error) {

        cameraStarting =
            false;


        stream =
            null;


        showCameraError(
            error
        );


        return false;

    }

}


/* =========================================================
   START CAMERA
========================================================= */

startCamera();


/* =========================================================
   TAKE PHOTO
========================================================= */

async function takePhoto() {

    /*
        If camera did not start yet,
        try starting it after the user
        presses the button.
    */

    if (
        !stream ||
        !camera.videoWidth ||
        !camera.videoHeight
    ) {

        cameraError.textContent =
            "Starting camera...";


        const cameraStarted =
            await startCamera();


        /*
            First tap only starts the camera
            if it was not ready.
        */

        if (
            !cameraStarted ||
            !camera.videoWidth ||
            !camera.videoHeight
        ) {

            return;

        }


        cameraError.textContent =
            "Camera is ready. Tap TAKE PHOTO again.";

        return;

    }


    /* =================================================
       CAPTURE
    ================================================= */

    photoCanvas.width =
        camera.videoWidth;

    photoCanvas.height =
        camera.videoHeight;


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
        photoCanvas.toDataURL(
            "image/png"
        );


    photoPreview.src =
        playerPhoto;


    photoPreview.style.display =
        "block";


    camera.style.display =
        "none";


    takePhotoButton.style.display =
        "none";


    retakeButton.style.display =
        "block";


    nameSection.style.display =
        "flex";


    cameraError.textContent =
        "";


    /* STOP CAMERA */

    if (stream) {

        stream
            .getTracks()
            .forEach(
                function(track) {

                    track.stop();

                }
            );


        stream =
            null;

    }

}


/* =========================================================
   TAKE PHOTO CLICK
========================================================= */

takePhotoButton.addEventListener(
    "click",
    async function(event) {

        event.preventDefault();

        event.stopPropagation();

        await takePhoto();

    }
);


/* =========================================================
   TAKE PHOTO MOBILE
========================================================= */

takePhotoButton.addEventListener(
    "touchend",
    async function(event) {

        event.preventDefault();

        event.stopPropagation();

        await takePhoto();

    },
    {
        passive: false
    }
);


/* =========================================================
   RETAKE PHOTO
========================================================= */

async function retakePhoto() {

    photoPreview.style.display =
        "none";


    retakeButton.style.display =
        "none";


    nameSection.style.display =
        "none";


    takePhotoButton.style.display =
        "block";


    camera.style.display =
        "block";


    cameraError.textContent =
        "Starting camera...";


    await startCamera();

}


retakeButton.addEventListener(
    "click",
    async function(event) {

        event.preventDefault();

        event.stopPropagation();

        await retakePhoto();

    }
);


retakeButton.addEventListener(
    "touchend",
    async function(event) {

        event.preventDefault();

        event.stopPropagation();

        await retakePhoto();

    },
    {
        passive: false
    }
);


/* =========================================================
   START PLAYER
========================================================= */

function startPlayerGame() {

    playerName =
        playerNameInput.value.trim();


    if (
        playerName === ""
    ) {

        cameraError.textContent =
            "Please enter your name.";

        return;

    }


    if (
        playerPhoto === ""
    ) {

        cameraError.textContent =
            "Please take your picture first.";

        return;

    }


    birdImage.src =
        playerPhoto;


    birdImage.style.transform =
        "scaleX(1)";


    bird.style.display =
        "block";


    cameraScreen.style.display =
        "none";


    startGame();

}


/* =========================================================
   START BUTTON
========================================================= */

startButton.addEventListener(
    "click",
    function(event) {

        event.preventDefault();

        event.stopPropagation();

        startPlayerGame();

    }
);


startButton.addEventListener(
    "touchend",
    function(event) {

        event.preventDefault();

        event.stopPropagation();

        startPlayerGame();

    },
    {
        passive: false
    }
);


/* =========================================================
   JUMP
========================================================= */

function jump() {

    if (
        !gameStarted ||
        gameOver
    ) {

        return;
    }


    velocity =
        jumpStrength;

}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.code === "Space"
        ) {

            event.preventDefault();

            jump();

        }

    }
);


/* =========================================================
   MOBILE / MOUSE TAP
========================================================= */

game.addEventListener(
    "pointerdown",
    function(event) {

        if (
            event.target.closest(
                "button"
            ) ||
            event.target.closest(
                "input"
            )
        ) {

            return;
        }


        if (
            !gameStarted ||
            gameOver
        ) {

            return;
        }


        event.preventDefault();

        jump();

    }
);


/* =========================================================
   DIFFICULTY
========================================================= */

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

        gap:
            gap,

        speed:
            speed

    };

}


/* =========================================================
   CREATE PIPE
========================================================= */

function createPipe() {

    const difficulty =
        getDifficulty();


    const gap =
        difficulty.gap;


    const maxTop =
        550 - gap;


    const minTop =
        80;


    const topHeight =
        Math.floor(
            Math.random() *
            (maxTop - minTop)
        ) +
        minTop;


    const bottomHeight =
        700 -
        topHeight -
        gap;


    /* TOP PIPE */

    const topPipe =
        document.createElement(
            "div"
        );


    topPipe.classList.add(
        "pipe",
        "topPipe"
    );


    topPipe.style.width =
        "65px";


    topPipe.style.height =
        topHeight + "px";


    /* BOTTOM PIPE */

    const bottomPipe =
        document.createElement(
            "div"
        );


    bottomPipe.classList.add(
        "pipe",
        "bottomPipe"
    );


    bottomPipe.style.width =
        "65px";


    bottomPipe.style.height =
        bottomHeight + "px";


    /* START POSITION */

    topPipe.style.left =
        "500px";


    bottomPipe.style.left =
        "500px";


    game.appendChild(
        topPipe
    );


    game.appendChild(
        bottomPipe
    );


    pipes.push({

        top:
            topPipe,

        bottom:
            bottomPipe,

        x:
            500,

        passed:
            false

    });

}


/* =========================================================
   COLLISION
========================================================= */

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


/* =========================================================
   SAVE SCORE
========================================================= */

async function saveScore() {

    if (
        score <= 0
    ) {

        return;
    }


    try {

        await ensureAuth();


        /* =================================================
           SMALL PHOTO
        ================================================= */

        const smallCanvas =
            document.createElement(
                "canvas"
            );


        const size =
            128;


        smallCanvas.width =
            size;


        smallCanvas.height =
            size;


        const context =
            smallCanvas.getContext(
                "2d"
            );


        const image =
            new Image();


        image.src =
            playerPhoto;


        await new Promise(
            function(resolve, reject) {

                image.onload =
                    resolve;

                image.onerror =
                    reject;

            }
        );


        const sourceSize =
            Math.min(
                image.width,
                image.height
            );


        const sourceX =
            (
                image.width -
                sourceSize
            ) / 2;


        const sourceY =
            (
                image.height -
                sourceSize
            ) / 2;


        context.drawImage(
            image,

            sourceX,
            sourceY,

            sourceSize,
            sourceSize,

            0,
            0,

            size,
            size
        );


        const smallPhoto =
            smallCanvas.toDataURL(
                "image/jpeg",
                0.65
            );


        const leaderboardRef =
            ref(
                database,
                "leaderboard"
            );


        await push(
            leaderboardRef,
            {

                name:
                    playerName,

                photo:
                    smallPhoto,

                score:
                    score

            }
        );


        console.log(
            "Score saved online!"
        );


    } catch (error) {

        console.error(
            "Could not save score:",
            error
        );

    }

}


/* =========================================================
   GAME OVER
========================================================= */

function endGame() {

    if (
        gameOver
    ) {

        return;
    }


    gameOver =
        true;


    gameStarted =
        false;


    bird.style.display =
        "none";


    saveScore()
        .finally(
            function() {

                showGameOver();

            }
        );

}


/* =========================================================
   GAME OVER SCREEN
========================================================= */

function showGameOver() {

    bird.style.display =
        "none";


    cameraScreen.style.display =
        "flex";


    cameraScreen.innerHTML = `

        <img
            src="${playerPhoto}"
            class="gameOverFace"
            alt="Player"
        >

        <h1>
            GAME OVER
        </h1>

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


    const playAgainButton =
        document.getElementById(
            "playAgainButton"
        );


    const showLeaderboardButton =
        document.getElementById(
            "showLeaderboardButton"
        );


    playAgainButton.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            startGame();

        }
    );


    playAgainButton.addEventListener(
        "touchend",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            startGame();

        },
        {
            passive: false
        }
    );


    showLeaderboardButton.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            showLeaderboard();

        }
    );


    showLeaderboardButton.addEventListener(
        "touchend",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            showLeaderboard();

        },
        {
            passive: false
        }
    );

}


/* =========================================================
   START / RESTART GAME
========================================================= */

function startGame() {

    pipes.forEach(
        function(pipe) {

            pipe.top.remove();

            pipe.bottom.remove();

        }
    );


    pipes = [];


    birdY =
        300;


    velocity =
        0;


    score =
        0;


    frameCount =
        0;


    gameOver =
        false;


    gameStarted =
        true;


    scoreDisplay.textContent =
        "0";


    bird.style.top =
        birdY + "px";


    birdImage.src =
        playerPhoto;


    birdImage.style.transform =
        "scaleX(1)";


    bird.style.display =
        "block";


    cameraScreen.style.display =
        "none";

}


/* =========================================================
   ONLINE LEADERBOARD
========================================================= */

async function showLeaderboard() {

    cameraScreen.style.display =
        "none";


    leaderboardScreen.style.display =
        "flex";


    leaderboardList.innerHTML =
        "<p>Loading leaderboard...</p>";


    try {

        await ensureAuth();


        const leaderboardRef =
            ref(
                database,
                "leaderboard"
            );


        const leaderboardQuery =
            query(

                leaderboardRef,

                orderByChild(
                    "score"
                ),

                limitToLast(
                    10
                )

            );


        const snapshot =
            await get(
                leaderboardQuery
            );


        leaderboardList.innerHTML =
            "";


        if (
            !snapshot.exists()
        ) {

            leaderboardList.innerHTML =
                "<p>No scores yet.</p>";

            return;

        }


        const players =
            [];


        snapshot.forEach(
            function(childSnapshot) {

                players.push(
                    childSnapshot.val()
                );

            }
        );


        players.sort(
            function(a, b) {

                return (
                    b.score -
                    a.score
                );

            }
        );


        players.forEach(
            function(player, index) {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "leaderboardRow";


                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    player.photo;


                image.alt =
                    "Player";


                const name =
                    document.createElement(
                        "span"
                    );


                name.textContent =
                    (
                        index + 1
                    ) +
                    ". " +
                    player.name;


                const scoreElement =
                    document.createElement(
                        "span"
                    );


                scoreElement.textContent =
                    player.score;


                row.appendChild(
                    image
                );


                row.appendChild(
                    name
                );


                row.appendChild(
                    scoreElement
                );


                leaderboardList.appendChild(
                    row
                );

            }
        );


    } catch (error) {

        console.error(
            "Leaderboard error:",
            error
        );


        leaderboardList.innerHTML =
            "<p>Unable to load leaderboard.</p>";

    }

}


/* =========================================================
   BACK BUTTON
========================================================= */

backButton.addEventListener(
    "click",
    function(event) {

        event.preventDefault();

        event.stopPropagation();


        leaderboardScreen.style.display =
            "none";


        cameraScreen.style.display =
            "flex";

    }
);


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop() {

    if (
        gameStarted
    ) {

        frameCount++;


        /* GRAVITY */

        velocity +=
            gravity;


        birdY +=
            velocity;


        bird.style.top =
            birdY + "px";


        /* GROUND */

        if (
            birdY >= 640
        ) {

            birdY =
                640;


            endGame();

        }


        /* CEILING */

        if (
            birdY <= 0
        ) {

            birdY =
                0;


            velocity =
                0;

        }


        /* CREATE PIPES */

        if (
            frameCount % 120 === 0
        ) {

            createPipe();

        }


        /* MOVE PIPES */

        const difficulty =
            getDifficulty();


        pipes.forEach(
            function(pipe) {

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

                    pipe.passed =
                        true;


                    score++;


                    scoreDisplay.textContent =
                        score;

                }


                /* COLLISION */

                const birdRect =
                    bird.getBoundingClientRect();


                const topRect =
                    pipe.top
                        .getBoundingClientRect();


                const bottomRect =
                    pipe.bottom
                        .getBoundingClientRect();


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
                function(pipe) {

                    if (
                        pipe.x < -100
                    ) {

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
