/**
 * Markov-chain move predictor for Rock Paper Scissors.
 *
 * How it learns
 * -------------
 * After every round it records "given the player's last k moves, which move
 * came next?" for k = 0, 1, 2 and 3 (the "order" of the chain).
 *   order 0: overall frequency of each move
 *   order 1: what you tend to play after your previous move
 *   order 2: what you tend to play after your previous two moves
 *   order 3: ...and so on
 * Older observations are slowly down-weighted (decay), so the model adapts
 * if you change your habits.
 *
 * How it predicts
 * ---------------
 * It tries the longest matching context first and falls back to shorter ones
 * when it hasn't seen enough data. It returns the most likely next player
 * move; the game then plays whatever beats that move.
 *
 * The learned counts are saved in localStorage, so the model keeps learning
 * across visits (per browser).
 */
(() => {
  "use strict";

  const MOVES = ["rock", "paper", "scissors"];

  class MarkovPredictor {
    constructor({ maxOrder = 3, decay = 0.95, minWeight = 1.5, storageKey = "rps-markov-v1" } = {}) {
      this.maxOrder = maxOrder;
      this.decay = decay;
      this.minWeight = minWeight; // evidence needed before trusting an order > 0 context
      this.storageKey = storageKey;
      this._clear();
      this._load();
    }

    /** Forget everything the model has learned. */
    reset() {
      this._clear();
      this._save();
    }

    /** Record the move the player just made. Call once per round. */
    update(move) {
      if (!MOVES.includes(move)) return;

      for (let k = 0; k <= Math.min(this.maxOrder, this.history.length); k++) {
        const ctx = this._context(k);
        const counts = (this.tables[k][ctx] = this.tables[k][ctx] || this._zeros());
        for (const m of MOVES) counts[m] *= this.decay; // fade old evidence
        counts[move] += 1;
      }

      this.history.push(move);
      if (this.history.length > this.maxOrder) this.history.shift();
      this._save();
    }

    /**
     * Predict the player's next move.
     * @returns {{move: string, confidence: number, order: number} | null}
     *          null when there is no data yet.
     */
    predict() {
      for (let k = Math.min(this.maxOrder, this.history.length); k >= 0; k--) {
        const counts = this.tables[k][this._context(k)];
        if (!counts) continue;

        const total = MOVES.reduce((sum, m) => sum + counts[m], 0);
        const needed = k === 0 ? 0.5 : this.minWeight;
        if (total < needed) continue;

        const best = Math.max(...MOVES.map((m) => counts[m]));
        const tied = MOVES.filter((m) => counts[m] === best);
        const move = tied[Math.floor(Math.random() * tied.length)]; // random tie-break
        return { move, confidence: best / total, order: k };
      }
      return null;
    }

    // --- internals -------------------------------------------------------
    _zeros() {
      return { rock: 0, paper: 0, scissors: 0 };
    }

    _clear() {
      this.tables = Array.from({ length: this.maxOrder + 1 }, () => ({}));
      this.history = [];
    }

    _context(k) {
      return k === 0 ? "" : this.history.slice(this.history.length - k).join(",");
    }

    _save() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({ tables: this.tables, history: this.history }));
      } catch (e) {
        /* storage unavailable (private mode, etc.): the model just won't persist */
      }
    }

    _load() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (
          Array.isArray(data.tables) &&
          data.tables.length === this.maxOrder + 1 &&
          Array.isArray(data.history) &&
          data.history.every((m) => MOVES.includes(m))
        ) {
          this.tables = data.tables;
          this.history = data.history.slice(-this.maxOrder);
        }
      } catch (e) {
        this._clear();
      }
    }
  }

  const root = typeof window !== "undefined" ? window : globalThis;
  root.MarkovPredictor = MarkovPredictor;
})();
