'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGIN || '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SYMBOLS = ['◆', '●', '▲', '■', '★', '✦', '⬟', '✿'];

const GAMES = [
  { id: 'reaction', title: 'Reaction Rush', category: 'SPEED', duration: 12000, instructions: 'Wait for the screen to turn green, then tap as fast as you can. Tapping early will not count.' },
  { id: 'memory', title: 'Memory Master', category: 'MEMORY', duration: 18000, instructions: 'Memorize the color sequence. When it disappears, repeat it in the same order.' },
  { id: 'typing', title: 'Typing Frenzy', category: 'SPEED', duration: 30000, instructions: 'Type the sentence as quickly and accurately as possible, then submit it.' },
  { id: 'quiz', title: 'Quick Quiz', category: 'TRIVIA', duration: 42000, instructions: 'Answer five multiple-choice questions. More correct answers beat fewer; speed breaks ties.' },
  { id: 'brain', title: 'Brain Blitz', category: 'LOGIC', duration: 36000, instructions: 'Solve three number and logic puzzles. More correct answers beat fewer; speed breaks ties.' },
  { id: 'emoji', title: 'Emoji Decode', category: 'GUESSING', duration: 36000, instructions: 'Decode three emoji clues into a movie, phrase, or everyday expression.' },
  { id: 'odd', title: 'Odd One Out', category: 'VISUAL', duration: 12000, instructions: 'Find and tap the one symbol that is different from all the others.' }
];

const QUIZ_BANK = [
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], a: 1 },
  { q: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'], a: 1 },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
  { q: 'Which animal is the tallest in the world?', options: ['Elephant', 'Giraffe', 'Ostrich', 'Camel'], a: 1 },
  { q: 'How many minutes are in two hours?', options: ['100', '110', '120', '140'], a: 2 },
  { q: 'What is the capital of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], a: 2 },
  { q: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], a: 2 },
  { q: 'How many colors are traditionally in a rainbow?', options: ['Five', 'Six', 'Seven', 'Eight'], a: 2 },
  { q: 'What is the fastest land animal?', options: ['Lion', 'Horse', 'Cheetah', 'Leopard'], a: 2 },
  { q: 'Which instrument has keys, pedals, and strings?', options: ['Flute', 'Piano', 'Drum', 'Trumpet'], a: 1 },
  { q: 'What is 9 × 7?', options: ['56', '63', '72', '79'], a: 1 },
  { q: 'Which month has 28 days in a common year?', options: ['February', 'April', 'June', 'All of them'], a: 0 }
];

const BRAIN_BANK = [
  { q: 'What number comes next? 3, 6, 12, 24, __', options: ['30', '36', '48', '52'], a: 2 },
  { q: 'If 5 machines make 5 toys in 5 minutes, how long do 100 machines take to make 100 toys?', options: ['5 minutes', '20 minutes', '100 minutes', '500 minutes'], a: 0 },
  { q: 'What is the missing number? 2, 5, 10, 17, 26, __', options: ['35', '36', '37', '39'], a: 2 },
  { q: 'A clock shows 3:00. What is the angle between its hands?', options: ['45°', '60°', '90°', '180°'], a: 2 },
  { q: 'Which one does not belong?', options: ['Triangle', 'Square', 'Circle', 'Cube'], a: 3 },
  { q: 'A dozen eggs costs ₹60. What do 6 eggs cost at the same rate?', options: ['₹15', '₹20', '₹30', '₹40'], a: 2 },
  { q: 'What comes next? 1, 1, 2, 3, 5, 8, __', options: ['11', '12', '13', '15'], a: 2 },
  { q: 'If yesterday was Monday, what day is the day after tomorrow?', options: ['Wednesday', 'Thursday', 'Friday', 'Saturday'], a: 1 }
];

