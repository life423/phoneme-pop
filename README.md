# Phoneme Pop 🎯

A multisensory phonics game for learners with dyslexia: hear a word, split it into its sounds, and put the sounds back in order. Live at https://myprivateteacher.com.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # game-logic tests (Vitest)
npm run build    # production build in dist/
```

## Run the production container locally

```bash
docker compose up --build   # http://localhost:8080
```

The image builds with Node 24, runs the tests (a failing test fails the build), and serves `dist/` from nginx. `nginx.conf` handles compression, caching, security headers, and redirecting www and the Azure default hostname to https://myprivateteacher.com.

## Content notes

- Words live in `src/data/wordLists.js`. In `display`, vowels carry a breve (short) or macron (long), and `[brackets]` mark letters that make one sound together; they render underlined.
- Keyword pictures live in `src/data/phonemeSymbols.js`. A picture's name should start with its sound, and no picture should stand for two different sounds.
- Text-to-speech is used for whole words and feedback only. Single sounds need recorded clips, because TTS reads a lone letter by its name.

## Deploy

Azure Container Apps: `phoneme-pop` in the `portfolio-apps` resource group. `.github/workflows/deploy.yml` runs the tests on every pull request. Pushes to `main` build the image (tagged with the commit), deploy it, and wait until https://myprivateteacher.com/version.txt reports that commit.

Repo secrets: `PHONEMEPOP_AZURE_CLIENT_ID`, `PHONEMEPOP_AZURE_TENANT_ID`, `PHONEMEPOP_AZURE_SUBSCRIPTION_ID` (OIDC sign-in, no password), `DOCKERHUB_USERNAME`, and `DOCKERHUB_TOKEN`.
