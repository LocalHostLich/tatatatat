let gameData = {};
let START_DATE, TARGET_DATE;
let currentQIndex = -1;
let falloutTries = 4;
let isFalloutLocked = false;
let currentFalloutWords = [];

const tickAudio = document.getElementById('tick-audio');
const hoverAudio = document.getElementById('hover-audio');
const dataSound = document.getElementById('data-sound');
const bgMusic = document.getElementById('bg-music');

const symbolsArray = "!@#$%^&*-=_+/?|;";
const bracketPairs = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']];
let baseHex = 0x5BA0;

window.onload = () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            gameData = data;
            START_DATE = parseInt(fromBase64(data.settings.start_date));
            TARGET_DATE = parseInt(fromBase64(data.settings.target_date));
        })
        .catch(err => console.error(err));
};

function fromBase64(str) { try { return decodeURIComponent(escape(atob(str))); } catch (e) { return ""; } }
function toBase64(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return ""; } }

// --- ЗВУК ПРИ ПОСОЧВАНЕ ---
window.playHoverSound = function () {
    if (isFalloutLocked) return;
    hoverAudio.currentTime = 0;
    hoverAudio.volume = 0.2;
    hoverAudio.play().catch(() => { });
}

// --- ПЪРВОНАЧАЛЕН ЕКРАН И ЛОГВАНЕ ---
document.getElementById('start-overlay').addEventListener('click', function () {
    this.style.opacity = '0';
    setTimeout(() => {
        this.style.display = 'none';
        startLoginSequence();
    }, 500);
});

function typeText(elementId, text, speed, callback) {
    let i = 0;
    const el = document.getElementById(elementId);
    function type() {
        if (i < text.length) {
            el.innerHTML += text.charAt(i);
            tickAudio.currentTime = 0; tickAudio.play().catch(() => { });
            i++; setTimeout(type, speed);
        } else if (callback) { setTimeout(callback, 500); }
    }
    type();
}

function startLoginSequence() {
    document.getElementById('login-screen').style.display = 'flex';
    typeText('auto-username', 'root', 150, () => {
        document.getElementById('user-cursor').style.display = 'none';
        document.getElementById('pass-cursor').style.display = 'inline-block';
        typeText('auto-password', '********', 150, () => {
            setTimeout(bootTerminal, 600);
        });
    });
}

function bootTerminal() {
    document.getElementById('login-screen').style.display = 'none';
    const term = document.getElementById('terminal-screen');
    term.style.display = 'flex';
    dataSound.loop = true; dataSound.play().catch(() => { });

    const lines = [
        "> INITIALIZING ROBCO SYSTEM SECURE BOOT...",
        "> MEMORY CHECK: 640K OK.",
        "> LOADING KERNEL PROTOCOLS...",
        "> ACCESSING DOOMSDAY MAINFRAME...",
        "> WELCOME, ADMINISTRATOR."
    ];

    let i = 0;
    function printLine() {
        if (i < lines.length) {
            term.innerHTML += `<div class="terminal-line">${lines[i]}</div>`;
            i++; setTimeout(printLine, 600);
        } else {
            dataSound.pause();
            setTimeout(() => {
                term.style.display = 'none';
                document.getElementById('main-ui').style.display = 'flex';
                bgMusic.volume = 0.4; bgMusic.play().catch(() => { });
                startMainLoop();
            }, 1000);
        }
    }
    printLine();
}

// --- БРОЯЧ И НАВИГАЦИЯ ---
function startMainLoop() {
    updateTimerAndNav();
    setInterval(updateTimerAndNav, 1000);
}

function updateTimerAndNav() {
    const now = new Date().getTime();
    const distance = TARGET_DATE - now;

    if (distance > 0) {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = d < 10 ? "0" + d : d;
        document.getElementById('hours').innerText = h < 10 ? "0" + h : h;
        document.getElementById('minutes').innerText = m < 10 ? "0" + m : m;
        document.getElementById('seconds').innerText = s < 10 ? "0" + s : s;
    }

    const daysSinceStart = Math.floor((now - START_DATE) / (1000 * 60 * 60 * 24));
    const activeQuestions = Math.min(Math.max(daysSinceStart + 1, 0), gameData.questions.length);
    renderNav(activeQuestions);
}

function renderNav(count) {
    const nav = document.getElementById('question-nav');
    if (nav.children.length !== count) {
        nav.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const circle = document.createElement('div');
            circle.className = 'nav-circle';
            circle.innerText = gameData.questions[i].id;
            circle.onclick = () => openQuestion(i);
            nav.appendChild(circle);
        }
    }
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('question-modal').style.display = 'none';
};

