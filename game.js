// ================================================================
// IMPOSTER: Pass the Phone — game.js
// No Firebase. No timers. One phone, everyone peeks in turn.
// ================================================================

/* ─── Game state ─── */
const G = {
  playerCount:  4,
  players:      [],      // [{ name, avClass }]
  imposterIdx:  -1,      // which player index is the imposter
  word:         null,    // { word, image, category }
  currentTurn:  0,       // index into players array (whose turn to peek)
  holdTimer:    null,
  holdStart:    0,
  holdDuration: 1500,    // ms to hold before revealing
  holding:      false,
  revealed:     false,
};

const AV = ['av0','av1','av2','av3','av4','av5','av6','av7','av8','av9'];

/* ─── Helpers ─── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
}

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/* ════════════════════════════════════════
   HOME — PLAYER COUNT PICKER
════════════════════════════════════════ */

function adjustCount(delta) {
  G.playerCount = Math.max(2, Math.min(10, G.playerCount + delta));
  renderCountUI();
}

function renderCountUI() {
  document.getElementById('count-number').textContent = G.playerCount;

  // Dots
  const dotsEl = document.getElementById('count-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < G.playerCount; i++) {
    const d = document.createElement('div');
    d.className = 'dot active';
    dotsEl.appendChild(d);
  }
  // Grey dots to show max
  for (let i = G.playerCount; i < 10; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    dotsEl.appendChild(d);
  }

  // +/- limits
  document.getElementById('btn-minus').disabled = G.playerCount <= 2;
  document.getElementById('btn-plus').disabled  = G.playerCount >= 10;

  renderNameInputs();
}

function renderNameInputs() {
  const list = document.getElementById('name-list');

  // Preserve existing values
  const existing = [];
  list.querySelectorAll('.name-input').forEach(inp => existing.push(inp.value));

  list.innerHTML = '';
  for (let i = 0; i < G.playerCount; i++) {
    const avClass = AV[i % AV.length];
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `
      <div class="name-avatar ${avClass}">${i + 1}</div>
      <input
        class="name-input"
        type="text"
        placeholder="Player ${i + 1}"
        maxlength="18"
        autocomplete="off"
        value="${escHtml(existing[i] || '')}"
      />
    `;
    list.appendChild(row);
  }
}

/* ════════════════════════════════════════
   START — COLLECT NAMES & ASSIGN ROLES
════════════════════════════════════════ */

function startSetup() {
  const inputs = document.querySelectorAll('.name-input');
  const errEl  = document.getElementById('setup-error');
  errEl.textContent = '';

  // Collect names (use "Player N" as fallback if blank)
  G.players = [];
  const seen = new Set();
  let dupFound = false;

  inputs.forEach((inp, i) => {
    const name = inp.value.trim() || `Player ${i + 1}`;
    const key  = name.toLowerCase();
    if (seen.has(key)) dupFound = true;
    seen.add(key);
    G.players.push({ name, avClass: AV[i % AV.length] });
  });

  if (dupFound) {
    errEl.textContent = 'Two players have the same name — please use unique names.';
    return;
  }

  // Pick random word
  G.word = WORDS[randInt(0, WORDS.length)];

  // Pick random imposter (must be valid index)
  G.imposterIdx = randInt(0, G.players.length);

  // Reset turn
  G.currentTurn = 0;

  goToPassScreen();
}

/* ════════════════════════════════════════
   PASS SCREEN — whose turn is it
════════════════════════════════════════ */

function goToPassScreen() {
  if (G.currentTurn >= G.players.length) {
    // Everyone has peeked
    showScreen('allset');
    return;
  }

  const player = G.players[G.currentTurn];

  // Player name
  document.getElementById('pass-player-name').textContent = player.name;

  // Colour the arrow to match avatar
  const arrow = document.getElementById('pass-arrow');
  arrow.style.color = '';

  // Progress dots
  const prog = document.getElementById('pass-progress');
  prog.innerHTML = '';
  G.players.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'prog-dot' +
      (i < G.currentTurn  ? ' done'    : '') +
      (i === G.currentTurn ? ' current' : '');
    prog.appendChild(d);
  });

  showScreen('pass');
}

/* ════════════════════════════════════════
   REVEAL SCREEN — hold to peek
════════════════════════════════════════ */

