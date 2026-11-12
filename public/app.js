'use strict';

const socket = io({ transports: ['websocket', 'polling'] });
const $ = id => document.getElementById(id);
const GAME_LINEUP = [
  ['⚡', 'Reaction Rush'], ['🧠', 'Memory Master'], ['⌨️', 'Typing Frenzy'], ['❓', 'Quick Quiz'],
  ['🔢', 'Brain Blitz'], ['😎', 'Emoji Decode'], ['🎯', 'Odd One Out']
];
const AVATAR_GRADIENTS = [
  'linear-gradient(140deg,#876cf2,#4c9caf)', 'linear-gradient(140deg,#de7fa8,#865cda)',
  'linear-gradient(140deg,#47b9a9,#4678c9)', 'linear-gradient(140deg,#d79c4e,#c35c83)',
  'linear-gradient(140deg,#5e9bd9,#7855bf)', 'linear-gradient(140deg,#6dbb78,#428caa)',
  'linear-gradient(140deg,#d27f5b,#a65fa3)', 'linear-gradient(140deg,#7c75d9,#4e9aa5)'
];

let playerToken = localStorage.getItem('ps-player-token') || '';
let roomCode = localStorage.getItem('ps-room-code') || '';
let playerName = localStorage.getItem('ps-player-name') || '';
let roomState = null;
let activeRound = null;
let timerInterval = null;
let reactionReady = false;
let memorySequence = [];
let memoryInput = [];
let memoryActive = false;
let quizItems = [];
let quizAnswers = [];
let quizIndex = 0;
let emojiItems = [];
let submitted = false;
let currentGameScreen = 'lobby';
let roundDeadline = null;
let feedbackTimeout = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  currentGameScreen = id.replace('-screen', '');
}

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.textContent = message;
  $('toast-region').appendChild(node);
  setTimeout(() => node.remove(), 3400);
}

function setConnection(connected) {
  $('connection-dot').className = `connection-dot ${connected ? 'online' : 'offline'}`;
  $('connection-label').textContent = connected ? 'Connected' : 'Reconnecting';
}

function displayFeedback(message, type = '') {
  const area = $('round-feedback');
  area.textContent = message || '';
  area.className = `round-feedback${type ? ` ${type}` : ''}`;
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  if (message) feedbackTimeout = setTimeout(() => { area.textContent = ''; area.className = 'round-feedback'; }, 3600);
}

function saveSession(data) {
  if (data.playerToken) playerToken = data.playerToken;
  if (data.roomCode) roomCode = data.roomCode;
  if (data.playerName) playerName = data.playerName;
  localStorage.setItem('ps-player-token', playerToken);
  localStorage.setItem('ps-room-code', roomCode);
  localStorage.setItem('ps-player-name', playerName);
}

function clearSession() {
  playerToken = '';
  roomCode = '';
  playerName = '';
  localStorage.removeItem('ps-player-token');
  localStorage.removeItem('ps-room-code');
  localStorage.removeItem('ps-player-name');
  roomState = null;
  activeRound = null;
  if (timerInterval) clearInterval(timerInterval);
}

function renderLineup() {
  $('lobby-game-lineup').innerHTML = GAME_LINEUP.map((game, i) => `
    <div class="lineup-item"><span class="lineup-emoji">${game[0]}</span><div><div class="lineup-name">${game[1]}</div><div class="lineup-number">ROUND ${i + 1}</div></div></div>
  `).join('');
}