// --- ОТВАРЯНЕ НА ВЪПРОСИТЕ ---
function openQuestion(index) {
    currentQIndex = index;
    const q = gameData.questions[index];

    document.getElementById('modal-title').innerText = `СЕКТОР ${q.id}`;
    document.getElementById('error-msg').innerText = '';
    document.getElementById('success-msg').innerText = '';
    document.getElementById('fallout-container').style.display = 'block';

    initFalloutGame(q);
    document.getElementById('question-modal').style.display = 'flex';
}

// --- FALLOUT ХАКВАНЕ ЛОГИКА ---
function initFalloutGame(q) {
    isFalloutLocked = true;
    falloutTries = 4;
    updateAttemptsDisplay();

    document.getElementById('lower-diff-btn').style.display = 'none';
    document.getElementById('restart-fallout-btn').style.display = 'none';

    const log = document.getElementById('fallout-log');
    log.innerHTML = '';

    const targetWord = fromBase64(q.a);
    let wordPool = q.words.filter(w => w !== targetWord);
    wordPool = wordPool.sort(() => 0.5 - Math.random()).slice(0, 7);
    currentFalloutWords = [targetWord, ...wordPool].sort(() => 0.5 - Math.random());

    generateFalloutGrid(q);
}

function updateAttemptsDisplay() {
    let blocks = "";
    for (let i = 0; i < falloutTries; i++) blocks += "■ ";
    document.getElementById('fallout-attempts-blocks').innerText = blocks.trim();
}

function generateFalloutGrid(q) {
    const charsPerRow = 12;
    const rowsPerCol = 16;
    const totalSlots = rowsPerCol * 2;

    let availableRows = Array.from({ length: totalSlots }, (_, i) => i);
    let rowAssignments = {};

    currentFalloutWords.forEach(word => {
        const randIndex = Math.floor(Math.random() * availableRows.length);
        const rowNum = availableRows.splice(randIndex, 1)[0];
        rowAssignments[rowNum] = word;
    });

    let currentHex = baseHex;
    let leftRowsArray = [];
    let rightRowsArray = [];

    for (let i = 0; i < totalSlots; i++) {
        let hexStr = "0x" + currentHex.toString(16).toUpperCase();
        currentHex += 12;
        let rowContent = "";

        if (rowAssignments[i]) {
            const word = rowAssignments[i];
            const maxPadding = charsPerRow - word.length;
            const padLeft = Math.floor(Math.random() * (maxPadding + 1));
            const padRight = maxPadding - padLeft;

            rowContent += generateClickableSymbols(padLeft);
            rowContent += `<span class="fallout-word" id="word-${word}" onmouseenter="playHoverSound()" onclick="processFalloutGuess('${word}')">${word}</span>`;
            rowContent += generateClickableSymbols(padRight);
        } else {
            rowContent += generateClickableSymbols(charsPerRow);
        }

        const finalRowHTML = `<div class="fallout-row"><span class="hex-code">${hexStr}</span><span class="fallout-text-block">${rowContent}</span></div>`;

        if (i < rowsPerCol) leftRowsArray.push(finalRowHTML);
        else rightRowsArray.push(finalRowHTML);
    }

    const leftCol = document.getElementById('fallout-grid-left');
    const rightCol = document.getElementById('fallout-grid-right');
    const log = document.getElementById('fallout-log');

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    let rowIndex = 0;
    function typeMatrixRow() {
        if (rowIndex < rowsPerCol) {
            leftCol.innerHTML += leftRowsArray[rowIndex];
            rightCol.innerHTML += rightRowsArray[rowIndex];
            tickAudio.currentTime = 0; tickAudio.play().catch(() => { });
            rowIndex++;
            setTimeout(typeMatrixRow, 25);
        } else {
            isFalloutLocked = false;
            log.innerHTML = `> <span class="block-cursor" id="log-cursor"></span>`;
        }
    }
    typeMatrixRow();
}

