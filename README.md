# My Private Teacher 🎯

Reading activities for learners with dyslexia, live at https://myprivateteacher.com.

- **Phoneme Pop** (`/phoneme-pop`): hear a word, split it into its sounds, and put the sounds back in order.
- **Alphabet Whiteboard** (`/whiteboard`): a live tutoring space. The tutor starts a session and gets a 4-digit code. The student joins with it and moves a cartoon hand over an alphabet strip while the tutor watches it move in real time.

## Develop

```bash
npm install
npm run server   # Node server with the realtime /ws endpoint, http://localhost:8080
npm run dev      # Vite dev server, http://localhost:3000 (proxies /ws to the Node server)
npm run build    # production build in dist/
npm test         # game logic, whiteboard geometry, realtime rooms, web server (build first)
```

## Run the production container locally

```bash
docker compose up --build             # http://localhost:8080
npm run smoke -- http://localhost:8080   # a tutor and a student make a round trip over /ws
```

The image builds the client, runs the tests (a failing test fails the build), and serves everything from one small Node server, `server/index.js`. It handles long-lived caching for hashed assets, gzip, security headers, redirects from www and the Azure hostname to https://myprivateteacher.com, and the whiteboard's WebSocket endpoint at `/ws`.

## Alphabet Whiteboard

Both screens draw the same fixed 1600 x 1000 stage, scaled to fit, so a point on a 27-inch monitor is the same point on an iPad. The student's device works out which letter is under the fingertip and sends it with the position as 0-1 coordinates, about 30 times a second, newest position wins. On touch screens the fingertip sits a little above the finger so the child can still see the letter.

`server/realtime.js` keeps rooms in memory, with one tutor and one student each. A room closes a minute after the tutor leaves. Both sides reconnect on their own, and the tutor gets the same code back after a deploy. Join attempts are rate-limited per IP, and only this site's pages can open a connection.

Because rooms live in memory, the Container App runs exactly one replica.

Tools: the tutor has their own hand (a blue glove), a blue pen, an eraser, undo and a two-tap clear, and can drag the student's hand to guide it. The student's toolbar (hand, black pen, eraser, undo) appears only while the tutor has Student tools switched on, and the server enforces that. The board is one ordered list of strokes: ink sits on two layers so the student's eraser can't touch the tutor's writing, and each person's undo only takes back their own strokes. After a restart, the tutor's browser hands the board back to the server.

## Content notes

- Words live in `src/data/wordLists.js`. In `display`, vowels carry a breve (short) or macron (long), and `[brackets]` mark letters that make one sound together; they render underlined.
- Keyword pictures live in `src/data/phonemeSymbols.js`. A picture's name should start with its sound, and no picture should stand for two different sounds.
- Text-to-speech is used for whole words and feedback only. Single sounds need recorded clips, because TTS reads a lone letter by its name.

## Deploy

Azure Container Apps: `phoneme-pop` in the `portfolio-apps` resource group. `.github/workflows/deploy.yml` runs the tests on every pull request. Pushes to `main` build the image (tagged with the commit), deploy it, wait until https://myprivateteacher.com/version.txt reports that commit, then run the realtime smoke test against the live site.

Repo secrets: `PHONEMEPOP_AZURE_CLIENT_ID`, `PHONEMEPOP_AZURE_TENANT_ID`, `PHONEMEPOP_AZURE_SUBSCRIPTION_ID` (OIDC sign-in, no password), `DOCKERHUB_USERNAME`, and `DOCKERHUB_TOKEN`.