const EMOJI_BANK = [
  { prompt: '🦁👑', answers: ['the lion king', 'lion king'] },
  { prompt: '🍎📱', answers: ['apple phone', 'iphone', 'apple'] },
  { prompt: '🌧️🐱🐶', answers: ['raining cats and dogs', 'rain cats and dogs'] },
  { prompt: '🕷️👨', answers: ['spiderman', 'spider man'] },
  { prompt: '🌍🛟', answers: ['save the planet', 'save our planet', 'earth day'] },
  { prompt: '🐟🔍', answers: ['finding nemo', 'nemo'] },
  { prompt: '⏰💰', answers: ['time is money'] },
  { prompt: '🍫🏭', answers: ['charlie and the chocolate factory', 'chocolate factory'] },
  { prompt: '🔥🐉', answers: ['fire dragon', 'dragon fire'] },
  { prompt: '🌙🚶', answers: ['moonwalk', 'walking on the moon'] }
];

const TYPING_SENTENCES = [
  'Bright ideas can turn an ordinary game night into an unforgettable adventure.',
  'Quick minds and sharp eyes make the best team when the countdown begins.',
  'A little friendly competition makes every victory feel extra special.',
  'The fastest fingers are fun, but accuracy is what wins the round.'
];

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'Party Showdown' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(value) {
  const name = String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 16);
  return name || 'Player';
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(items, count) {
  return shuffle(items).slice(0, count);
}

function roomForSocket(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}

function playerForSocket(room, socket) {
  if (!room) return null;
  return [...room.players.values()].find(p => p.socketId === socket.id) || null;
}

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    hostToken: room.hostToken,
    players: [...room.players.values()].map(p => ({
      token: p.token,
      name: p.name,
      score: p.score,
      connected: p.connected,
      ready: p.ready,
      isHost: p.token === room.hostToken
    })),
    roundIndex: room.roundIndex,
    totalRounds: GAMES.length
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('roomState', publicRoom(room));
}

function sendError(socket, message) {
  socket.emit('appError', { message });
}

function attachPlayer(socket, room, player) {
  player.socketId = socket.id;
  player.connected = true;
  const currentHost = room.players.get(room.hostToken);
  if (!currentHost || !currentHost.connected) room.hostToken = player.token;
  player.disconnectedAt = null;
  socket.data.roomCode = room.code;
  socket.data.playerToken = player.token;
  socket.join(room.code);
  socket.emit('session', { roomCode: room.code, playerToken: player.token, playerName: player.name });
  broadcastRoom(room);
  if (room.status === 'playing' && room.currentRound) {
    socket.emit('roundStarted', room.currentRound.clientPayload);
    if (room.currentRound.game.id === 'reaction' && Date.now() >= room.currentRound.privateData.signalAt) {
      socket.emit('reactionSignal', { signalAt: room.currentRound.privateData.signalAt });
    }
  } else if (room.status === 'intermission' && room.lastRoundResult) {
    socket.emit('roundFinished', room.lastRoundResult);
  } else if (room.status === 'tieBreak' && room.tieBreak) {
    socket.emit('tieBreakStarted', room.tieBreak.clientPayload);
  } else if (room.status === 'finished' && room.finalResult) {
    socket.emit('gameFinished', room.finalResult);
  }
}

function createPlayer(name) {
  return {
    token: crypto.randomUUID(),
    socketId: null,
    name: cleanName(name),
    score: 0,
    connected: false,
    ready: false,
    disconnectedAt: null
  };
}

