(() => {
  "use strict";

  // --- Game data ---------------------------------------------------------
  const CHOICES = ["rock", "paper", "scissors"];
  const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };
  const LABELS = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
  const COLORS = { rock: "#c9c3b8", paper: "#eaf0f6", scissors: "#ff6b5b" };

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
  const choiceButtons = document.querySelectorAll(".choice");
  const resetBtn = $("reset");
  const resetAiBtn = $("reset-ai");
  const modeButtons = { learning: $("mode-learning"), random: $("mode-random") };
  const aiPredictionEl = $("ai-prediction");
  const aiAccuracyEl = $("ai-accuracy");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- State -------------------------------------------------------------
  const predictor = new MarkovPredictor({ maxOrder: 3, decay: 0.95 });
  const scores = { player: 0, draw: 0, computer: 0 };
  const aiStats = { correct: 0, total: 0 };
  let mode = "learning"; // "learning" | "random"
  let locked = false;

  // --- Helpers -----------------------------------------------------------
  const icon = (choice) => ICONS[choice](COLORS[choice]);
  const randomPick = () => CHOICES[Math.floor(Math.random() * CHOICES.length)];
  const counterTo = (move) => CHOICES.find((m) => BEATS[m] === move); // the move that beats `move`

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
  }

  function clearHandState() {
    [playerHand, computerHand].forEach((h) => h.classList.remove("win", "lose", "draw", "pop", "shake"));
  }

  function renderAiIdle() {
    if (mode === "random") {
      aiPredictionEl.textContent = "The computer is picking at random.";
      aiAccuracyEl.textContent = "";
    } else {
      aiPredictionEl.textContent = "The AI learns your habits as you play.";
      aiAccuracyEl.textContent = "";
    }
  }

  function renderAiInsight(prediction, actualMove) {
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
      aiPredictionEl.textContent =
        `AI predicted ${LABELS[prediction.move]} (${pct}% sure, based on ${basis}). ${hit}`;
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
    let computerChoice;
    if (mode === "learning") {
      prediction = predictor.predict();
      computerChoice = prediction ? counterTo(prediction.move) : randomPick();
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
    renderAiInsight(prediction, playerChoice);
    setLocked(false);
  }

  function resetRound() {
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

  function resetScore() {
    scores.player = scores.draw = scores.computer = 0;
    aiStats.correct = aiStats.total = 0;
    renderScores();
    resetRound();
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    for (const [name, btn] of Object.entries(modeButtons)) {
      btn.setAttribute("aria-pressed", String(name === mode));
    }
    resetScore(); // fresh scoreboard so the two modes can be compared fairly
  }

  // --- Events ------------------------------------------------------------
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });

  choiceButtons.forEach((btn) => {
    btn.addEventListener("click", () => play(btn.dataset.choice));
  });

  modeButtons.learning.addEventListener("click", () => setMode("learning"));
  modeButtons.random.addEventListener("click", () => setMode("random"));

  resetBtn.addEventListener("click", resetScore);

  resetAiBtn.addEventListener("click", () => {
    predictor.reset();
    resetScore();
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { r: "rock", p: "paper", s: "scissors" };
    const choice = map[e.key.toLowerCase()];
    if (choice) play(choice);
  });

  renderAiIdle();
})();