function renderRoomState(state) {
  roomState = state;
  if (state.status === 'lobby') showScreen('lobby-screen');
  $('room-code-display').textContent = state.code;
  $('player-count').textContent = `${state.players.length} / 8 PLAYERS`;
  $('players-heading-count').textContent = state.players.length;
  $('player-list').innerHTML = '';
  state.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
    avatar.textContent = p.name.slice(0, 1).toUpperCase();
    const wrap = document.createElement('div');
    wrap.className = 'player-name-wrap';
    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = p.name + (p.token === playerToken ? ' (you)' : '');
    const meta = document.createElement('div');
    meta.className = 'player-meta';
    meta.textContent = p.isHost ? 'HOST' : 'PLAYER';
    wrap.append(name, meta);
    const status = document.createElement('div');
    status.className = `player-status${p.ready ? '' : ' waiting'}`;
    status.textContent = !p.connected ? 'OFFLINE' : (p.ready ? 'READY ✓' : 'WAITING');
    row.append(avatar, wrap, status);
    $('player-list').appendChild(row);
  });
  const me = state.players.find(p => p.token === playerToken);
  const readyButton = $('ready-button');
  const host = state.hostToken === playerToken;
  readyButton.textContent = me?.ready ? 'Ready ✓ · Change' : "I'm ready ✓";
  readyButton.disabled = !me?.connected;
  readyButton.classList.toggle('is-ready', !!me?.ready);
  $('start-button').classList.toggle('hidden', !host);
  $('ready-button').classList.toggle('hidden', !host && false);
  const connected = state.players.filter(p => p.connected);
  const allReady = connected.length >= 2 && connected.every(p => p.ready);
  $('start-button').disabled = !allReady;
  $('lobby-status').textContent = connected.length < 2
    ? 'Waiting for at least one more player to join.'
    : (allReady ? 'Everyone is ready. Host, start the showdown!' : 'Everyone must be ready before the host can start.');
  if (state.status === 'playing' && currentGameScreen === 'lobby') showScreen('game-screen');
}

function renderLeaderboard(players) {
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  $('game-leaderboard').innerHTML = '';
  sorted.forEach((p, index) => {
    const row = document.createElement('div');
    row.className = 'leader-row';
    const rank = document.createElement('span');
    rank.className = 'leader-rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const avatar = document.createElement('span');
    avatar.className = 'avatar leader-avatar';
    avatar.style.background = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
    avatar.textContent = p.name.slice(0, 1).toUpperCase();
    const name = document.createElement('span');
    name.className = 'leader-name';
    name.textContent = p.name;
    if (p.token === playerToken) {
      const you = document.createElement('span');
      you.className = 'you-tag';
      you.textContent = 'YOU';
      name.appendChild(you);
    }
    const score = document.createElement('span');
    score.className = 'leader-score';
    score.textContent = `${Number(p.score).toFixed(p.score % 1 ? 1 : 0)} pts`;
    row.append(rank, avatar, name, score);
    $('game-leaderboard').appendChild(row);
  });
}