function joinOrReconnect(socket, payload, createOnly = false) {
  const code = String(payload?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const name = cleanName(payload?.name);
  const token = String(payload?.playerToken || '');
  let room = code ? rooms.get(code) : null;

  if (!room && !createOnly) return sendError(socket, 'Room not found. Check the code and try again.');
  if (!room && createOnly) {
    room = {
      code: makeCode(), hostToken: null, players: new Map(), status: 'lobby',
      roundIndex: -1, currentRound: null, lastRoundResult: null, finalResult: null,
      timer: null, signalTimer: null, intermissionTimer: null, submissions: new Map(),
      roundStartedAt: null, roundEndsAt: null, tieBreak: null, tieBreakTimer: null
    };
    rooms.set(room.code, room);
  }

  let player = token ? room.players.get(token) : null;
  if (player) {
    if (player.connected && player.socketId !== socket.id) {
      const previous = io.sockets.sockets.get(player.socketId);
      if (previous) previous.disconnect(true);
    }
    player.name = name || player.name;
    attachPlayer(socket, room, player);
    return;
  }

  if (!createOnly && room.status !== 'lobby') {
    return sendError(socket, 'This game has already started. Only returning players can reconnect.');
  }
  if (room.status !== 'lobby') return sendError(socket, 'This room is no longer accepting players.');
  const connectedCount = [...room.players.values()].filter(p => p.connected).length;
  if (room.players.size >= 8) return sendError(socket, 'This room is full. It supports up to 8 players.');

  player = createPlayer(name);
  room.players.set(player.token, player);
  if (!room.hostToken) room.hostToken = player.token;
  attachPlayer(socket, room, player);
}

function clearRoundTimers(room) {
  if (room.timer) clearTimeout(room.timer);
  if (room.signalTimer) clearTimeout(room.signalTimer);
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
  if (room.tieBreakTimer) clearTimeout(room.tieBreakTimer);
  room.timer = room.signalTimer = room.intermissionTimer = room.tieBreakTimer = null;
}

function publicLeaderboard(room) {
  return [...room.players.values()]
    .map(p => ({ token: p.token, name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function makeRound(room) {
  const game = GAMES[room.roundIndex];
  const startedAt = Date.now();
  const endsAt = startedAt + game.duration;
  const privateData = {};
  let data = {};

  switch (game.id) {
    case 'reaction': {
      const signalAt = startedAt + crypto.randomInt(2200, 4200);
      privateData.signalAt = signalAt;
      room.signalTimer = setTimeout(() => {
        if (room.status === 'playing' && room.currentRound?.game.id === 'reaction') {
          io.to(room.code).emit('reactionSignal', { signalAt });
        }
      }, signalAt - Date.now());
      data = { signalAt };
      break;
    }
    case 'memory': {
      const sequence = Array.from({ length: 5 }, () => COLORS[crypto.randomInt(COLORS.length)]);
      privateData.sequence = sequence;
      data = { sequence, previewMs: 3800 };
      break;
    }
    case 'typing': {
      const text = TYPING_SENTENCES[crypto.randomInt(TYPING_SENTENCES.length)];
      privateData.text = text;
      data = { text };
      break;
    }
    case 'quiz': {
      const questions = sample(QUIZ_BANK, 5);
      privateData.questions = questions;
      data = { items: questions.map(q => ({ prompt: q.q, options: q.options })) };
      break;
    }
    case 'brain': {
      const questions = sample(BRAIN_BANK, 3);
      privateData.questions = questions;
      data = { items: questions.map(q => ({ prompt: q.q, options: q.options })) };
      break;
    }
    case 'emoji': {
      const items = sample(EMOJI_BANK, 3);
      privateData.items = items;
      data = { items: items.map(item => ({ prompt: item.prompt })) };
      break;
    }
    case 'odd': {
      const common = SYMBOLS[crypto.randomInt(SYMBOLS.length)];
      let different = SYMBOLS[crypto.randomInt(SYMBOLS.length)];
      while (different === common) different = SYMBOLS[crypto.randomInt(SYMBOLS.length)];
      const oddIndex = crypto.randomInt(25);
      const grid = Array.from({ length: 25 }, (_, i) => i === oddIndex ? different : common);
      privateData.oddIndex = oddIndex;
      data = { grid };
      break;
    }
  }

  const clientPayload = {
    gameId: game.id,
    title: game.title,
    category: game.category,
    instructions: game.instructions,
    roundNumber: room.roundIndex + 1,
    totalRounds: GAMES.length,
    durationMs: game.duration,
    startedAt,
    endsAt,
    data
  };
  room.currentRound = { game, privateData, clientPayload };
  room.roundStartedAt = startedAt;
  room.roundEndsAt = endsAt;
  room.submissions = new Map();
  return clientPayload;
}

function startRound(room) {
  if (room.status !== 'playing') return;
  room.roundIndex += 1;
  if (room.roundIndex >= GAMES.length) return endMatch(room);
  clearRoundTimers(room);
  room.lastRoundResult = null;
  const payload = makeRound(room);
  io.to(room.code).emit('roundStarted', payload);
  broadcastRoom(room);
  room.timer = setTimeout(() => finishRound(room), Math.max(0, room.roundEndsAt - Date.now()));
}

function normalizedAnswer(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function handleSubmission(socket, payload) {
  const room = roomForSocket(socket);
  const player = playerForSocket(room, socket);
  if (!room || !player || room.status !== 'playing' || !room.currentRound) return;
  if (Date.now() > room.roundEndsAt) return;
  if (room.submissions.has(player.token)) return;

  const { game, privateData } = room.currentRound;
  const input = payload || {};
  const elapsed = Math.max(1, Date.now() - room.roundStartedAt);
  const feedback = (correct, message) => socket.emit('submissionFeedback', { correct, message, gameId: game.id });

  switch (game.id) {
    case 'reaction': {
      if (Date.now() < privateData.signalAt) return feedback(false, 'Too early! Wait for green. You can try again.');
      const reactionMs = Math.max(1, Date.now() - privateData.signalAt);
      room.submissions.set(player.token, { valid: true, metric: reactionMs, display: `${reactionMs} ms`, submittedAt: Date.now() });
      feedback(true, `Locked in: ${reactionMs} ms`);
      break;
    }
    case 'memory': {
      const sequence = Array.isArray(input.sequence) ? input.sequence : [];
      const correct = sequence.length === privateData.sequence.length && sequence.every((v, i) => v === privateData.sequence[i]);
      if (!correct) return feedback(false, 'Not quite. Check the order and try again.');
      room.submissions.set(player.token, { valid: true, metric: elapsed, display: 'Perfect sequence', submittedAt: Date.now() });
      feedback(true, 'Perfect memory! Your answer is locked.');
      break;
    }
    case 'typing': {
      const typed = String(input.text || '').slice(0, 500);
      if (!typed.trim()) return feedback(false, 'Type the sentence before submitting.');
      const target = privateData.text;
      const distance = levenshtein(target.toLowerCase(), typed.trim().toLowerCase());
      const accuracy = Math.max(0, 1 - distance / Math.max(target.length, typed.trim().length));
      const correctChars = Math.max(0, target.length - distance);
      const minutes = Math.max(elapsed / 60000, 1 / 60);
      const adjustedWpm = (correctChars / 5 / minutes) * accuracy;
      room.submissions.set(player.token, { valid: true, metric: adjustedWpm, display: `${adjustedWpm.toFixed(1)} adjusted WPM · ${(accuracy * 100).toFixed(0)}% accuracy`, submittedAt: Date.now() });
      feedback(true, `Submitted: ${(accuracy * 100).toFixed(0)}% accuracy`);
      break;
    }
    case 'quiz':
    case 'brain': {
      const answers = Array.isArray(input.answers) ? input.answers : [];
      const questions = privateData.questions;
      const correctCount = questions.reduce((sum, q, i) => sum + (Number(answers[i]) === q.a ? 1 : 0), 0);
      room.submissions.set(player.token, { valid: true, metric: correctCount, secondary: elapsed, display: `${correctCount}/${questions.length} correct`, submittedAt: Date.now() });
      feedback(true, `Submitted: ${correctCount}/${questions.length} correct`);
      break;
    }
    case 'emoji': {
      const answers = Array.isArray(input.answers) ? input.answers : [];
      const correctCount = privateData.items.reduce((sum, item, i) => {
        const value = normalizedAnswer(answers[i]);
        return sum + (value && item.answers.some(a => normalizedAnswer(a) === value) ? 1 : 0);
      }, 0);
      room.submissions.set(player.token, { valid: true, metric: correctCount, secondary: elapsed, display: `${correctCount}/${privateData.items.length} decoded`, submittedAt: Date.now() });
      feedback(true, `Submitted: ${correctCount}/${privateData.items.length} decoded`);
      break;
    }
    case 'odd': {
      const index = Number(input.index);
      if (!Number.isInteger(index) || index < 0 || index > 24) return;
      if (index !== privateData.oddIndex) return feedback(false, 'Not that one—keep looking!');
      const reactionMs = elapsed;
      room.submissions.set(player.token, { valid: true, metric: reactionMs, display: `${(reactionMs / 1000).toFixed(2)} s`, submittedAt: Date.now() });
      feedback(true, 'Found it! Your answer is locked.');
      break;
    }
  }
  io.to(room.code).emit('playerProgress', {
    token: player.token,
    submitted: room.submissions.has(player.token),
    submittedCount: room.submissions.size,
    playerCount: [...room.players.values()].filter(p => p.connected).length
  });
}

function compareSubmissions(gameId, a, b) {
  if (gameId === 'typing') return b.metric - a.metric;
  if (gameId === 'quiz' || gameId === 'brain' || gameId === 'emoji') {
    return b.metric - a.metric || a.secondary - b.secondary;
  }
  return a.metric - b.metric;
}

function equalSubmission(gameId, a, b) {
  if (gameId === 'quiz' || gameId === 'brain' || gameId === 'emoji') {
    return a.metric === b.metric && a.secondary === b.secondary;
  }
  return Math.abs(a.metric - b.metric) < 0.0001;
}

function finishRound(room) {
  if (room.status !== 'playing' || !room.currentRound) return;
  clearRoundTimers(room);
  const gameId = room.currentRound.game.id;
  const ranked = [...room.submissions.entries()]
    .map(([token, result]) => ({ token, ...result }))
    .filter(result => result.valid)
    .sort((a, b) => compareSubmissions(gameId, a, b));

  const awarded = new Map();
  let index = 0;
  while (index < ranked.length) {
    let end = index + 1;
    while (end < ranked.length && equalSubmission(gameId, ranked[index], ranked[end])) end++;
    const groupSize = end - index;
    const points = POINTS.slice(index, index + groupSize).reduce((sum, value) => sum + value, 0) / groupSize;
    for (let i = index; i < end; i++) awarded.set(ranked[i].token, { points, rank: index + 1, metric: ranked[i].display });
    index = end;
  }

  for (const [token, reward] of awarded.entries()) {
    const p = room.players.get(token);
    if (p) p.score += reward.points;
  }

  const results = [...room.players.values()].map(p => {
    const reward = awarded.get(p.token);
    return {
      token: p.token,
      name: p.name,
      roundPoints: reward ? reward.points : 0,
      rank: reward ? reward.rank : null,
      metric: reward ? reward.metric : (room.submissions.has(p.token) ? 'No valid result' : 'Did not finish'),
      totalScore: p.score
    };
  }).sort((a, b) => b.roundPoints - a.roundPoints || b.totalScore - a.totalScore || a.name.localeCompare(b.name));

  room.status = 'intermission';
  room.currentRound = null;
  room.lastRoundResult = {
    gameId,
    title: GAMES[room.roundIndex].title,
    roundNumber: room.roundIndex + 1,
    results,
    leaderboard: publicLeaderboard(room),
    nextRoundInMs: 6500
  };
  io.to(room.code).emit('roundFinished', room.lastRoundResult);
  broadcastRoom(room);
  room.intermissionTimer = setTimeout(() => {
    if (room.status === 'intermission') {
      room.status = 'playing';
      startRound(room);
    }
  }, 6500);
}

function startTieBreak(room, tiedPlayers) {
  clearRoundTimers(room);
  room.status = 'tieBreak';
  const a = crypto.randomInt(3, 10);
  const factor = crypto.randomInt(2, 5);
  const sequence = [a, a * factor, a * factor * factor, a * factor * factor * factor];
  const answer = a * factor * factor * factor * factor;
  room.tieBreak = {
    eligible: new Set(tiedPlayers.map(p => p.token)),
    answer,
    startedAt: Date.now(),
    clientPayload: {
      title: 'Sudden Death',
      prompt: 'What number comes next in this pattern?',
      sequence,
      endsAt: Date.now() + 20000,
      eligibleTokens: tiedPlayers.map(p => p.token)
    }
  };
  io.to(room.code).emit('tieBreakStarted', room.tieBreak.clientPayload);
  room.tieBreakTimer = setTimeout(() => {
    if (room.status === 'tieBreak') startTieBreak(room, [...room.tieBreak.eligible].map(t => room.players.get(t)).filter(Boolean));
  }, 20000);
}

function finishMatch(room, winnerToken, isTie = false) {
  clearRoundTimers(room);
  room.status = 'finished';
  const leaderboard = publicLeaderboard(room);
  const winner = winnerToken ? room.players.get(winnerToken) : null;
  room.finalResult = {
    leaderboard,
    winner: winner ? { token: winner.token, name: winner.name, score: winner.score } : null,
    tied: isTie,
    completedRounds: GAMES.length
  };
  room.tieBreak = null;
  io.to(room.code).emit('gameFinished', room.finalResult);
  broadcastRoom(room);
}

function endMatch(room) {
  const sorted = [...room.players.values()].sort((a, b) => b.score - a.score);
  if (!sorted.length) return finishMatch(room, null);
  const topScore = sorted[0].score;
  const tied = sorted.filter(p => p.score === topScore);
  if (tied.length > 1) return startTieBreak(room, tied);
  finishMatch(room, sorted[0].token);
}

io.on('connection', socket => {
  socket.on('createRoom', payload => joinOrReconnect(socket, payload, true));
  socket.on('joinRoom', payload => joinOrReconnect(socket, payload, false));
  socket.on('rejoinRoom', payload => joinOrReconnect(socket, payload, false));

  socket.on('setReady', () => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player || room.status !== 'lobby') return;
    player.ready = !player.ready;
    broadcastRoom(room);
  });

  socket.on('startGame', () => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player || room.hostToken !== player.token || room.status !== 'lobby') return;
    const connected = [...room.players.values()].filter(p => p.connected);
    if (connected.length < 2) return sendError(socket, 'At least 2 players are needed to start.');
    if (!connected.every(p => p.ready)) return sendError(socket, 'Everyone must be ready before the game starts.');
    room.status = 'playing';
    for (const p of room.players.values()) p.score = 0;
    startRound(room);
  });

  socket.on('submitRound', payload => handleSubmission(socket, payload));

  socket.on('nextRound', () => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player || player.token !== room.hostToken || room.status !== 'intermission') return;
    if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
    room.intermissionTimer = null;
    room.status = 'playing';
    startRound(room);
  });

  socket.on('submitTieBreak', payload => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player || room.status !== 'tieBreak' || !room.tieBreak) return;
    if (!room.tieBreak.eligible.has(player.token)) return sendError(socket, 'Only the tied players can answer this sudden-death question.');
    const guess = Number(String(payload?.answer || '').trim());
    if (!Number.isFinite(guess)) return;
    if (guess !== room.tieBreak.answer) {
      socket.emit('tieBreakFeedback', { correct: false, message: 'Not quite—try another answer!' });
      return;
    }
    finishMatch(room, player.token);
  });

  socket.on('leaveRoom', () => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player) return;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    if (room.hostToken === player.token) {
      const nextHost = [...room.players.values()].find(p => p.connected);
      if (nextHost) room.hostToken = nextHost.token;
    }
    socket.leave(room.code);
    socket.data.roomCode = null;
    socket.data.playerToken = null;
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const room = roomForSocket(socket);
    const player = playerForSocket(room, socket);
    if (!room || !player) return;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    if (room.hostToken === player.token) {
      const nextHost = [...room.players.values()].find(p => p.connected);
      if (nextHost) room.hostToken = nextHost.token;
    }
    broadcastRoom(room);
    if (![...room.players.values()].some(p => p.connected)) {
      setTimeout(() => {
        const latest = rooms.get(room.code);
        if (latest && ![...latest.players.values()].some(p => p.connected)) {
          clearRoundTimers(latest);
          rooms.delete(room.code);
        }
      }, 30 * 60 * 1000).unref?.();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Party Showdown is running on http://localhost:${PORT}`);
});