function goToReveal() {
  const player     = G.players[G.currentTurn];
  const isImposter = G.currentTurn === G.imposterIdx;

  G.holding  = false;
  G.revealed = false;

  // Header
  document.getElementById('reveal-player-tag').textContent = player.name;

  // Build role content
  const content = document.getElementById('role-content');
  content.innerHTML = '';
  content.classList.remove('visible');

  if (isImposter) {
    content.innerHTML = `
      <div class="imposter-reveal-wrap">
        <div class="imposter-big-icon">🎭</div>
        <div class="imposter-reveal-title">YOU ARE THE<br>IMPOSTER</div>
        <p class="imposter-reveal-sub">
          You have no word.<br>
          Listen to the others and try to blend in!
        </p>
      </div>
    `;
  } else {
    const w = G.word;
    content.innerHTML = `
      <div class="role-word-label">The Secret Word</div>
      <div class="role-word-text">${escHtml(w.word)}</div>
      <img class="role-word-img" src="${escHtml(w.image)}" alt="${escHtml(w.word)}" />
      <div class="role-category">${escHtml(w.category)}</div>
    `;
  }

  // Cover visible, content hidden
  document.getElementById('role-cover').style.display   = 'flex';
  document.getElementById('role-content').style.display = 'none';
  document.getElementById('btn-done-peeking').style.display = 'none';

  // Reset hold button
  const btn   = document.getElementById('btn-hold');
  const ringFg = document.getElementById('hold-ring-fg');
  btn.classList.remove('holding','revealed');
  ringFg.style.strokeDashoffset = '276.5';
  document.querySelector('.hold-text').textContent = 'Hold to Reveal';
  document.querySelector('.hold-icon').textContent = '👁';

  showScreen('reveal');
}

/* ─── Hold-to-reveal mechanic ─── */

function startHold() {
  if (G.revealed) return;
  G.holding  = true;
  G.holdStart = performance.now();

  const btn    = document.getElementById('btn-hold');
  const ringFg = document.getElementById('hold-ring-fg');
  const circum = 276.5;

  btn.classList.add('holding');

  // Animate ring filling over holdDuration ms
  function tick() {
    if (!G.holding) return;
    const elapsed  = performance.now() - G.holdStart;
    const progress = Math.min(elapsed / G.holdDuration, 1);
    ringFg.style.strokeDashoffset = circum * (1 - progress);

    if (progress < 1) {
      G.holdTimer = requestAnimationFrame(tick);
    } else {
      // Fully held — reveal!
      showRole();
    }
  }
  G.holdTimer = requestAnimationFrame(tick);
}

function endHold() {
  if (G.revealed) return;
  if (!G.holding) return;

  G.holding = false;
  cancelAnimationFrame(G.holdTimer);

  const btn    = document.getElementById('btn-hold');
  const ringFg = document.getElementById('hold-ring-fg');
  btn.classList.remove('holding');

  // Reset ring
  ringFg.style.transition = 'stroke-dashoffset .3s ease';
  ringFg.style.strokeDashoffset = '276.5';
  setTimeout(() => { ringFg.style.transition = 'stroke-dashoffset .05s linear'; }, 320);

  // If we are hiding (they let go mid-hold) — hide content again
  if (!G.revealed) {
    hideRole();
  }
}

function showRole() {
  G.revealed = true;
  G.holding  = false;

  const btn    = document.getElementById('btn-hold');
  const ringFg = document.getElementById('hold-ring-fg');

  // Lock ring full
  ringFg.style.strokeDashoffset = '0';
  btn.classList.remove('holding');
  btn.classList.add('revealed');
  document.querySelector('.hold-text').textContent = 'Showing';
  document.querySelector('.hold-icon').textContent = '✓';

  // Show content
  document.getElementById('role-cover').style.display   = 'none';
  const content = document.getElementById('role-content');
  content.style.display = 'flex';
  content.classList.add('visible');

  // Show done button
  document.getElementById('btn-done-peeking').style.display = 'block';
}

function hideRole() {
  // Called if not revealed and finger lifted — nothing extra needed,
  // cover is still visible from initial state
}

/* ─── Done peeking — hand to next player ─── */

function donePeeking() {
  G.currentTurn++;
  goToPassScreen();
}

/* ════════════════════════════════════════
   ALL SET SCREEN
════════════════════════════════════════ */

function showRevealAnswer() {
  const imposterPlayer = G.players[G.imposterIdx];

  document.getElementById('answer-word').textContent     = G.word ? G.word.word : '';
  document.getElementById('answer-imposter').textContent = imposterPlayer ? imposterPlayer.name : '';

  const img = document.getElementById('answer-image');
  img.src   = G.word ? G.word.image : '';
  img.alt   = G.word ? G.word.word  : '';

  showScreen('answer');
}

/* ════════════════════════════════════════
   PLAY AGAIN / HOME
════════════════════════════════════════ */

function playAgain() {
  // Keep same player names & count — just re-randomise word & imposter
  G.word        = WORDS[randInt(0, WORDS.length)];
  G.imposterIdx = randInt(0, G.players.length);
  G.currentTurn = 0;
  goToPassScreen();
}

function goHome() {
  showScreen('home');
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderCountUI(); // draw initial state (4 players)
});
