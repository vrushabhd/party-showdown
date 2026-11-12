# Party Showdown

A real-time browser party game for 2–8 players. Players join a private room with a six-character code and compete across seven mini-games:

1. Reaction Rush
2. Memory Master
3. Typing Frenzy
4. Quick Quiz
5. Brain Blitz
6. Emoji Decode
7. Odd One Out

The Node.js server is authoritative for room membership, round timing, answer validation, scoring, and the final leaderboard. Socket.IO keeps all player devices synchronized.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
cd party-showdown
npm install
npm start
```

Open <http://localhost:3000> in a browser. To test multiple players on the same computer, open the page in separate browser tabs or windows.

### Test on phones on the same Wi-Fi

1. Find the computer's local network IP address (for example, `192.168.1.20`).
2. Start the server with `npm start`.
3. On each phone connected to the same Wi-Fi, open `http://192.168.1.20:3000` (replace the example IP with your computer's IP).
4. Make sure your computer firewall allows inbound connections on port `3000`.

## Deploy for friends on different networks

The game needs a publicly reachable Node.js host because the room state and real-time events are handled by `server.js`. Deploy this folder to a Node.js hosting provider that supports persistent HTTP/WebSocket connections (for example, a small VPS or a Node-compatible app host).

- Build command: `npm install`
- Start command: `npm start`
- Node version: 18+
- Set `PORT` if your host requires a specific port (most platforms set it automatically).
- Optionally set `ALLOWED_ORIGIN` to your public site origin. The default CORS setting is `*` for easy initial testing; tighten it for a public deployment.

Do not host this as a static-only site: Socket.IO requires the Node server to remain running.

## Game rules implemented

- 2–8 players per room; one host creates the room.
- Six-character room code; nicknames are up to 16 characters.
- Everyone marks themselves ready before the host can start.
- Seven rounds run in the lineup above.
- Points by placing: 1st 10, 2nd 8, 3rd 6, 4th 5, 5th 4, 6th 3, 7th 2, 8th 1. Tied placements share the average points for the occupied positions.
- Players who do not submit a valid result receive zero for that round.
- The game ends after all seven rounds. A tie for first triggers a sudden-death number-pattern puzzle for the tied players.
- Reconnecting with the same browser storage restores the player's room identity and accumulated score while the room remains available.
- A disconnected player's spot remains reserved for the match; the game continues for connected players.

## Project structure

```text
party-showdown/
  server.js
  package.json
  README.md
  public/
    index.html
    styles.css
    app.js
```

## Notes

- Scores and answers are validated on the server rather than trusted from the browser.
- This is a lightweight party game, not an anti-cheat tournament platform. The game is designed for friendly private rooms.
- Room state is held in memory. Restarting the server ends all active rooms; use a persistent database if you later need rooms to survive server restarts or scale across multiple server instances.