function generateClickableSymbols(length) {
    if (length < 2) return getRandomSymbolsStr(length);

    if (Math.random() < 0.3 && length >= 3) {
        const pair = bracketPairs[Math.floor(Math.random() * bracketPairs.length)];
        const groupLen = Math.floor(Math.random() * (length - 2)) + 2;
        const beforeLen = Math.floor(Math.random() * (length - groupLen));
        const afterLen = length - groupLen - beforeLen;

        let insideContent = "";
        for (let i = 0; i < groupLen - 2; i++) insideContent += symbolsArray[Math.floor(Math.random() * symbolsArray.length)];

        let safeBracketStr = (pair[0] + insideContent + pair[1]).replace(/'/g, "\\'");

        let html = getRandomSymbolsStr(beforeLen);
        html += `<span class="bracket-group" onmouseenter="playHoverSound()" onclick="processBracket(this, '${safeBracketStr}')">${pair[0]}${insideContent}${pair[1]}</span>`;
        html += getRandomSymbolsStr(afterLen);
        return html;
    } else {
        return getRandomSymbolsStr(length);
    }
}

function getRandomSymbolsStr(length) {
    let res = "";
    for (let i = 0; i < length; i++) {
        let char = symbolsArray[Math.floor(Math.random() * symbolsArray.length)];
        let safeChar = char === "'" ? "\\'" : (char === "\\" ? "\\\\" : char);
        res += `<span class="fallout-symbol" onmouseenter="playHoverSound()" onclick="processSymbolClick('${safeChar}')">${char}</span>`;
    }
    return res;
}

// --- КЛИКВАНЕ НА СКОБИ ---
window.processBracket = function (element, rawText) {
    if (isFalloutLocked || falloutTries <= 0) return;
    if (element.classList.contains('used-bracket')) return;

    element.classList.add('used-bracket');
    const log = document.getElementById('fallout-log');
    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');

    if (Math.random() < 0.25) {
        falloutTries = 4;
        updateAttemptsDisplay();
        log.innerHTML += `>${rawText}<br>>Allowance replenished.<br>> <span class="block-cursor" id="log-cursor"></span>`;
    } else {
        const q = gameData.questions[currentQIndex];
        const target = fromBase64(q.a);
        let duds = currentFalloutWords.filter(w => w !== target && !document.getElementById(`word-${w}`).classList.contains('disabled'));

        if (duds.length > 0) {
            let dudToRemove = duds[Math.floor(Math.random() * duds.length)];
            let el = document.getElementById(`word-${dudToRemove}`);
            let dots = "";
            for (let i = 0; i < dudToRemove.length; i++) dots += ".";
            el.innerText = dots;
            el.classList.add('disabled');
            el.onclick = null;
            log.innerHTML += `>${rawText}<br>>Dud removed.<br>> <span class="block-cursor" id="log-cursor"></span>`;
        } else {
            log.innerHTML += `>${rawText}<br>>Error.<br>> <span class="block-cursor" id="log-cursor"></span>`;
        }
    }
    log.scrollTop = log.scrollHeight;
}

// --- КЛИКВАНЕ НА ЕДИНИЧЕН СИМВОЛ ---
window.processSymbolClick = function (char) {
    if (isFalloutLocked || falloutTries <= 0) return;
    const log = document.getElementById('fallout-log');

    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');
    log.innerHTML += `>${char}<br>>Error<br>> <span class="block-cursor" id="log-cursor"></span>`;
    log.scrollTop = log.scrollHeight;
}

// --- КЛИКВАНЕ НА ДУМА ---
window.processFalloutGuess = function (guess) {
    if (isFalloutLocked || falloutTries <= 0) return;
    const q = gameData.questions[currentQIndex];
    const target = fromBase64(q.a);
    const log = document.getElementById('fallout-log');

    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');

    if (guess === target) {
        log.innerHTML += `>${guess}<br>>Exact match!<br>>Please wait while system<br>>is accessed.<br><span class="block-cursor" id="log-cursor"></span>`;
        document.getElementById('success-msg').innerText = `СЕКРЕТЕН КОД: ${fromBase64(q.code)}`;
        disableAllInteractables();
        document.getElementById('lower-diff-btn').style.display = 'none';
        return;
    }

    let likeness = 0;
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === target[i]) likeness++;
    }

    falloutTries--;
    updateAttemptsDisplay();
    log.innerHTML += `>${guess}<br>>Entry denied.<br>>Likeness=${likeness}<br>> <span class="block-cursor" id="log-cursor"></span>`;
    log.scrollTop = log.scrollHeight;

    if (falloutTries === 3) {
        document.getElementById('lower-diff-btn').style.display = 'block';
    }

    if (falloutTries === 0) {
        isFalloutLocked = true;
        log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');
        log.innerHTML += `>TERMINAL LOCKED.<br>>PRESS RESTART TO INITIALIZE NEW HACK.<br>`;
        log.scrollTop = log.scrollHeight;

        disableAllInteractables();
        document.getElementById('lower-diff-btn').style.display = 'none';
        document.getElementById('restart-fallout-btn').style.display = 'block';
    }
}

// --- БУТОНИ И ПОМОЩНИ ФУНКЦИИ ---
document.getElementById('lower-diff-btn').onclick = function () {
    document.getElementById('tutorial-modal').style.display = 'flex';
};

document.getElementById('restart-fallout-btn').onclick = function () {
    this.style.display = 'none';
    initFalloutGame(gameData.questions[currentQIndex]);
};

function disableAllInteractables() {
    document.querySelectorAll('.fallout-word, .fallout-symbol, .bracket-group').forEach(el => {
        el.classList.add('disabled');
        el.onclick = null;
    });
}