# 🎮 Party Showdown

**A real-time multiplayer party game where friends compete in fun, fast-paced mini-games!**

Party Showdown is a browser-based multiplayer party game designed for 2–8 players. Create a private room, invite your friends using a unique six-character room code, and compete across seven exciting mini-games.

Each player joins from their own phone, tablet, or computer. Test your reaction speed, memory, typing skills, general knowledge, and problem-solving abilities while competing for the top spot on the live leaderboard.

## ✨ Features

- 👥 **Multiplayer:** Supports 2–8 players in each room.
- 🔑 **Private Rooms:** Create rooms with unique six-character codes.
- ⚡ **Real-Time Gameplay:** Synchronized rounds, countdowns, and live updates using Socket.IO.
- 🎯 **7 Mini-Games:** Different challenges testing different skills.
- 🏆 **Live Leaderboard:** Track scores and rankings after every round.
- 📱 **Responsive Design:** Play on mobile phones, tablets, and desktops.
- 🔄 **Reconnection Support:** Rejoin an active match and restore your progress.
- 🎉 **Sudden-Death Tie-breaker:** Determine the ultimate champion when players finish tied.

## 🕹️ Mini-Games

| Mini-Game | Description |
|---|---|
| ⚡ Reaction Rush | Test your reflexes by tapping when the screen turns green. |
| 🧠 Memory Master | Memorize and reproduce sequences of colors. |
| ⌨️ Typing Frenzy | Type sentences as quickly and accurately as possible. |
| ❓ Quick Quiz | Answer five fast-paced trivia questions. |
| 🔢 Brain Blitz | Solve number sequences, maths, and logic puzzles. |
| 😀 Emoji Decode | Guess movies, phrases, and expressions from emojis. |
| 👀 Odd One Out | Find the different symbol among similar-looking objects. |

## 🏆 Scoring System

Players earn points based on their performance in each mini-game.

| Position | Points |
|---|---:|
| 1st Place | 10 |
| 2nd Place | 8 |
| 3rd Place | 6 |
| 4th Place | 5 |
| 5th Place | 4 |
| 6th Place | 3 |
| 7th Place | 2 |
| 8th Place | 1 |

Points accumulate across all seven rounds. The player with the highest total score wins the game!

## 🚀 How to Play

1. One player creates a private room.
2. Share the generated six-character room code with friends.
3. Other players enter the code and choose their nicknames.
4. Everyone marks themselves as ready.
5. The host starts the game.
6. Compete in all seven mini-games and earn points.
7. Check the leaderboard after each round.
8. The highest-scoring player becomes the **Party Showdown Champion!**

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **Real-Time Communication:** Socket.IO
- **Game Logic:** Server-side scoring and answer validation

## 💻 Getting Started

### Prerequisites

- Node.js 18 or newer
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/party-showdown.git
   ```

2. Navigate to the project directory:

   ```bash
   cd party-showdown
   ```

3. Install dependencies:

   ```bash
   npm install express socket.io
   ```

4. Start the server:

   ```bash
   node server.js
   ```

5. Open your browser and visit:

   ```text
   http://localhost:3000
   ```

### 📱 Play on Multiple Devices

To test the game on phones connected to the same Wi-Fi network:

1. Find your computer's local IP address.
2. Start the server.
3. Open `http://YOUR-LOCAL-IP:3000` on each phone.
4. Create a room and share the room code.

Make sure your firewall allows connections on port `3000`.

### 🌐 Online Deployment

To play with friends over different internet connections, deploy the project to a Node.js hosting provider that supports persistent connections and WebSockets.

- Install command: `npm install express socket.io`
- Start command: `node server.js`
- Node.js version: 18 or newer.
- Set the `PORT` environment variable if required.
- Optionally configure `ALLOWED_ORIGIN` to restrict cross-origin access.

**Note:** This project requires a running Node.js server. It cannot be deployed as a static-only website.

## 📁 Project Structure

```text
party-showdown/
│
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── server.js
└── README.md
```

## 🔒 Multiplayer & Game State

- The server manages room membership, round timers, and scoring.
- Player answers and results are validated by the server.
- Socket.IO synchronizes gameplay across connected devices.
- Active rooms are stored in memory, so restarting the server ends existing matches.
- This project is designed for friendly private games, not competitive anti-cheat tournaments.

## 🎉 Have Fun!

Challenge your friends, test your skills, climb the leaderboard, and prove that you're the ultimate **Party Showdown Champion!**

**Think fast. Play smart. Win together!** 🏆