function startCountdown(endsAt) {
  if (timerInterval) clearInterval(timerInterval);
  roundDeadline = endsAt;
  const tick = () => {
    const ms = Math.max(0, roundDeadline - Date.now());
    const seconds = Math.ceil(ms / 1000);
    $('round-timer').textContent = `00:${String(seconds).padStart(2, '0')}`;
    $('round-timer').classList.toggle('urgent', seconds <= 5);
    if (ms <= 0 && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
  tick();
  timerInterval = setInterval(tick, 100);
}

function baseStage() {
  $('game-stage').innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'stage-content';
  $('game-stage').appendChild(stage);
  return stage;
}

function primaryButton(label, onClick, className = 'primary-button stage-primary') {
  const btn = document.createElement('button');
  btn.className = className;
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderRound(payload) {
  activeRound = payload;
  submitted = false;
  reactionReady = false;
  memorySequence = [];
  memoryInput = [];
  memoryActive = false;
  quizItems = [];
  quizAnswers = [];
  quizIndex = 0;
  emojiItems = [];
  if (timerInterval) clearInterval(timerInterval);
  $('round-result-card').classList.add('hidden');
  $('round-number-label').textContent = `ROUND ${payload.roundNumber} / ${payload.totalRounds}`;
  $('round-progress-fill').style.width = `${payload.roundNumber / payload.totalRounds * 100}%`;
  $('game-category').textContent = payload.category;
  $('game-title').textContent = payload.title;
  $('game-instructions').textContent = payload.instructions;
  $('round-feedback').textContent = '';
  $('round-feedback').className = 'round-feedback';
  showScreen('game-screen');
  startCountdown(payload.endsAt);
  renderLeaderboard(roomState?.players || []);

  switch (payload.gameId) {
    case 'reaction': renderReaction(payload); break;
    case 'memory': renderMemory(payload); break;
    case 'typing': renderTyping(payload); break;
    case 'quiz':
    case 'brain': renderMultipleChoice(payload); break;
    case 'emoji': renderEmoji(payload); break;
    case 'odd': renderOdd(payload); break;
  }
}

function renderReaction(payload) {
  const stage = baseStage();
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'HOLD YOUR NERVE';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = 'Ready… steady…';
  const copy = document.createElement('p'); copy.className = 'stage-copy'; copy.textContent = 'The button will turn green. Tap it the instant you see it.';
  const button = document.createElement('button');
  button.className = 'big-reaction-button'; button.textContent = 'WAIT FOR GREEN'; button.disabled = true;
  button.addEventListener('click', () => {
    if (!reactionReady || submitted) return;
    submitted = true; button.disabled = true; button.textContent = 'LOCKED IN ✓';
    socket.emit('submitRound', { kind: 'reaction' });
  });
  stage.append(kicker, title, copy, button);
  payload._reactionButton = button;
}

socket.on('reactionSignal', () => {
  if (!activeRound || activeRound.gameId !== 'reaction' || submitted) return;
  reactionReady = true;
  const button = $('game-stage').querySelector('.big-reaction-button');
  if (button) { button.disabled = false; button.classList.add('go'); button.textContent = 'TAP NOW!'; }
  const copy = $('game-stage').querySelector('.stage-copy');
  if (copy) copy.textContent = 'GO! Tap the green button as quickly as you can.';
});

function renderMemory(payload) {
  const stage = baseStage();
  memorySequence = payload.data.sequence;
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'WATCH THE COLORS';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = 'Memorize this sequence';
  const copy = document.createElement('p'); copy.className = 'stage-copy'; copy.textContent = 'The colors disappear soon. Remember their exact order.';
  const sequence = document.createElement('div'); sequence.className = 'color-sequence';
  memorySequence.forEach(color => { const dot = document.createElement('span'); dot.className = `sequence-dot color-${color}`; sequence.appendChild(dot); });
  stage.append(kicker, title, copy, sequence);
  const preview = document.createElement('div'); preview.className = 'stage-copy'; preview.textContent = 'Study the sequence…'; stage.appendChild(preview);
  setTimeout(() => {
    if (!activeRound || activeRound.gameId !== 'memory' || submitted) return;
    sequence.innerHTML = '';
    title.textContent = 'Repeat the sequence';
    copy.textContent = 'Tap the colors in the same order, then submit.';
    preview.textContent = 'Your input: —';
    memoryActive = true;
    const pad = document.createElement('div'); pad.className = 'color-pad';
    ['red', 'blue', 'green', 'yellow'].forEach(color => {
      const button = document.createElement('button'); button.className = `color-button color-${color}`; button.setAttribute('aria-label', color);
      button.addEventListener('click', () => {
        if (!memoryActive || memoryInput.length >= memorySequence.length || submitted) return;
        memoryInput.push(color);
        preview.textContent = `Your input: ${memoryInput.map(c => ({red:'🔴',blue:'🔵',green:'🟢',yellow:'🟡'}[c])).join(' ')}`;
        if (memoryInput.length === memorySequence.length) {
          const actions = stage.querySelector('.sequence-actions');
          if (actions) actions.classList.remove('hidden');
        }
      });
      pad.appendChild(button);
    });
    const actions = document.createElement('div'); actions.className = 'sequence-actions';
    const reset = primaryButton('Reset', () => { memoryInput = []; preview.textContent = 'Your input: —'; actions.classList.add('hidden'); }, 'small-action');
    const send = primaryButton('Submit sequence', () => { if (memoryInput.length !== memorySequence.length || submitted) return; socket.emit('submitRound', { sequence: memoryInput }); }, 'primary-button stage-primary');
    actions.append(reset, send); actions.classList.add('hidden');
    stage.append(pad, actions);
  }, payload.data.previewMs);
}

function renderTyping(payload) {
  const stage = baseStage(); stage.classList.add('typing-stage');
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'TYPE IT CLEAN';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = 'Ready, set, type!';
  const sentence = document.createElement('div'); sentence.className = 'sentence-box'; sentence.textContent = payload.data.text;
  const input = document.createElement('textarea'); input.className = 'game-input'; input.placeholder = 'Start typing the sentence here…'; input.autocomplete = 'off'; input.spellcheck = false;
  const send = primaryButton('Submit typing', () => {
    if (submitted) return;
    if (!input.value.trim()) { displayFeedback('Type the sentence before submitting.', 'bad'); return; }
    submitted = true; input.disabled = true; send.disabled = true;
    socket.emit('submitRound', { text: input.value });
  });
  stage.append(kicker, title, sentence, input, send);
}

function renderMultipleChoice(payload) {
  quizItems = payload.data.items;
  quizAnswers = Array(quizItems.length).fill(null);
  quizIndex = 0;
  drawQuestion();
}

function drawQuestion() {
  if (submitted) return;
  const stage = baseStage();
  const item = quizItems[quizIndex];
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = `${activeRound.gameId === 'quiz' ? 'QUICK QUIZ' : 'BRAIN BLITZ'} · QUESTION ${quizIndex + 1} OF ${quizItems.length}`;
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = activeRound.gameId === 'quiz' ? 'Trust your first answer' : 'Think it through';
  const card = document.createElement('div'); card.className = 'question-card';
  const count = document.createElement('div'); count.className = 'question-count'; count.textContent = `QUESTION ${quizIndex + 1}`;
  const prompt = document.createElement('div'); prompt.className = 'question-prompt'; prompt.textContent = item.prompt;
  const options = document.createElement('div'); options.className = 'option-list';
  item.options.forEach((option, index) => {
    const btn = document.createElement('button'); btn.className = `option-button${quizAnswers[quizIndex] === index ? ' selected' : ''}`;
    const letter = document.createElement('span'); letter.className = 'option-letter'; letter.textContent = String.fromCharCode(65 + index);
    const txt = document.createElement('span'); txt.textContent = option;
    btn.append(letter, txt);
    btn.addEventListener('click', () => { quizAnswers[quizIndex] = index; drawQuestion(); });
    options.appendChild(btn);
  });
  card.append(count, prompt, options);
  const nav = document.createElement('div'); nav.className = 'question-nav';
  const back = document.createElement('button'); back.className = 'small-action'; back.textContent = '← Back'; back.disabled = quizIndex === 0; back.addEventListener('click', () => { quizIndex--; drawQuestion(); });
  const label = document.createElement('span'); label.className = 'question-nav-label'; label.textContent = `${quizAnswers.filter(a => a !== null).length} / ${quizItems.length} answered`;
  const next = document.createElement('button'); next.className = 'primary-button'; next.style.padding = '9px 12px'; next.style.fontSize = '10px';
  next.textContent = quizIndex === quizItems.length - 1 ? 'Submit answers ✓' : 'Next question →';
  next.disabled = quizAnswers[quizIndex] === null;
  next.addEventListener('click', () => {
    if (quizIndex < quizItems.length - 1) { quizIndex++; drawQuestion(); }
    else { submitted = true; socket.emit('submitRound', { answers: quizAnswers }); stage.innerHTML = '<div class="stage-title">Answers submitted ✓</div><p class="stage-copy">Your score will appear when the round ends.</p>'; }
  });
  nav.append(back, label, next);
  stage.append(kicker, title, card, nav);
}

function renderEmoji(payload) {
  emojiItems = payload.data.items;
  const stage = baseStage();
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'THINK IN PICTURES';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = 'Decode the emojis';
  const copy = document.createElement('p'); copy.className = 'stage-copy'; copy.textContent = 'Enter the movie, phrase, or expression each clue represents.';
  const list = document.createElement('div'); list.className = 'emoji-list';
  emojiItems.forEach((item, i) => {
    const row = document.createElement('div'); row.className = 'emoji-question';
    const prompt = document.createElement('div'); prompt.className = 'emoji-prompt'; prompt.textContent = item.prompt;
    const input = document.createElement('input'); input.className = 'answer-input'; input.placeholder = `Your answer ${i + 1}`; input.maxLength = 70; input.autocomplete = 'off'; input.id = `emoji-answer-${i}`;
    row.append(prompt, input); list.appendChild(row);
  });
  const send = primaryButton('Submit decoded answers', () => {
    if (submitted) return;
    submitted = true;
    const answers = emojiItems.map((_, i) => $(`emoji-answer-${i}`).value);
    socket.emit('submitRound', { answers });
    list.querySelectorAll('input').forEach(input => input.disabled = true);
    send.disabled = true;
  });
  stage.append(kicker, title, copy, list, send);
}

function renderOdd(payload) {
  const stage = baseStage();
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'EYES OPEN';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = 'Spot the impostor';
  const copy = document.createElement('p'); copy.className = 'stage-copy'; copy.textContent = 'One symbol is different. Find it and tap it!';
  const grid = document.createElement('div'); grid.className = 'odd-grid';
  payload.data.grid.forEach((symbol, index) => {
    const btn = document.createElement('button'); btn.className = 'odd-cell'; btn.textContent = symbol;
    btn.addEventListener('click', () => { if (!submitted) socket.emit('submitRound', { index }); });
    grid.appendChild(btn);
  });
  stage.append(kicker, title, copy, grid);
}

function showRoundResults(result) {
  if (timerInterval) clearInterval(timerInterval);
  $('round-title')?.remove();
  $('game-stage').innerHTML = `<div class="stage-content"><div class="stage-kicker">ROUND ${result.roundNumber} COMPLETE</div><div class="stage-title">${escapeHtml(result.title)} results</div><p class="stage-copy">Points have been added to the live leaderboard.</p></div>`;
  const card = $('round-result-card');
  card.classList.remove('hidden');
  const rows = result.results.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}${r.token === playerToken ? ' <span class="you-tag">YOU</span>' : ''}</td><td>${escapeHtml(r.metric || '—')}</td><td class="points-plus">+${Number(r.roundPoints).toFixed(r.roundPoints % 1 ? 1 : 0)}</td><td>${Number(r.totalScore).toFixed(r.totalScore % 1 ? 1 : 0)}</td></tr>`).join('');
  card.innerHTML = `<div class="card-kicker">ROUND ${result.roundNumber} SCORECARD</div><h3>${escapeHtml(result.title)}</h3><div style="overflow-x:auto"><table class="result-table"><thead><tr><th>#</th><th>PLAYER</th><th>RESULT</th><th>PTS</th><th>TOTAL</th></tr></thead><tbody>${rows}</tbody></table></div><div class="result-next-row"><span class="muted">Next challenge starts automatically in a few seconds.</span><button id="next-round-button" class="primary-button">Next round →</button></div>`;
  const meIsHost = roomState?.hostToken === playerToken;
  $('next-round-button').disabled = !meIsHost;
  $('next-round-button').classList.toggle('hidden', !meIsHost);
  $('next-round-button').addEventListener('click', () => socket.emit('nextRound'));
  renderLeaderboard(result.leaderboard);
  $('round-feedback').textContent = '';
  $('round-feedback').className = 'round-feedback';
}

function showTieBreak(payload) {
  if (timerInterval) clearInterval(timerInterval);
  activeRound = null;
  showScreen('game-screen');
  $('round-number-label').textContent = 'SUDDEN DEATH';
  $('round-progress-fill').style.width = '100%';
  $('game-category').textContent = 'TIEBREAKER';
  $('game-title').textContent = 'Sudden Death';
  $('game-instructions').textContent = 'Only players tied for first place can answer. First correct answer wins.';
  $('round-timer').textContent = '00:20';
  const stage = baseStage();
  const eligible = payload.eligibleTokens.includes(playerToken);
  const kicker = document.createElement('div'); kicker.className = 'stage-kicker'; kicker.textContent = 'ONE LAST CHANCE';
  const title = document.createElement('div'); title.className = 'stage-title'; title.textContent = payload.prompt;
  const pattern = document.createElement('div'); pattern.className = 'sentence-box'; pattern.style.textAlign = 'center'; pattern.style.fontSize = '25px'; pattern.textContent = `${payload.sequence.join('   ·   ')}   ·   ?`;
  const copy = document.createElement('p'); copy.className = 'stage-copy'; copy.textContent = eligible ? 'Enter the next number. First correct answer wins.' : 'You are not tied for first, so watch the sudden-death finish.';
  stage.append(kicker, title, pattern, copy);
  if (eligible) {
    const input = document.createElement('input'); input.className = 'game-input'; input.inputMode = 'numeric'; input.placeholder = 'Your answer'; input.style.maxWidth = '220px';
    const send = primaryButton('Submit answer', () => {
      if (!input.value.trim()) { displayFeedback('Enter a number first.', 'bad'); return; }
      socket.emit('submitTieBreak', { answer: input.value }); send.disabled = true; input.disabled = true;
    });
    stage.append(input, send);
  }
  const tick = () => {
    const secs = Math.max(0, Math.ceil((payload.endsAt - Date.now()) / 1000));
    $('round-timer').textContent = `00:${String(secs).padStart(2, '0')}`;
  };
  const id = setInterval(() => { if (!document.getElementById('game-screen').classList.contains('active') || activeRound) clearInterval(id); else tick(); }, 100);
  tick();
}

function showFinal(result) {
  if (timerInterval) clearInterval(timerInterval);
  activeRound = null;
  showScreen('final-screen');
  const winner = result.winner;
  $('final-title').textContent = winner ? `${winner.name} is the champion!` : 'What a showdown!';
  $('final-subtitle').textContent = winner ? 'Seven rounds. One legendary winner.' : 'Thanks for playing Party Showdown.';
  const winnerCard = $('winner-card');
  winnerCard.innerHTML = winner
    ? `<div class="winner-crown">👑</div><div class="winner-kicker">PARTY SHOWDOWN CHAMPION</div><div class="winner-name">${escapeHtml(winner.name)}</div><div class="winner-score">${Number(winner.score).toFixed(winner.score % 1 ? 1 : 0)} TOTAL POINTS · ${result.tied ? 'SUDDEN DEATH WINNER' : 'TOP OF THE LEADERBOARD'}</div>`
    : `<div class="winner-crown">🎉</div><div class="winner-kicker">GAME COMPLETE</div><div class="winner-name">Great game, everyone!</div>`;
  $('final-leaderboard').innerHTML = result.leaderboard.map((p, i) => {
    const medal = ['gold', 'silver', 'bronze'][i] || '';
    return `<div class="final-rank-row"><div class="final-rank ${medal}">${i + 1 < 4 ? ['①', '②', '③'][i] : String(i + 1).padStart(2, '0')}</div><div class="final-player">${escapeHtml(p.name)}${p.token === playerToken ? ' <span class="you-tag">YOU</span>' : ''}</div><div class="final-score">${Number(p.score).toFixed(p.score % 1 ? 1 : 0)} pts</div></div>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function leaveRoom() {
  socket.emit('leaveRoom');
  clearSession();
  $('leave-modal').classList.add('hidden');
  showScreen('home-screen');
  toast('You left the room.');
}

$('create-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('create-name').value.trim();
  if (!name) return;
  playerName = name;
  socket.emit('createRoom', { name });
});

$('join-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('join-name').value.trim();
  const code = $('room-code-input').value.trim().toUpperCase();
  if (!name || code.length !== 6) return toast('Enter a nickname and a 6-character room code.', true);
  playerName = name;
  socket.emit('joinRoom', { name, code });
});

$('ready-button').addEventListener('click', () => socket.emit('setReady'));
$('start-button').addEventListener('click', () => socket.emit('startGame'));
$('copy-code-button').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomCode); $('copy-hint').textContent = 'Copied! Send this code to your friends.'; toast('Room code copied.'); }
  catch { $('copy-hint').textContent = `Share this code: ${roomCode}`; toast(`Room code: ${roomCode}`); }
});
$('leave-lobby-button').addEventListener('click', () => $('leave-modal').classList.remove('hidden'));
$('leave-game-button').addEventListener('click', () => $('leave-modal').classList.remove('hidden'));
$('cancel-leave-button').addEventListener('click', () => $('leave-modal').classList.add('hidden'));
$('confirm-leave-button').addEventListener('click', leaveRoom);
$('play-again-button').addEventListener('click', () => { socket.emit('leaveRoom'); clearSession(); showScreen('home-screen'); });
$('room-code-input').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });

socket.on('connect', () => {
  setConnection(true);
  if (playerToken && roomCode) socket.emit('rejoinRoom', { roomCode, code: roomCode, playerToken, name: playerName });
});
socket.on('disconnect', () => setConnection(false));
socket.on('connect_error', () => setConnection(false));
socket.on('session', data => saveSession(data));
socket.on('roomState', state => {
  if (!roomCode) roomCode = state.code;
  if (state.code) localStorage.setItem('ps-room-code', state.code);
  renderRoomState(state);
  if (currentGameScreen === 'game') renderLeaderboard(state.players);
});
socket.on('appError', data => toast(data.message || 'Something went wrong.', true));
socket.on('roundStarted', payload => renderRound(payload));
socket.on('playerProgress', data => {
  if (roomState) {
    const p = roomState.players.find(p => p.token === data.token);
    if (p && data.submitted) p.submitted = true;
  }
  if (activeRound) displayFeedback(`${data.submittedCount} / ${data.playerCount} players have submitted`, '');
});
socket.on('submissionFeedback', data => {
  displayFeedback(data.message, data.correct ? 'good' : 'bad');
  if (data.correct && activeRound?.gameId === 'reaction') {
    const btn = $('game-stage').querySelector('.big-reaction-button');
    if (btn) { btn.textContent = 'LOCKED IN ✓'; btn.disabled = true; }
  }
  if (data.correct && activeRound?.gameId === 'odd') {
    submitted = true;
    $('game-stage').querySelectorAll('.odd-cell').forEach(btn => btn.disabled = true);
  }
  if (data.correct && activeRound?.gameId === 'memory') {
    submitted = true;
    memoryActive = false;
    $('game-stage').querySelectorAll('button').forEach(btn => btn.disabled = true);
  }
});
socket.on('roundFinished', result => showRoundResults(result));
socket.on('tieBreakStarted', payload => showTieBreak(payload));
socket.on('tieBreakFeedback', data => { displayFeedback(data.message, data.correct ? 'good' : 'bad'); if (data.correct) displayFeedback('Correct! You win!', 'good'); });
socket.on('gameFinished', result => showFinal(result));

renderLineup();
if (playerName) {
  $('create-name').value = playerName;
  $('join-name').value = playerName;
}
