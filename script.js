(() => {
  "use strict";

  // --- Game settings -----------------------------------------------------
  const GOAL = 10; // first to this many wins takes the round

  // Each level is a smarter opponent.
  //   smartness: chance (0-1) the AI uses its Markov prediction instead of a random guess the more the smartness, the more percentage of AI's brain is used
  //   decay:how fast the AI forgets old habits (lower = adapts faster to you)
  const LEVELS = [
    { name: "Sleepy Sloth",  smartness: 0.50, decay: 0.50 },
    { name: "Cheeky Monkey", smartness: 0.70, decay: 0.50 },
    { name: "Sly Fox",       smartness: 0.84, decay: 0.50 },
    { name: "Wise Owl",      smartness: 0.93, decay: 0.50 },
    { name: "Grand Wizard",  smartness: 0.98, decay: 0.50 },
  ];

  // --- Game data ---------------------------------------------------------
  const CHOICES = ["rock", "paper", "scissors"];
  const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };
  const LABELS = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
  const COLORS = { rock: "#7b5cff", paper: "#ffb703", scissors: "#ff5d73" };

  // Simple inline SVG icons (no external images needed)
  const ICONS = {
    rock: (c) => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M22 62 L18 42 L34 24 L62 20 L82 34 L84 60 L68 80 L38 82 Z" fill="${c}"/>
      <path d="M34 24 L44 44 L62 20 M44 44 L38 82 M44 44 L84 60" stroke="#00000033" stroke-width="3" fill="none" stroke-linejoin="round"/>
    </svg>`,
    paper: (c) => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M22 12 H62 L80 30 V88 H22 Z" fill="${c}"/>
      <path d="M62 12 V30 H80" fill="#00000022"/>
      <path d="M32 46 H70 M32 58 H70 M32 70 H56" stroke="#00000033" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
    scissors: (c) => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M46 52 L20 12 L30 8 L54 46 Z" fill="${c}"/>
      <path d="M54 52 L80 12 L70 8 L46 46 Z" fill="${c}"/>
      <circle cx="30" cy="78" r="13" fill="none" stroke="${c}" stroke-width="7"/>
      <circle cx="70" cy="78" r="13" fill="none" stroke="${c}" stroke-width="7"/>
      <path d="M38 68 L48 52 M62 68 L52 52" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
    </svg>`,
  };

  // --- DOM ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const playerHand = $("player-hand");
  const computerHand = $("computer-hand");
  const playerName = $("player-name");
  const computerName = $("computer-name");
  const resultEl = $("result");
  const scoreEls = { player: $("score-player"), draw: $("score-draw"), computer: $("score-computer") };
  const meterPlayer = $("meter-player");
  const meterComputer = $("meter-computer");
  const levelTag = $("level-tag");
  const levelName = $("level-name");
  const choiceButtons = document.querySelectorAll(".choice");
  const resetBtn = $("reset");
  const resetAiBtn = $("reset-ai");
  const modeButtons = { learning: $("mode-learning"), random: $("mode-random") };
  const aiPredictionEl = $("ai-prediction");
  const aiAccuracyEl = $("ai-accuracy");
  const dialog = $("match-dialog");
  const dialogIcon = $("dialog-icon");
  const dialogTitle = $("dialog-title");
  const dialogText = $("dialog-text");
  const dialogAction = $("dialog-action");
  const confettiEl = $("confetti");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- State -------------------------------------------------------------
  const predictor = new MarkovPredictor({ maxOrder: 2, decay: LEVELS[0].decay });
  const scores = { player: 0, draw: 0, computer: 0 };
  const aiStats = { correct: 0, total: 0 };
  let mode = "learning"; // "learning" | "random"
  let level = 1;         // 1-based, only used in "learning" mode
  let locked = false;
  let pendingAction = null;
  let endTimer = null;
  function startGame()
  {
    if(endTimer){ 
      clearTimeout(endTimer); 
    }
    endTimer = setTimeout(() => 
      {
        console.log("Time's Up!!);
        locked = true;
      }, 300000);
  }
  // --- Helpers -----------------------------------------------------------
  const icon = (choice, color = COLORS[choice]) => ICONS[choice](color);
  const randomPick = () => CHOICES[Math.floor(Math.random() * CHOICES.length)];
  const counterTo = (move) => CHOICES.find((m) => BEATS[m] === move); // the move that beats `move`
  const currentLevel = () => LEVELS[level - 1];

  function getOutcome(player, computer) {
    if (player === computer) return "draw";
    return BEATS[player] === computer ? "win" : "lose";
  }

  function setLocked(value) {
    locked = value;
    choiceButtons.forEach((b) => (b.disabled = value));
  }

  function renderScores() {
    scoreEls.player.textContent = scores.player;
    scoreEls.draw.textContent = scores.draw;
    scoreEls.computer.textContent = scores.computer;
    meterPlayer.style.width = Math.min(100, (scores.player / GOAL) * 100) + "%";
    meterComputer.style.width = Math.min(100, (scores.computer / GOAL) * 100) + "%";
  }

  function renderLevel() {
    if (mode === "learning") {
      levelTag.textContent = `Level ${level} of ${LEVELS.length}`;
      levelName.textContent = currentLevel().name;
    } else {
      levelTag.textContent = "Casual play";
      levelName.textContent = "Random Rascal";
    }
  }

  function clearHandState() {
    [playerHand, computerHand].forEach((h) => h.classList.remove("win", "lose", "draw", "pop", "shake"));
  }

  function renderAiIdle() {
    aiPredictionEl.textContent =
      mode === "random" ? "The computer is picking at random." : "The AI learns your habits as you play.";
    aiAccuracyEl.textContent = "";
  }

  function renderAiInsight(prediction, actualMove, usedPrediction) {
    if (mode !== "learning") return;

    if (!prediction) {
      aiPredictionEl.textContent = "The AI has no data yet, so it guessed randomly.";
    } else {
      const basis =
        prediction.order === 0
          ? "your overall habits"
          : `your last ${prediction.order} move${prediction.order > 1 ? "s" : ""}`;
      const pct = Math.round(prediction.confidence * 100);
      const hit = prediction.move === actualMove ? "Correct." : "Missed.";
      const guess = usedPrediction ? "" : " It went with a random guess this time.";
      aiPredictionEl.textContent =
        `AI predicted ${LABELS[prediction.move]} (${pct}% sure, based on ${basis}). ${hit}${guess}`;
    }

    if (aiStats.total > 0) {
      const acc = Math.round((aiStats.correct / aiStats.total) * 100);
      aiAccuracyEl.textContent =
        `Predicted ${aiStats.correct} of ${aiStats.total} moves (${acc}%). Random guessing gets about 33%.`;
    }
  }

  // --- Game flow ---------------------------------------------------------
  function play(playerChoice) {
    if (locked) return;
    setLocked(true);
    clearHandState();

    resultEl.className = "result";
    resultEl.textContent = "Rock… paper… scissors…";
    playerName.textContent = "Your pick";
    computerName.textContent = "Computer's pick";

    // Show a fist for both during the "shake"
    playerHand.innerHTML = icon("rock");
    computerHand.innerHTML = icon("rock");

    const delay = reduceMotion.matches ? 0 : 650;
    if (delay) {
      playerHand.classList.add("shake");
      computerHand.classList.add("shake");
    }

    setTimeout(() => reveal(playerChoice), delay);
  }

  function reveal(playerChoice) {
    // The computer decides using ONLY past rounds, before seeing this move.
    let prediction = null;
    let usedPrediction = false;
    let computerChoice;
    if (mode === "learning") {
      prediction = predictor.predict();
      if (prediction && Math.random() < currentLevel().smartness) {
        computerChoice = counterTo(prediction.move);
        usedPrediction = true;
      } else {
        computerChoice = randomPick();
      }
    } else {
      computerChoice = randomPick();
    }

    const outcome = getOutcome(playerChoice, computerChoice);

    // Learn from this round (in both modes, so the model is ready when you switch)
    if (mode === "learning" && prediction) {
      aiStats.total++;
      if (prediction.move === playerChoice) aiStats.correct++;
    }
    predictor.update(playerChoice);

    clearHandState();
    playerHand.innerHTML = icon(playerChoice);
    computerHand.innerHTML = icon(computerChoice);
    playerName.textContent = LABELS[playerChoice];
    computerName.textContent = LABELS[computerChoice];
    playerHand.classList.add("pop");
    computerHand.classList.add("pop");

    if (outcome === "win") {
      scores.player++;
      playerHand.classList.add("win");
      computerHand.classList.add("lose");
      resultEl.textContent = `You win! ${LABELS[playerChoice]} beats ${LABELS[computerChoice]}.`;
    } else if (outcome === "lose") {
      scores.computer++;
      playerHand.classList.add("lose");
      computerHand.classList.add("win");
      resultEl.textContent = `You lose. ${LABELS[computerChoice]} beats ${LABELS[playerChoice]}.`;
    } else {
      scores.draw++;
      playerHand.classList.add("draw");
      computerHand.classList.add("draw");
      resultEl.textContent = `It's a draw. You both chose ${LABELS[playerChoice]}.`;
    }

    resultEl.classList.add(outcome === "win" ? "win" : outcome === "lose" ? "lose" : "draw");
    renderScores();
    renderAiInsight(prediction, playerChoice, usedPrediction);

    if (scores.player >= GOAL) endMatch("player");
    else if (scores.computer >= GOAL) endMatch("computer");
    else setLocked(false);
  }

  // --- Rounds and levels ---------------------------------------------------
  function startMatch() {
    clearTimeout(endTimer);
    if (dialog.open) dialog.close();
    scores.player = scores.draw = scores.computer = 0;
    if (mode === "learning") predictor.decay = currentLevel().decay;
    renderScores();
    renderLevel();

    clearHandState();
    playerHand.innerHTML = "";
    computerHand.innerHTML = "";
    playerName.textContent = "Your pick";
    computerName.textContent = "Computer's pick";
    resultEl.className = "result";
    resultEl.textContent = "Choose a move to start.";
    renderAiIdle();
    setLocked(false);
  }

  function endMatch(winner) {
    setLocked(true);
    // Short pause so the final hands stay visible before the dialog opens
    endTimer = setTimeout(() => showDialog(winner), reduceMotion.matches ? 0 : 900);
  }

  function showDialog(winner) {
    let emoji, title, text, action;

    if (winner === "player") {
      emoji = "🎉";
      if (mode === "learning" && level < LEVELS.length) {
        title = `Level ${level} cleared!`;
        text = `You beat ${currentLevel().name} ${scores.player} to ${scores.computer}. Next up: ${LEVELS[level].name}, and it's smarter.`;
        action = `Start level ${level + 1}`;
        pendingAction = () => { level++; startMatch(); };
      } else if (mode === "learning") {
        emoji = "🏆";
        title = "You're the Grand Champion!";
        text = `You beat all ${LEVELS.length} opponents. The Grand Wizard is speechless.`;
        action = "Play again from level 1";
        pendingAction = () => { level = 1; startMatch(); };
      } else {
        title = "You win the round!";
        text = `Final score: ${scores.player} to ${scores.computer}.`;
        action = "Play again";
        pendingAction = startMatch;
      }
    } else {
      emoji = "😅";
      title = mode === "learning" ? `${currentLevel().name} wins this round` : "The computer wins this round";
      text = `Final score: ${scores.computer} to ${scores.player}. Give it another go!`;
      action = "Try again";
      pendingAction = startMatch;
    }

    dialogIcon.textContent = emoji;
    dialogTitle.textContent = title;
    dialogText.textContent = text;
    dialogAction.textContent = action;

    if (winner === "player") burstConfetti();
    else confettiEl.innerHTML = "";

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialogAction.focus();
  }

  function burstConfetti() {
    confettiEl.innerHTML = "";
    if (reduceMotion.matches) return;
    const colors = ["#ffd23f", "#ff5d73", "#2ec4a0", "#7b5cff", "#57c7ff", "#ff8fcb"];
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement("i");
      piece.style.setProperty("--x", Math.random() * 100 + "%");
      piece.style.setProperty("--w", 6 + Math.random() * 7 + "px");
      piece.style.setProperty("--dur", 2.4 + Math.random() * 1.8 + "s");
      piece.style.setProperty("--delay", Math.random() * 0.7 + "s");
      piece.style.setProperty("--drift", Math.random() * 200 - 100 + "px");
      piece.style.background = colors[i % colors.length];
      confettiEl.appendChild(piece);
    }
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    for (const [name, btn] of Object.entries(modeButtons)) {
      btn.setAttribute("aria-pressed", String(name === mode));
    }
    level = 1;
    aiStats.correct = aiStats.total = 0;
    startMatch();
  }

  // --- Floating background icons -------------------------------------------
  function spawnFloaters() {
    const layer = document.createElement("div");
    layer.className = "floaters";
    layer.setAttribute("aria-hidden", "true");

    const colors = ["#ffffff", "#ffd23f", "#ff8fcb", "#c8bbff", "#8ff5d3"];
    const count = window.innerWidth < 600 ? 14 : 22;

    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "floater";
      const dur = 18 + Math.random() * 20;
      el.style.setProperty("--x", ((i + Math.random() * 0.8) / count) * 100 + "%");
      el.style.setProperty("--y", Math.random() * 92 + "%");            // resting spot if motion is reduced
      el.style.setProperty("--size", 26 + Math.random() * 34 + "px");
      el.style.setProperty("--dur", dur + "s");
      el.style.setProperty("--delay", -Math.random() * dur + "s");     // negative = already mid-flight on load
      el.style.setProperty("--sway", Math.random() * 80 - 40 + "px");
      el.style.setProperty("--spin", (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120) + "deg");
      el.innerHTML = icon(CHOICES[i % 3], colors[Math.floor(Math.random() * colors.length)]);
      layer.appendChild(el);
    }
    document.body.prepend(layer);
  }

  // --- Events --------------------------------------------------------------
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });

  choiceButtons.forEach((btn) => {
    btn.addEventListener("click", () => play(btn.dataset.choice));
  });

  modeButtons.learning.addEventListener("click", () => setMode("learning"));
  modeButtons.random.addEventListener("click", () => setMode("random"));

  resetBtn.addEventListener("click", startMatch); // restart the current level

  resetAiBtn.addEventListener("click", () => {
    predictor.reset();
    level = 1;
    aiStats.correct = aiStats.total = 0;
    startMatch();
  });

  dialogAction.addEventListener("click", () => {
    dialog.close();
    if (pendingAction) pendingAction();
  });

  // Make the player pick a button instead of dismissing with Escape
  dialog.addEventListener("cancel", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    if (dialog.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { r: "rock", p: "paper", s: "scissors" };
    const choice = map[e.key.toLowerCase()];
    if (choice) play(choice);
  });

  spawnFloaters();
  startMatch();
})();
